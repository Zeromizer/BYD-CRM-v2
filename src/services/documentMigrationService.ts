/**
 * Document Migration Service
 * Migrates documents from old BYD-CRM folder structure to new CRM Supabase storage
 */

import { uploadCustomerDocument } from './customerDocumentService'
import { getSupabase } from '@/lib/supabase'
import { debug } from '@/utils/debug'
import type { Customer, DocumentChecklistState } from '@/types'

// Map of old folder names/file patterns to new document types
const DOCUMENT_TYPE_MAPPING: Record<string, string> = {
  // NRIC folder
  nric: 'nric',
  id_front: 'nric_front',
  id_back: 'nric_back',
  'id documents': 'nric',

  // Driving License folder
  'driving license': 'driving_license',
  license: 'driving_license',
  licence: 'driving_license',

  // VSA folder
  vsa: 'vsa',
  'vsa signed': 'vsa',
  'vsa form': 'vsa',

  // Test Drive
  'test drive': 'test_drive_form',
  test_drive: 'test_drive_form',

  // Insurance
  insurance: 'insurance_quote',
  'insurance quote': 'insurance_quote',
  'insurance proposal': 'insurance_policy',
  'insurance delivery': 'insurance_policy',

  // Delivery
  'delivery checklist': 'delivery_checklist',
  delivery: 'delivery_checklist',

  // Performa Invoice
  performa: 'payment_proof',
  'performa invoice': 'payment_proof',
  invoice: 'payment_proof',

  // Finance
  finance: 'loan_approval',
  loan: 'loan_approval',

  // Declaration
  declaration: 'insurance_cancellation',

  // Multiple documents / other
  multiple: 'other',
  other: 'other',
}

// Milestone mapping for document types
const DOCUMENT_MILESTONE_MAPPING: Record<string, string> = {
  nric: 'test_drive',
  nric_front: 'test_drive',
  nric_back: 'test_drive',
  driving_license: 'test_drive',
  test_drive_form: 'test_drive',
  vsa: 'close_deal',
  pdpa: 'close_deal',
  coe_bidding: 'close_deal',
  loan_approval: 'close_deal',
  trade_in_docs: 'close_deal',
  insurance_quote: 'registration',
  insurance_acceptance: 'registration',
  payment_proof: 'registration',
  insurance_policy: 'registration',
  delivery_checklist: 'delivery',
  insurance_cancellation: 'delivery',
  registration_card: 'delivery',
  other: 'test_drive',
}

/**
 * Detect document type from filename or folder name
 */
function detectDocumentType(filename: string, folderName?: string): string {
  const lowerFilename = filename.toLowerCase()
  const lowerFolder = (folderName ?? '').toLowerCase()

  // Check folder name first
  for (const [pattern, docType] of Object.entries(DOCUMENT_TYPE_MAPPING)) {
    if (lowerFolder.includes(pattern)) {
      return docType
    }
  }

  // Check filename patterns
  for (const [pattern, docType] of Object.entries(DOCUMENT_TYPE_MAPPING)) {
    if (
      lowerFilename.includes(pattern.replace(' ', '_')) ||
      lowerFilename.includes(pattern.replace(' ', '-')) ||
      lowerFilename.includes(pattern)
    ) {
      return docType
    }
  }

  // Default based on file extension
  if (lowerFilename.endsWith('.pdf')) {
    return 'other'
  }
  if (/\.(jpg|jpeg|png|gif|webp)$/i.exec(lowerFilename)) {
    return 'nric' // Most images are ID documents
  }

  return 'other'
}

/**
 * Get milestone for a document type
 */
function getMilestoneForDocType(docType: string): string {
  return DOCUMENT_MILESTONE_MAPPING[docType] || 'test_drive'
}

export interface MigrationFile {
  name: string
  path: string
  folder?: string
  file?: File
}

export interface MigrationResult {
  success: boolean
  uploaded: number
  failed: number
  errors: string[]
  uploadedFiles: {
    filename: string
    documentType: string
    milestone: string
  }[]
}

// Extended migration file with optional document type
interface MigrationFileWithType extends MigrationFile {
  documentType?: string
}

// Upload result interface
interface UploadedDocument {
  id: string
  name: string
  uploadedAt: string
}

interface UploadResult {
  success: boolean
  doc?: UploadedDocument
  error?: string
  documentType: string
  milestone: string
}

/**
 * Upload a single file with timeout
 */
async function uploadSingleFile(
  migrationFile: MigrationFile,
  customerName: string,
  timeoutMs = 60000
): Promise<UploadResult> {
  const fileWithType = migrationFile as MigrationFileWithType
  const documentType =
    fileWithType.documentType ?? detectDocumentType(migrationFile.name, migrationFile.folder)
  const milestone = getMilestoneForDocType(documentType)

  if (!migrationFile.file) {
    return { success: false, error: 'No file data', documentType, milestone }
  }

  try {
    const uploadPromise = uploadCustomerDocument(documentType, migrationFile.file, customerName)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timed out')), timeoutMs)
    })

    const uploadedDoc = (await Promise.race([uploadPromise, timeoutPromise])) as UploadedDocument
    debug.log(`[Migration] Upload complete: ${migrationFile.name}`)
    return { success: true, doc: uploadedDoc, documentType, milestone }
  } catch (err) {
    debug.error(`[Migration] Failed: ${migrationFile.name}:`, err)
    return { success: false, error: (err as Error).message, documentType, milestone }
  }
}

/**
 * Migrate documents for a customer with parallel uploads
 * This function takes pre-loaded files (since we can't access local filesystem from browser)
 */
export async function migrateCustomerDocuments(
  customer: Customer,
  files: MigrationFile[],
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<MigrationResult> {
  // Refresh session before starting uploads to ensure valid token
  // This is important after AI classification which can take time
  debug.log('[Migration] Refreshing session before uploads...')
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      debug.warn('[Migration] Session refresh warning:', refreshError.message)
    } else {
      debug.log('[Migration] Session refreshed successfully')
    }
  } else {
    debug.error('[Migration] No session found!')
    throw new Error('Not authenticated. Please sign in again.')
  }

  const result: MigrationResult = {
    success: true,
    uploaded: 0,
    failed: 0,
    errors: [],
    uploadedFiles: [],
  }

  const currentChecklist: DocumentChecklistState = customer.document_checklist || {
    test_drive: {},
    close_deal: {},
    registration: {},
    delivery: {},
    nps: {},
  }

  const UPLOAD_TIMEOUT = 60000 // 60 seconds per file
  const CONCURRENCY = 3 // Upload 3 files at a time

  // Process files in batches
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)
    const batchNames = batch.map((f) => f.name).join(', ')

    onProgress?.(i + 1, files.length, batchNames)
    debug.log(`[Migration] Uploading batch ${Math.floor(i / CONCURRENCY) + 1}: ${batchNames}`)

    // Upload batch in parallel
    const batchPromises = batch.map((file) => uploadSingleFile(file, customer.name, UPLOAD_TIMEOUT))
    const batchResults = await Promise.all(batchPromises)

    // Process results
    for (let j = 0; j < batchResults.length; j++) {
      const uploadResult = batchResults[j]
      const migrationFile = batch[j]

      if (uploadResult.success && uploadResult.doc) {
        // Update checklist structure
        const milestone = uploadResult.milestone as keyof DocumentChecklistState
        if (!currentChecklist[milestone]) {
          currentChecklist[milestone] = {}
        }

        const milestoneChecklist = currentChecklist[milestone]
        const existingItem = milestoneChecklist[uploadResult.documentType]

        const newFileEntry = {
          fileId: uploadResult.doc.id,
          fileName: uploadResult.doc.name,
          uploadedAt: uploadResult.doc.uploadedAt,
        }

        if (existingItem?.uploadedFiles) {
          existingItem.uploadedFiles.push(newFileEntry)
          existingItem.status = 'uploaded'
          existingItem.uploadedAt = new Date().toISOString()
        } else {
          milestoneChecklist[uploadResult.documentType] = {
            status: 'uploaded',
            uploadedAt: new Date().toISOString(),
            uploadedFiles: [newFileEntry],
            reviewedAt: null,
            reviewedBy: null,
            notes: `Migrated from old CRM: ${migrationFile.path}`,
          }
        }

        result.uploaded++
        result.uploadedFiles.push({
          filename: migrationFile.name,
          documentType: uploadResult.documentType,
          milestone: uploadResult.milestone,
        })
      } else {
        result.errors.push(`${migrationFile.name}: ${uploadResult.error ?? 'Unknown error'}`)
        result.failed++
      }

      // Report progress for each file in batch
      onProgress?.(i + j + 1, files.length, migrationFile.name)
    }

    // Small delay between batches
    if (i + CONCURRENCY < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  result.success = result.failed === 0

  return {
    ...result,
    // Return the updated checklist so it can be saved
    updatedChecklist: currentChecklist,
  } as MigrationResult & { updatedChecklist: DocumentChecklistState }
}

/**
 * Helper to create File objects from file input
 */
export function createMigrationFiles(fileList: FileList, _basePath = ''): MigrationFile[] {
  const files: MigrationFile[] = []

  for (const file of Array.from(fileList)) {
    // webkitRelativePath contains the folder structure (empty string if not set)

    const relativePath: string = file.webkitRelativePath || file.name
    const pathParts: string[] = relativePath.split('/')
    const folder: string | undefined =
      pathParts.length > 1 ? pathParts[pathParts.length - 2] : undefined

    files.push({
      name: file.name,
      path: relativePath,
      folder,
      file,
    })
  }

  return files
}

/**
 * Filter files to only include supported document types
 */
export function filterSupportedFiles(files: MigrationFile[]): MigrationFile[] {
  const supportedExtensions = [
    // Images
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.tiff',
    '.tif',
    // Documents
    '.pdf',
    // Excel
    '.xls',
    '.xlsx',
    '.xlsm',
    '.ods',
    // Video
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.m4v',
  ]

  return files.filter((f) => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    return supportedExtensions.includes(ext)
  })
}
