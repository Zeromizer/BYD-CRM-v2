/**
 * Intelligent OCR Service
 *
 * Two-step approach via Supabase Edge Function:
 * 1. Google Cloud Vision - High-accuracy OCR text extraction (98%)
 * 2. Claude Haiku 4.5 - Intelligent processing, validation, and structuring
 *
 * This approach optimizes for both accuracy and cost while enabling
 * sophisticated document understanding.
 */

import { getSupabase } from '@/lib/supabase'
import { fileToBase64 } from './documentClassifierService'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Types
export interface NricData {
  nric: string
  name: string
  dateOfBirth: string
  address: string
  race?: string
  sex?: string
  validation: {
    nricValid: boolean
    ageCalculated: number
    confidence: 'high' | 'medium' | 'low'
    issues: string[]
  }
}

export interface VsaFormData {
  customerName: string
  nric: string
  vehicleModel: string
  sellingPrice: number
  coeAmount: number
  deposit: number
  loanAmount: number
  validation: {
    totalsMatch: boolean
    allFieldsPresent: boolean
    calculatedTotal: number
    issues: string[]
  }
}

export interface OcrResult<T = unknown> {
  rawText: string
  structuredData: T
  confidence: number
  processingTime: number
}

export interface VisionClaudeResult {
  documentType: string
  documentTypeName: string
  confidence: number
  customerName: string
  signed: boolean
  summary: string
  rawText: string
  folder: string
  milestone: string
  extractedData: {
    nric?: string
    name?: string
    dateOfBirth?: string
    address?: string
    phone?: string
    email?: string
    vehicleModel?: string
    sellingPrice?: number
    coeAmount?: number
    deposit?: number
    loanAmount?: number
  }
  ocrMethod: 'vision-claude' | 'excel-parse'
  // Excel-specific fields
  excelData?: {
    sheetNames: string[]
    rowCount: number
    columnCount: number
    headers?: string[]
    preview?: Record<string, unknown>[]
  }
}

/**
 * Response from vision-claude-ocr Edge Function
 * This interface represents the expected shape of the response
 */
interface VisionClaudeEdgeFunctionResponse {
  error?: string
  documentType?: string
  confidence?: number
  customerName?: string
  signed?: boolean
  summary?: string
  rawText?: string
  extractedData?: VisionClaudeResult['extractedData']
}

// Document type to folder/milestone mapping
const DOCUMENT_TYPE_INFO: Record<string, { name: string; folder: string; milestone: string }> = {
  nric_front: { name: 'NRIC Front', folder: 'NRIC', milestone: 'test_drive' },
  nric_back: { name: 'NRIC Back', folder: 'NRIC', milestone: 'test_drive' },
  nric: { name: 'NRIC (Combined)', folder: 'NRIC', milestone: 'test_drive' },
  driving_license: { name: 'Driving License', folder: 'Driving License', milestone: 'test_drive' },
  test_drive_form: { name: 'Test Drive Form', folder: 'Test Drive', milestone: 'test_drive' },
  vsa: { name: 'Vehicle Sales Agreement', folder: 'VSA', milestone: 'close_deal' },
  pdpa: { name: 'PDPA Consent Form', folder: 'PDPA', milestone: 'close_deal' },
  loan_approval: { name: 'Loan Approval Letter', folder: 'Finance', milestone: 'close_deal' },
  loan_application: { name: 'Loan Application', folder: 'Finance', milestone: 'close_deal' },
  insurance_quote: { name: 'Insurance Quote', folder: 'Insurance', milestone: 'registration' },
  insurance_policy: { name: 'Insurance Policy', folder: 'Insurance', milestone: 'registration' },
  insurance_acceptance: {
    name: 'Insurance Acceptance',
    folder: 'Insurance',
    milestone: 'registration',
  },
  payment_proof: { name: 'Payment Proof', folder: 'Payments', milestone: 'registration' },
  delivery_checklist: { name: 'Delivery Checklist', folder: 'Delivery', milestone: 'delivery' },
  registration_card: { name: 'Registration Card', folder: 'Registration', milestone: 'delivery' },
  trade_in_docs: { name: 'Trade-in Documents', folder: 'Trade-In', milestone: 'close_deal' },
  id_documents: { name: 'ID Documents', folder: 'ID Documents', milestone: 'test_drive' },
  other: { name: 'Other Document', folder: 'Other', milestone: 'test_drive' },
}

/**
 * Classify a document using Vision + Claude hybrid OCR
 * Calls the vision-claude-ocr Edge Function
 */
export async function classifyWithVisionClaude(
  imageData: string,
  documentType: 'auto' | 'nric' | 'vsa' | 'trade_in' = 'auto'
): Promise<VisionClaudeResult> {
  const supabase = getSupabase()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to use the document scanner.')
  }

  // Call the Edge Function
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase types error as any
  const { data: rawData, error } =
    await supabase.functions.invoke<VisionClaudeEdgeFunctionResponse>('vision-claude-ocr', {
      body: { imageData, documentType },
    })

  if (error) {
    console.error('Vision-Claude OCR error:', error)
    const errorMessage =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- error is typed as any by Supabase
      'message' in error ? String(error.message) : 'Failed to process document with Vision + Claude'
    throw new Error(errorMessage)
  }

  const data = rawData ?? {}

  if (data.error) {
    throw new Error(data.error)
  }

  // Map the document type to folder/milestone
  const docType = data.documentType ?? 'other'
  const typeInfo = DOCUMENT_TYPE_INFO[docType] ?? DOCUMENT_TYPE_INFO.other

  return {
    documentType: docType,
    documentTypeName: typeInfo.name,
    confidence: data.confidence ?? 50,
    customerName: data.customerName ?? '',
    signed: data.signed ?? false,
    summary: data.summary ?? '',
    rawText: data.rawText ?? '',
    folder: typeInfo.folder,
    milestone: typeInfo.milestone,
    extractedData: data.extractedData ?? {},
    ocrMethod: 'vision-claude',
  }
}

/**
 * Extract text from image using Vision API only (no Claude classification)
 * Used for multi-page PDFs where we extract text from each page first,
 * then combine and classify once at the end
 */
async function extractTextWithVisionOnly(imageData: string): Promise<string> {
  const supabase = getSupabase()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to use the document scanner.')
  }

  // Call the Edge Function with visionOnly=true
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase types error as any
  const { data: rawData, error } =
    await supabase.functions.invoke<VisionClaudeEdgeFunctionResponse>('vision-claude-ocr', {
      body: { imageData, visionOnly: true },
    })

  if (error) {
    console.error('Vision OCR error:', error)
    const errorMessage =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- error is typed as any by Supabase
      'message' in error ? String(error.message) : 'Failed to extract text with Vision API'
    throw new Error(errorMessage)
  }

  const data = rawData ?? {}

  if (data.error) {
    throw new Error(data.error)
  }

  return data.rawText ?? ''
}

/**
 * Classify pre-extracted text using Claude (for Excel files)
 * Skips Vision API and sends text directly to Claude
 */
export async function classifyTextWithClaude(
  rawText: string,
  sourceType: 'excel' | 'text' = 'excel',
  documentType: 'auto' | 'nric' | 'vsa' | 'trade_in' = 'auto'
): Promise<VisionClaudeResult> {
  const supabase = getSupabase()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to use the document scanner.')
  }

  // Call the Edge Function with rawText instead of imageData
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase types error as any
  const { data: edgeData, error } =
    await supabase.functions.invoke<VisionClaudeEdgeFunctionResponse>('vision-claude-ocr', {
      body: { rawText, documentType, sourceType },
    })

  if (error) {
    console.error('Claude classification error:', error)
    const errorMessage =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- error is typed as any by Supabase
      'message' in error ? String(error.message) : 'Failed to classify text with Claude'
    throw new Error(errorMessage)
  }

  const data = edgeData ?? {}

  if (data.error) {
    throw new Error(data.error)
  }

  // Map the document type to folder/milestone
  const docType = data.documentType ?? 'other'
  const typeInfo = DOCUMENT_TYPE_INFO[docType] ?? DOCUMENT_TYPE_INFO.other

  return {
    documentType: docType,
    documentTypeName: typeInfo.name,
    confidence: data.confidence ?? 50,
    customerName: data.customerName ?? '',
    signed: data.signed ?? false,
    summary: data.summary ?? '',
    rawText: data.rawText ?? rawText,
    folder: typeInfo.folder,
    milestone: typeInfo.milestone,
    extractedData: data.extractedData ?? {},
    ocrMethod: 'vision-claude',
  }
}

/**
 * Parse Excel file and classify using Claude AI
 * Extracts text content and sends to Claude for intelligent classification
 */
async function classifyExcelWithClaude(file: File): Promise<VisionClaudeResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          throw new Error('Failed to read Excel file')
        }

        // Parse workbook
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetNames = workbook.SheetNames

        if (sheetNames.length === 0) {
          throw new Error('Excel file has no sheets')
        }

        // Get first sheet
        const firstSheet = workbook.Sheets[sheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 })

        // Get headers (first row) - may contain undefined/null values
        const headers = jsonData[0] ?? []

        // Convert to objects with headers
        const rowsWithHeaders = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet)

        // Get sheet range for dimensions
        const range = XLSX.utils.decode_range(firstSheet['!ref'] ?? 'A1')
        const rowCount = range.e.r - range.s.r + 1
        const columnCount = range.e.c - range.s.c + 1

        // Build text representation for Claude
        // Include filename, headers, and sample data
        const headerStr = headers
          .filter((h) => h != null)
          // eslint-disable-next-line @typescript-eslint/no-base-to-string -- Excel headers can be any type, intentionally converting to string
          .map((h) => String(h))
          .join(', ')
        const sampleRows = rowsWithHeaders
          .slice(0, 30) // Limit to first 30 rows for context
          .map((row) =>
            Object.entries(row)
              .map(([key, val]) => `${key}: ${String(val)}`)
              .join(' | ')
          )
          .join('\n')

        const textForClaude = `Excel File: ${file.name}
Sheets: ${sheetNames.join(', ')}
Dimensions: ${rowCount} rows, ${columnCount} columns

Headers: ${headerStr}

Data Preview:
${sampleRows}`

        console.log(`Sending Excel content to Claude (${textForClaude.length} chars)`)

        // Send to Claude for AI classification
        const claudeResult = await classifyTextWithClaude(textForClaude, 'excel')

        // Enrich with Excel-specific metadata
        const result: VisionClaudeResult = {
          ...claudeResult,
          ocrMethod: 'vision-claude', // Mark as AI-classified (not just local parse)
          excelData: {
            sheetNames,
            rowCount,
            columnCount,
            headers: headers.filter((h): h is string => typeof h === 'string'),
            preview: rowsWithHeaders.slice(0, 10),
          },
        }

        resolve(result)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Classify multi-page PDF using Vision + Claude
 * Converts all pages to images, sends each to Vision API for OCR,
 * combines the text, and sends to Claude for classification
 */
async function classifyPdfWithVisionClaude(file: File): Promise<VisionClaudeResult> {
  // Convert all PDF pages to images
  const pageImages = await convertPdfToImages(file)
  const numPages = pageImages.length

  if (numPages === 0) {
    throw new Error('PDF has no pages')
  }

  // For single page PDFs, use the simple approach
  if (numPages === 1) {
    console.log('Single page PDF, using direct Vision+Claude')
    return await classifyWithVisionClaude(pageImages[0])
  }

  // For multi-page PDFs, process each page with Vision API only (no Claude)
  // This is much more efficient - we only call Claude once at the end
  console.log(
    `Multi-page PDF (${numPages} pages), extracting text from each page with Vision API...`
  )

  const pageTexts: string[] = []

  // Process each page through Vision API only (to get OCR text)
  for (let i = 0; i < pageImages.length; i++) {
    const pageNum = i + 1
    console.log(`Extracting text from page ${pageNum}/${numPages}...`)

    try {
      // Call Vision API only (visionOnly=true) - much faster, no Claude call
      const pageText = await extractTextWithVisionOnly(pageImages[i])
      if (pageText) {
        pageTexts.push(`--- Page ${pageNum} ---\n${pageText}`)
      }

      // Small delay between pages to avoid rate limits
      if (i < pageImages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    } catch (err) {
      console.error(`Failed to extract text from page ${pageNum}:`, err)
      pageTexts.push(`--- Page ${pageNum} ---\n[OCR Failed]`)
    }
  }

  // Combine all page texts
  const combinedText = pageTexts.join('\n\n')
  console.log(`Combined OCR text from ${numPages} pages: ${combinedText.length} chars`)

  // Now send combined text to Claude for final classification
  const finalResult = await classifyTextWithClaude(
    `PDF Document: ${file.name}\nTotal Pages: ${numPages}\n\n${combinedText}`,
    'text'
  )

  return {
    ...finalResult,
    summary: `${numPages}-page PDF: ${finalResult.summary}`,
    ocrMethod: 'vision-claude',
  }
}

/**
 * Classify multiple documents using Vision + Claude
 * Processes sequentially to avoid rate limits
 * Supports images, PDFs, and Excel files
 */
export async function classifyDocumentsWithVisionClaude(
  files: { file: File; name: string }[],
  onProgress?: (
    current: number,
    total: number,
    filename: string,
    result?: VisionClaudeResult
  ) => void
): Promise<{ file: File; name: string; classification: VisionClaudeResult }[]> {
  const results: { file: File; name: string; classification: VisionClaudeResult }[] = []
  const BATCH_DELAY = 300 // 300ms between calls (reduced from 1000ms for faster processing)

  for (let i = 0; i < files.length; i++) {
    const { file, name } = files[i]

    onProgress?.(i + 1, files.length, name)

    try {
      // Check file type
      const isImage = file.type.startsWith('image/')
      const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
      const isExcel = isExcelFile(file)

      if (!isImage && !isPdf && !isExcel) {
        // Skip unsupported files
        const classification: VisionClaudeResult = {
          documentType: 'other',
          documentTypeName: 'Other Document',
          confidence: 0,
          customerName: '',
          signed: false,
          summary: 'Unsupported file type - supports images, PDFs, and Excel files',
          rawText: '',
          folder: 'Other',
          milestone: 'test_drive',
          extractedData: {},
          ocrMethod: 'vision-claude',
        }
        results.push({ file, name, classification })
        onProgress?.(i + 1, files.length, name, classification)
        continue
      }

      let classification: VisionClaudeResult

      if (isExcel) {
        // Parse Excel file and send text to Claude for AI classification
        classification = await classifyExcelWithClaude(file)
      } else if (isPdf) {
        // Convert all PDF pages to images and process with Vision + Claude
        classification = await classifyPdfWithVisionClaude(file)
      } else {
        // Convert image to base64 and use Vision + Claude
        const imageData = await fileToBase64(file)
        classification = await classifyWithVisionClaude(imageData)
      }

      results.push({ file, name, classification })
      onProgress?.(i + 1, files.length, name, classification)

      // Delay between API requests
      if (i < files.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
      }
    } catch (err) {
      console.error(`Failed to classify ${name}:`, err)

      const classification: VisionClaudeResult = {
        documentType: 'other',
        documentTypeName: 'Other Document',
        confidence: 0,
        customerName: '',
        signed: false,
        summary: `Classification failed: ${(err as Error).message}`,
        rawText: '',
        folder: 'Other',
        milestone: 'test_drive',
        extractedData: {},
        ocrMethod: 'vision-claude',
      }
      results.push({ file, name, classification })
      onProgress?.(i + 1, files.length, name, classification)
    }
  }

  return results
}

/**
 * Classify a single document (helper for parallel processing)
 */
async function classifySingleDocument(file: File, name: string): Promise<VisionClaudeResult> {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
  const isExcel = isExcelFile(file)

  if (!isImage && !isPdf && !isExcel) {
    return {
      documentType: 'other',
      documentTypeName: 'Other Document',
      confidence: 0,
      customerName: '',
      signed: false,
      summary: 'Unsupported file type - supports images, PDFs, and Excel files',
      rawText: '',
      folder: 'Other',
      milestone: 'test_drive',
      extractedData: {},
      ocrMethod: 'vision-claude',
    }
  }

  if (isExcel) {
    return await classifyExcelWithClaude(file)
  } else if (isPdf) {
    return await classifyPdfWithVisionClaude(file)
  } else {
    const imageData = await fileToBase64(file)
    return await classifyWithVisionClaude(imageData)
  }
}

/**
 * Classify multiple documents using Vision + Claude with PARALLEL processing
 * Processes documents in batches with configurable concurrency for faster throughput
 * Supports images, PDFs, and Excel files
 */
export async function classifyDocumentsWithVisionClaudeParallel(
  files: { file: File; name: string }[],
  onProgress?: (
    current: number,
    total: number,
    filename: string,
    result?: VisionClaudeResult
  ) => void,
  concurrency = 4
): Promise<{ file: File; name: string; classification: VisionClaudeResult }[]> {
  const results: { file: File; name: string; classification: VisionClaudeResult }[] = []
  let completed = 0

  // Process in chunks of `concurrency` size
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency)

    // Process chunk in parallel
    const chunkResults = await Promise.all(
      chunk.map(async ({ file, name }) => {
        try {
          const classification = await classifySingleDocument(file, name)
          completed++
          onProgress?.(completed, files.length, name, classification)
          return { file, name, classification }
        } catch (err) {
          console.error(`Failed to classify ${name}:`, err)
          completed++
          const classification: VisionClaudeResult = {
            documentType: 'other',
            documentTypeName: 'Other Document',
            confidence: 0,
            customerName: '',
            signed: false,
            summary: `Classification failed: ${(err as Error).message}`,
            rawText: '',
            folder: 'Other',
            milestone: 'test_drive',
            extractedData: {},
            ocrMethod: 'vision-claude',
          }
          onProgress?.(completed, files.length, name, classification)
          return { file, name, classification }
        }
      })
    )

    results.push(...chunkResults)

    // Small delay between batches to avoid overwhelming the API
    if (i + concurrency < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * Extract NRIC information with validation
 * Uses the Vision + Claude Edge Function
 */
export async function extractNricData(file: File): Promise<OcrResult<NricData>> {
  const startTime = Date.now()

  // Convert file to base64
  const imageData = await fileToBase64(file)

  // Call Vision + Claude with NRIC hint
  const result = await classifyWithVisionClaude(imageData, 'nric')

  // Map to NricData structure
  const structuredData: NricData = {
    nric: result.extractedData.nric ?? '',
    name: result.extractedData.name ?? '',
    dateOfBirth: result.extractedData.dateOfBirth ?? '',
    address: result.extractedData.address ?? '',
    validation: {
      nricValid: /^[STFG]\d{7}[A-Z]$/.test(result.extractedData.nric ?? ''),
      ageCalculated: calculateAge(result.extractedData.dateOfBirth),
      confidence: result.confidence >= 80 ? 'high' : result.confidence >= 60 ? 'medium' : 'low',
      issues: result.confidence < 80 ? ['OCR confidence below threshold'] : [],
    },
  }

  return {
    rawText: result.rawText,
    structuredData,
    confidence: result.confidence / 100,
    processingTime: Date.now() - startTime,
  }
}

/**
 * Extract VSA form data with financial validation
 * Uses the Vision + Claude Edge Function
 */
export async function extractVsaFormData(file: File): Promise<OcrResult<VsaFormData>> {
  const startTime = Date.now()

  // Convert file to base64
  const imageData = await fileToBase64(file)

  // Call Vision + Claude with VSA hint
  const result = await classifyWithVisionClaude(imageData, 'vsa')

  // Map to VsaFormData structure
  const sellingPrice = result.extractedData.sellingPrice ?? 0
  const coeAmount = result.extractedData.coeAmount ?? 0
  const deposit = result.extractedData.deposit ?? 0
  const loanAmount = result.extractedData.loanAmount ?? 0
  const calculatedTotal = sellingPrice + coeAmount
  const expectedLoan = calculatedTotal - deposit

  const structuredData: VsaFormData = {
    customerName: result.extractedData.name ?? '',
    nric: result.extractedData.nric ?? '',
    vehicleModel: result.extractedData.vehicleModel ?? '',
    sellingPrice,
    coeAmount,
    deposit,
    loanAmount,
    validation: {
      totalsMatch: Math.abs(loanAmount - expectedLoan) < 1, // Allow $1 rounding
      allFieldsPresent: !!(
        result.extractedData.name &&
        result.extractedData.vehicleModel &&
        sellingPrice > 0
      ),
      calculatedTotal,
      issues: [],
    },
  }

  return {
    rawText: result.rawText,
    structuredData,
    confidence: result.confidence / 100,
    processingTime: Date.now() - startTime,
  }
}

/**
 * Generic document extraction with custom prompt
 * Uses the Vision + Claude Edge Function
 */
export async function extractDocumentData<T = unknown>(
  file: File,
  _documentType: string,
  _customSystemPrompt: string
): Promise<OcrResult<T>> {
  const startTime = Date.now()

  // Convert file to base64
  const imageData = await fileToBase64(file)

  // Call Vision + Claude
  const result = await classifyWithVisionClaude(imageData)

  return {
    rawText: result.rawText,
    structuredData: result.extractedData as T,
    confidence: result.confidence / 100,
    processingTime: Date.now() - startTime,
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string | undefined): number {
  if (!dob) return 0
  try {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  } catch {
    return 0
  }
}

/**
 * Convert a single PDF page to image
 */
async function convertPdfPageToImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 2
): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')

  canvas.width = viewport.width
  canvas.height = viewport.height

  // White background for OCR
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise

  const imageData = canvas.toDataURL('image/png')
  return imageData
}

/**
 * Convert PDF file to images (all pages) for OCR processing
 * Returns array of base64 image data URLs, one per page
 */
async function convertPdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise

  const numPages = pdf.numPages
  const images: string[] = []

  console.log(`PDF has ${numPages} page(s), converting all to images...`)

  for (let i = 1; i <= numPages; i++) {
    const imageData = await convertPdfPageToImage(pdf, i)
    images.push(imageData)
    console.log(`PDF page ${i}/${numPages} converted to image`)
  }

  return images
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File | string): boolean {
  const name = typeof file === 'string' ? file : file.name
  const type = typeof file === 'string' ? '' : file.type
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
}

/**
 * Check if a file is an Excel file
 * Excludes temporary lock files (starting with ~$)
 */
export function isExcelFile(file: File | string): boolean {
  const name = typeof file === 'string' ? file : file.name
  const type = typeof file === 'string' ? '' : file.type
  const lowerName = name.toLowerCase()
  const baseName = name.split('/').pop() ?? name

  // Skip Excel temporary/lock files (created when file is open)
  if (baseName.startsWith('~$')) {
    return false
  }

  return (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsm') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  )
}

/**
 * Parse Excel file and extract data
 * Returns structured data with customer information if found
 */
export async function parseExcelFile(file: File): Promise<VisionClaudeResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          throw new Error('Failed to read Excel file')
        }

        // Parse workbook
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetNames = workbook.SheetNames

        if (sheetNames.length === 0) {
          throw new Error('Excel file has no sheets')
        }

        // Get first sheet
        const firstSheet = workbook.Sheets[sheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 })

        // Get headers (first row) - may contain undefined/null values
        const headers = jsonData[0] ?? []
        // dataRows available if needed: jsonData.slice(1)

        // Convert to objects with headers
        const rowsWithHeaders = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet)

        // Get sheet range for dimensions
        const range = XLSX.utils.decode_range(firstSheet['!ref'] ?? 'A1')
        const rowCount = range.e.r - range.s.r + 1
        const columnCount = range.e.c - range.s.c + 1

        // Convert to text representation for rawText
        const rawText = rowsWithHeaders
          .slice(0, 50) // Limit to first 50 rows
          .map((row) =>
            Object.entries(row)
              .map(([key, val]) => `${key}: ${String(val)}`)
              .join(' | ')
          )
          .join('\n')

        // Try to extract customer information from headers/data
        const extractedData = extractCustomerDataFromExcel(headers, rowsWithHeaders)

        // Determine document type based on content
        const { documentType, confidence } = classifyExcelContent(headers, rawText)
        const typeInfo = DOCUMENT_TYPE_INFO[documentType] || DOCUMENT_TYPE_INFO.other

        resolve({
          documentType,
          documentTypeName: typeInfo.name,
          confidence,
          customerName: extractedData.name ?? '',
          signed: false,
          summary: `Excel file with ${rowCount} rows, ${columnCount} columns across ${sheetNames.length} sheet(s)`,
          rawText,
          folder: typeInfo.folder,
          milestone: typeInfo.milestone,
          extractedData,
          ocrMethod: 'excel-parse',
          excelData: {
            sheetNames,
            rowCount,
            columnCount,
            headers: headers.filter((h): h is string => typeof h === 'string'),
            preview: rowsWithHeaders.slice(0, 10),
          },
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract customer data from Excel headers and rows
 */
function extractCustomerDataFromExcel(
  headers: unknown[],
  rows: Record<string, unknown>[]
): VisionClaudeResult['extractedData'] {
  const result: VisionClaudeResult['extractedData'] = {}

  // Normalize headers for matching - filter out null/undefined values
  const normalizedHeaders = headers.map(
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentionally converting unknown Excel header values to strings
    (h) => (h != null && h !== '' ? String(h).toLowerCase().trim() : '')
  )

  // Common field mappings
  const fieldMappings: Record<string, string[]> = {
    name: ['name', 'customer name', 'customer', 'full name', 'buyer name', 'client name'],
    nric: ['nric', 'ic', 'ic number', 'nric number', 'identification'],
    phone: ['phone', 'mobile', 'contact', 'tel', 'telephone', 'hp', 'handphone', 'contact number'],
    email: ['email', 'e-mail', 'email address'],
    address: ['address', 'home address', 'residential address'],
    vehicleModel: ['vehicle', 'model', 'car model', 'vehicle model', 'car'],
    sellingPrice: ['price', 'selling price', 'amount', 'total', 'sale price'],
  }

  // Find matching columns
  const columnIndexes: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(fieldMappings)) {
    const index = normalizedHeaders.findIndex((h) => {
      if (!h || typeof h !== 'string') return false
      return aliases.some((alias) => h.includes(alias))
    })
    if (index !== -1) {
      columnIndexes[field] = index
    }
  }

  // Extract data from first row with data
  if (rows.length > 0) {
    const firstRow = rows[0]
    const keys = Object.keys(firstRow)

    for (const [field, headerIndex] of Object.entries(columnIndexes)) {
      const key = keys[headerIndex]
      if (key && firstRow[key] !== undefined && firstRow[key] !== null && firstRow[key] !== '') {
        const value = firstRow[key]
        if (field === 'sellingPrice') {
          const numValue =
            typeof value === 'number'
              ? value
              : // eslint-disable-next-line @typescript-eslint/no-base-to-string -- value is from Excel cell, intentionally converting to string
                parseFloat(String(value).replace(/[^0-9.-]/g, ''))
          if (!isNaN(numValue)) {
            result.sellingPrice = numValue
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-base-to-string -- value is from Excel cell, intentionally converting to string
          ;(result as Record<string, unknown>)[field] = String(value)
        }
      }
    }
  }

  return result
}

/**
 * Classify Excel content based on headers and data
 */
function classifyExcelContent(
  headers: unknown[],
  rawText: string
): { documentType: string; confidence: number } {
  // Filter out null/undefined and convert to lowercase
  const lowerHeaders = headers
    .filter((h) => h != null && h !== '')
    .map((h) => String(h).toLowerCase())
  const lowerText = rawText.toLowerCase()

  // Safe includes check helper
  const safeIncludes = (str: string, search: string) =>
    typeof str === 'string' && str.includes(search)

  // Check for customer list indicators
  const hasCustomerFields =
    lowerHeaders.some((h) => safeIncludes(h, 'name') || safeIncludes(h, 'customer')) &&
    lowerHeaders.some(
      (h) =>
        safeIncludes(h, 'nric') ||
        safeIncludes(h, 'ic') ||
        safeIncludes(h, 'phone') ||
        safeIncludes(h, 'contact')
    )

  // Check for vehicle/sales indicators
  const hasVehicleFields =
    lowerHeaders.some(
      (h) => safeIncludes(h, 'vehicle') || safeIncludes(h, 'model') || safeIncludes(h, 'car')
    ) ||
    lowerText.includes('byd') ||
    lowerText.includes('atto') ||
    lowerText.includes('dolphin') ||
    lowerText.includes('seal')

  // Check for financial indicators
  const hasFinancialFields = lowerHeaders.some(
    (h) =>
      safeIncludes(h, 'price') ||
      safeIncludes(h, 'amount') ||
      safeIncludes(h, 'deposit') ||
      safeIncludes(h, 'loan')
  )

  // Check for insurance indicators
  const hasInsuranceFields = lowerHeaders.some(
    (h) => safeIncludes(h, 'insurance') || safeIncludes(h, 'premium') || safeIncludes(h, 'policy')
  )

  // Determine document type
  if (hasInsuranceFields) {
    return { documentType: 'insurance_quote', confidence: 70 }
  }
  if (hasVehicleFields && hasFinancialFields) {
    return { documentType: 'vsa', confidence: 65 }
  }
  if (hasCustomerFields) {
    return { documentType: 'id_documents', confidence: 60 }
  }

  return { documentType: 'other', confidence: 50 }
}
