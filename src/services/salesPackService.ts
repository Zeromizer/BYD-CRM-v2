/**
 * Sales Pack Service
 * Handles multi-page PDF splitting, classification, and grouping
 *
 * Flow:
 * 1. Load multi-page PDF with pdfjs-dist
 * 2. Convert each page to image for Vision OCR
 * 3. Extract text from each page using Vision API (visionOnly mode)
 * 4. Send all page texts to Claude for intelligent classification and grouping
 * 5. Split PDF into separate documents using pdf-lib
 * 6. Return splits with thumbnails for user review
 */

import { getSupabase } from '@/lib/supabase'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Types
export interface PageClassification {
  pageNumber: number
  documentType: string
  documentTypeName: string
  confidence: number
  thumbnailDataUrl: string
  rawText: string
}

export interface SplitDocument {
  id: string // Unique ID for React key
  documentType: string
  documentTypeName: string
  pages: number[] // Page numbers (1-indexed)
  confidence: number
  thumbnailDataUrl: string // First page thumbnail
  pdfBlob?: Blob // Generated after splitting
}

export interface SalesPackAnalysisResult {
  totalPages: number
  pageClassifications: PageClassification[]
  suggestedSplits: SplitDocument[]
  customerName: string
}

export interface BatchClassifyResult {
  customerName: string
  pages: {
    documentType: string
    documentTypeName: string
    confidence: number
  }[]
  documentGroups: {
    documentType: string
    documentTypeName: string
    pages: number[]
    confidence: number
  }[]
}

// Document type to friendly name mapping
const DOCUMENT_TYPE_INFO: Record<string, { name: string; folder: string }> = {
  nric_front: { name: 'NRIC Front', folder: 'nric_front' },
  nric_back: { name: 'NRIC Back', folder: 'nric_back' },
  nric: { name: 'NRIC (Combined)', folder: 'nric' },
  driving_license: { name: 'Driving License', folder: 'driving_license' },
  driving_license_front: { name: 'Driving License Front', folder: 'driving_license_front' },
  driving_license_back: { name: 'Driving License Back', folder: 'driving_license_back' },
  test_drive_form: { name: 'Test Drive Form', folder: 'test_drive_form' },
  vsa: { name: 'Vehicle Sales Agreement', folder: 'vsa' },
  pdpa: { name: 'PDPA Consent Form', folder: 'pdpa' },
  loan_approval: { name: 'Loan Approval Letter', folder: 'loan_approval' },
  loan_application: { name: 'Loan Application', folder: 'loan_application' },
  insurance_quote: { name: 'Insurance Quote', folder: 'insurance_quote' },
  insurance_policy: { name: 'Cover Note', folder: 'insurance_policy' },
  insurance_acceptance: { name: 'Insurance Acceptance', folder: 'insurance_acceptance' },
  payment_proof: { name: 'Payment Proof', folder: 'payment_proof' },
  delivery_checklist: { name: 'Delivery Checklist', folder: 'delivery_checklist' },
  registration_card: { name: 'Registration Card', folder: 'registration_card' },
  trade_in_docs: { name: 'Trade-in Documents', folder: 'trade_in_docs' },
  coe_bidding: { name: 'COE Bidding Form', folder: 'coe_bidding' },
  purchase_agreement: { name: 'Purchase Agreement', folder: 'purchase_agreement' },
  parf_rebate: { name: 'PARF/COE Rebate', folder: 'parf_rebate' },
  authorized_letter: { name: 'Authorized Letter', folder: 'authorized_letter' },
  proposal_form: { name: 'Proposal Form', folder: 'proposal_form' },
  price_list: { name: 'Price List', folder: 'price_list' },
  id_documents: { name: 'ID Documents', folder: 'id_documents' },
  other: { name: 'Other Document', folder: 'other' },
}

/**
 * Get document type info with fallback
 */
export function getDocumentTypeInfo(documentType: string): { name: string; folder: string } {
  return DOCUMENT_TYPE_INFO[documentType] || DOCUMENT_TYPE_INFO.other
}

/**
 * Get all available document types for dropdown
 */
export function getAvailableDocumentTypes(): { value: string; label: string }[] {
  return Object.entries(DOCUMENT_TYPE_INFO).map(([value, { name }]) => ({
    value,
    label: name,
  }))
}

/**
 * Convert a single PDF page to image for Vision OCR
 */
async function pdfPageToImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 2 // Higher for OCR accuracy
): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')

  canvas.width = viewport.width
  canvas.height = viewport.height

  console.log(
    `[SalesPack] Rendering page ${pageNum}: ${canvas.width}x${canvas.height} at scale ${scale}`
  )

  // White background for OCR
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)

  try {
    // pdf.js requires both canvas and canvasContext
    await page.render({
      canvasContext: context,
      viewport: viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).promise

    // Check if canvas has any non-white content
    const imageData = context.getImageData(
      0,
      0,
      Math.min(100, canvas.width),
      Math.min(100, canvas.height)
    )
    let hasContent = false
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Check if pixel is not white (255,255,255)
      if (imageData.data[i] < 250 || imageData.data[i + 1] < 250 || imageData.data[i + 2] < 250) {
        hasContent = true
        break
      }
    }
    console.log(`[SalesPack] Page ${pageNum} render complete, hasContent: ${hasContent}`)
  } catch (renderErr) {
    console.error(`[SalesPack] Page ${pageNum} render failed:`, renderErr)
    throw renderErr
  }

  // Use JPEG for better compatibility with Vision API
  return canvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Generate a thumbnail (lower quality for display)
 */
async function generateThumbnail(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  return pdfPageToImage(pdf, pageNum, 0.5) // Lower scale for thumbnails
}

// Note: extractTextWithVisionOnly was removed as we now use direct PDF analysis with Claude Vision

/**
 * Send all page texts to Claude for batch classification and grouping
 */
async function classifyPagesWithClaude(pageTexts: string[]): Promise<BatchClassifyResult> {
  const supabase = getSupabase()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to use the document scanner.')
  }

  // Log what we're sending to Claude
  console.log(`[SalesPack] Batch classifying ${pageTexts.length} pages with Claude`)
  pageTexts.forEach((text, i) => {
    console.log(
      `[SalesPack] Page ${i + 1}: ${text.length} chars - "${text.substring(0, 100).replace(/\n/g, ' ')}..."`
    )
  })

  // Call the Edge Function with batch-classify mode
  const { data, error } = await supabase.functions.invoke('vision-claude-ocr', {
    body: {
      mode: 'batch-classify',
      pageTexts,
    },
  })

  if (error) {
    console.error('[SalesPack] Batch classification error:', error)
    throw new Error(error.message || 'Failed to classify pages with Claude')
  }

  if (data?.error) {
    console.error('[SalesPack] Batch classification returned error:', data.error)
    throw new Error(data.error)
  }

  console.log(`[SalesPack] Batch classification result:`, {
    customerName: data.customerName,
    pagesCount: data.pages?.length,
    groupsCount: data.documentGroups?.length,
    groups: data.documentGroups?.map(
      (g: { documentType: string; pages: number[] }) =>
        `${g.documentType}(pages:${g.pages.join(',')})`
    ),
  })

  return {
    customerName: data.customerName ?? '',
    pages: data.pages ?? [],
    documentGroups: data.documentGroups ?? [],
  }
}

/**
 * Convert File to base64 data URL
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Analyze PDF using Claude Vision directly (sends entire PDF)
 * This is more reliable than PDF.js for problematic PDFs
 */
async function analyzeWithClaudeVision(
  pdfDataUrl: string,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<{
  pageTexts: string[]
  totalPages: number
  customerName: string
  documentGroups: BatchClassifyResult['documentGroups']
}> {
  const supabase = getSupabase()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to use the document scanner.')
  }

  onProgress?.('Sending to Claude Vision...', 0, 1)

  console.log(`[SalesPack] Sending PDF directly to Claude Vision (${pdfDataUrl.length} chars)`)

  // Check PDF size - Claude Vision has limits
  const pdfSizeMB = pdfDataUrl.length / (1024 * 1024)
  console.log(`[SalesPack] PDF size: ${pdfSizeMB.toFixed(2)} MB`)
  if (pdfSizeMB > 20) {
    throw new Error(
      `PDF is too large (${pdfSizeMB.toFixed(1)}MB). Please use a smaller PDF or split it first.`
    )
  }

  // Call the Edge Function with the PDF for direct Claude Vision analysis
  const { data, error } = await supabase.functions.invoke('vision-claude-ocr', {
    body: {
      mode: 'analyze-pdf',
      pdfData: pdfDataUrl,
    },
  })

  if (error) {
    console.error('[SalesPack] Claude Vision analysis error:', error)
    throw new Error(error.message || 'Failed to analyze PDF with Claude Vision')
  }

  if (data?.error) {
    console.error('[SalesPack] Claude Vision returned error:', data.error)
    throw new Error(data.error)
  }

  console.log(`[SalesPack] Claude Vision analysis result:`, data)

  return {
    pageTexts: data.pageTexts ?? [],
    totalPages: data.totalPages || 1,
    customerName: data.customerName ?? '',
    documentGroups: data.documentGroups ?? [],
  }
}

/**
 * Analyze a sales pack PDF
 * Uses Claude Vision directly to analyze the PDF - more reliable than PDF.js
 */
export async function analyzeSalesPack(
  file: File,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<SalesPackAnalysisResult> {
  console.log(`[SalesPack] Loading PDF: ${file.name} (${file.size} bytes)`)

  // Convert file to data URL for Claude Vision
  const pdfDataUrl = await fileToDataUrl(file)
  console.log(`[SalesPack] PDF converted to data URL (${pdfDataUrl.length} chars)`)

  // Try Claude Vision first (more reliable for problematic PDFs)
  try {
    onProgress?.('Analyzing PDF', 0, 1)

    const claudeResult = await analyzeWithClaudeVision(pdfDataUrl, onProgress)

    const totalPages = claudeResult.totalPages
    const pageClassifications: PageClassification[] = []
    const thumbnails: string[] = []

    // Try to generate thumbnails with PDF.js (best effort)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: true,
        useSystemFonts: true,
      }).promise

      for (let i = 1; i <= Math.min(pdf.numPages, totalPages); i++) {
        try {
          const thumbnail = await generateThumbnail(pdf, i)
          // Check if thumbnail has content (not just white)
          thumbnails.push(thumbnail)
        } catch (pageErr) {
          console.warn(`[SalesPack] Could not generate thumbnail for page ${i}:`, pageErr)
          thumbnails.push('') // Empty string will show PDF icon fallback
        }
      }
    } catch (thumbErr) {
      console.warn('[SalesPack] Could not generate thumbnails:', thumbErr)
      // Fill with empty strings for PDF icon fallback
      for (let i = 0; i < totalPages; i++) {
        thumbnails.push('')
      }
    }

    // Build page classifications from Claude result
    for (let i = 0; i < totalPages; i++) {
      const group = claudeResult.documentGroups.find((g) => g.pages.includes(i + 1))
      pageClassifications.push({
        pageNumber: i + 1,
        documentType: group?.documentType || 'other',
        documentTypeName: group?.documentTypeName || 'Other Document',
        confidence: group?.confidence || 50,
        thumbnailDataUrl: thumbnails[i] ?? '',
        rawText: claudeResult.pageTexts[i] ?? '',
      })
    }

    // Build suggested splits from document groups
    const suggestedSplits: SplitDocument[] = claudeResult.documentGroups.map((group, idx) => ({
      id: `doc-${idx}-${Date.now()}`,
      documentType: group.documentType,
      documentTypeName: group.documentTypeName || getDocumentTypeInfo(group.documentType).name,
      pages: group.pages,
      confidence: group.confidence,
      thumbnailDataUrl: thumbnails[group.pages[0] - 1] ?? '',
    }))

    return {
      totalPages,
      pageClassifications,
      suggestedSplits,
      customerName: claudeResult.customerName ?? '',
    }
  } catch (claudeErr) {
    console.error('[SalesPack] Claude Vision failed, falling back to PDF.js:', claudeErr)
    // Fall through to PDF.js method
  }

  // Fallback: Use PDF.js method
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise

  const totalPages = pdf.numPages
  console.log(`[SalesPack] PDF.js fallback: ${totalPages} pages`)

  onProgress?.('Loading PDF', 0, totalPages)

  const pageClassifications: PageClassification[] = []
  const pageTexts: string[] = []
  const thumbnails: string[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.('Extracting text', i, totalPages)

    const thumbnail = await generateThumbnail(pdf, i)
    thumbnails.push(thumbnail)

    // Just use placeholder text - the PDF.js extraction isn't working well
    pageTexts.push(`[Page ${i}]`)

    pageClassifications.push({
      pageNumber: i,
      documentType: 'other',
      documentTypeName: 'Other Document',
      confidence: 50,
      thumbnailDataUrl: thumbnail,
      rawText: '',
    })

    // Small delay between pages to avoid rate limits
    if (i < totalPages) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  // Step 2: Send all page texts to Claude for batch classification + grouping
  onProgress?.('Classifying documents', totalPages, totalPages)

  let classificationResult: BatchClassifyResult
  try {
    classificationResult = await classifyPagesWithClaude(pageTexts)
  } catch (err) {
    console.error('Batch classification failed:', err)
    // Fallback: treat entire PDF as single "other" document
    classificationResult = {
      customerName: '',
      pages: pageTexts.map(() => ({
        documentType: 'other',
        documentTypeName: 'Other Document',
        confidence: 50,
      })),
      documentGroups: [
        {
          documentType: 'other',
          documentTypeName: 'Other Document',
          pages: Array.from({ length: totalPages }, (_, i) => i + 1),
          confidence: 50,
        },
      ],
    }
  }

  // Merge Claude's classifications with our page data
  for (let i = 0; i < pageClassifications.length; i++) {
    const claudeResult = classificationResult.pages[i]
    if (claudeResult) {
      pageClassifications[i].documentType = claudeResult.documentType
      pageClassifications[i].documentTypeName =
        claudeResult.documentTypeName || getDocumentTypeInfo(claudeResult.documentType).name
      pageClassifications[i].confidence = claudeResult.confidence
    }
  }

  // Step 3: Generate suggested splits based on Claude's grouping
  const suggestedSplits: SplitDocument[] = classificationResult.documentGroups.map(
    (group, idx) => ({
      id: `doc-${idx}-${Date.now()}`,
      documentType: group.documentType,
      documentTypeName: group.documentTypeName || getDocumentTypeInfo(group.documentType).name,
      pages: group.pages,
      confidence: group.confidence,
      thumbnailDataUrl: thumbnails[group.pages[0] - 1] ?? '',
    })
  )

  return {
    totalPages,
    pageClassifications,
    suggestedSplits,
    customerName: classificationResult.customerName ?? '',
  }
}

/**
 * Check if a PDF page is blank (has minimal content)
 * Uses the page text from Claude's analysis to determine if blank
 */
function isPageTextBlank(pageText: string): boolean {
  if (!pageText) return true

  // Check for Claude's blank page marker
  if (pageText === '[BLANK]' || pageText.trim().toUpperCase() === '[BLANK]') {
    return true
  }

  // Remove whitespace and check length
  const trimmed = pageText.replace(/\s+/g, '').trim()

  // If less than 20 characters of actual content, consider it blank
  // This catches pages with just page numbers, headers, or minimal artifacts
  if (trimmed.length < 20) return true

  // Check for common blank page indicators
  const lowerText = pageText.toLowerCase()
  if (lowerText.includes('[blank page]') || lowerText.includes('intentionally blank')) {
    return true
  }

  return false
}

/**
 * Split a PDF into multiple documents based on page groupings
 * Uses pdf-lib to create new PDFs with specified pages
 * Automatically removes blank pages from the output based on page text content
 */
export async function splitPdf(
  originalFile: File,
  splits: SplitDocument[],
  pageTexts: string[] = [],
  removeBlankPages = true
): Promise<SplitDocument[]> {
  const arrayBuffer = await originalFile.arrayBuffer()
  const originalPdf = await PDFDocument.load(arrayBuffer)

  const result: SplitDocument[] = []

  for (const split of splits) {
    const newPdf = await PDFDocument.create()

    // Filter out blank pages based on their text content
    let nonBlankPages = split.pages
    if (removeBlankPages && pageTexts.length > 0) {
      nonBlankPages = split.pages.filter((pageNum) => {
        const pageText = pageTexts[pageNum - 1] ?? ''
        const isBlank = isPageTextBlank(pageText)
        if (isBlank) {
          console.log(`[SalesPack] Removing blank page ${pageNum} from ${split.documentTypeName}`)
        }
        return !isBlank
      })
    }

    // Skip if all pages were blank
    if (nonBlankPages.length === 0) {
      console.log(`[SalesPack] Skipping entirely blank document: ${split.documentTypeName}`)
      continue
    }

    // Copy non-blank pages (pdf-lib uses 0-indexed pages)
    const pageIndices = nonBlankPages.map((p) => p - 1)
    const copiedPages = await newPdf.copyPages(originalPdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))

    const pdfBytes = await newPdf.save()
    // Create Blob directly from Uint8Array
    const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })

    result.push({
      ...split,
      pages: nonBlankPages, // Update pages array to reflect removed blank pages
      pdfBlob,
    })
  }

  return result
}

/**
 * Generate filename for a split document
 * Format: CUSTOMER_NAME_documenttype.pdf
 */
export function generateSplitFilename(customerName: string, documentType: string): string {
  const safeName = customerName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()

  return `${safeName}_${documentType}.pdf`
}

/**
 * Sanitize customer name for file paths (reusing pattern from customerDocumentService)
 */
export function sanitizeCustomerName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()
}
