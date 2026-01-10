/**
 * Template Import Service
 * Handles importing Excel templates from old CRM format to new format
 */

import type { ExcelFieldMappings } from '@/types'

// Old CRM export format types
interface OldFieldMapping {
  fieldType: string
  cellRef: string
  customValue?: string // For _custom field types
}

interface OldExcelTemplate {
  id: string
  name: string
  fieldMappings: Record<string, OldFieldMapping>
  hasMasterFile?: boolean
  masterFileName?: string | null
  driveFileId?: string | null
  createdAt?: string
  updatedAt?: string
}

interface OldExportData {
  version: string
  exportDate: string
  type: 'excel_templates' | 'all_templates' | 'document_templates'
  templates?: OldExcelTemplate[]
  excelTemplates?: OldExcelTemplate[]
}

// Converted template for new CRM
export interface ConvertedTemplate {
  name: string
  field_mappings: ExcelFieldMappings
  sheet_names: string[]
  masterFileBlob?: Blob
  masterFileName?: string
}

export interface ImportResult {
  success: boolean
  templates: ConvertedTemplate[]
  errors: string[]
  skipped: string[]
}

/**
 * Parse cell reference to extract sheet name and cell
 * Supports formats: "A1", "Sheet1!A1"
 */
function parseCellRef(cellRef: string): { sheet: string; cell: string } {
  if (cellRef.includes('!')) {
    const [sheet, cell] = cellRef.split('!')
    return { sheet, cell: cell.toUpperCase() }
  }
  // Default to "Sheet1" if no sheet specified
  return { sheet: 'Sheet1', cell: cellRef.toUpperCase() }
}

/**
 * Convert old field mappings format to new format
 * Old: { "mapping_123": { fieldType: "name", cellRef: "Sheet1!A1" } }
 * New: { "Sheet1": { "A1": "name" } }
 *
 * For custom values:
 * Old: { fieldType: "_custom", cellRef: "A1", customValue: "Some Text" }
 * New: { "Sheet1": { "A1": "_custom:Some Text" } }
 */
function convertFieldMappings(oldMappings: Record<string, OldFieldMapping>): ExcelFieldMappings {
  const newMappings: ExcelFieldMappings = {}

  for (const mapping of Object.values(oldMappings)) {
    if (!mapping.fieldType || !mapping.cellRef) continue

    const { sheet, cell } = parseCellRef(mapping.cellRef)

    if (!newMappings[sheet]) {
      newMappings[sheet] = {}
    }

    // Handle custom values
    if (mapping.fieldType === '_custom' && mapping.customValue) {
      newMappings[sheet][cell] = `_custom:${mapping.customValue}`
    } else {
      newMappings[sheet][cell] = mapping.fieldType
    }
  }

  return newMappings
}

/**
 * Extract unique sheet names from field mappings
 */
function extractSheetNames(mappings: ExcelFieldMappings): string[] {
  return Object.keys(mappings)
}

/**
 * Parse import file (JSON or ZIP)
 */
export async function parseImportFile(file: File): Promise<OldExportData> {
  if (file.name.endsWith('.zip')) {
    return parseZipFile(file)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        resolve(data)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Parse ZIP file containing templates and master files
 */
async function parseZipFile(
  file: File
): Promise<OldExportData & { _masterFiles?: Record<string, { blob: Blob; filename: string }> }> {
  // Dynamically import JSZip
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const zipContent = await zip.loadAsync(file)

  let manifest: OldExportData | null = null
  const masterFiles: Record<string, { blob: Blob; filename: string }> = {}

  // Try to read manifest.json
  if (zipContent.files['manifest.json']) {
    const manifestContent = await zipContent.files['manifest.json'].async('text')
    manifest = JSON.parse(manifestContent)
  }

  // Extract Excel master files
  const excelFiles = Object.keys(zipContent.files).filter(
    (f) => f.startsWith('excel_master_files/') && !zipContent.files[f].dir
  )

  for (const filepath of excelFiles) {
    const filename = filepath.replace('excel_master_files/', '')
    // Extract template ID from filename (format: templateId__originalFileName)
    const separatorIndex = filename.indexOf('__')
    if (separatorIndex > 0) {
      const templateId = filename.substring(0, separatorIndex)
      const blob = await zipContent.files[filepath].async('blob')
      masterFiles[templateId] = {
        blob,
        filename: filename.substring(separatorIndex + 2),
      }
    }
  }

  // If no manifest, try to find any JSON file
  if (!manifest) {
    const jsonFiles = Object.keys(zipContent.files).filter(
      (f) => f.endsWith('.json') && !f.includes('/') && !zipContent.files[f].dir
    )

    if (jsonFiles.length > 0) {
      const firstJson = await zipContent.files[jsonFiles[0]].async('text')
      manifest = JSON.parse(firstJson)
    }
  }

  if (!manifest) {
    throw new Error('No valid template manifest found in ZIP file')
  }

  return {
    ...manifest,
    _masterFiles: masterFiles,
  }
}

/**
 * Validate import data
 */
export function validateImportData(data: OldExportData): boolean {
  if (!data.version || !data.type) {
    throw new Error('Invalid template file: Missing version or type')
  }

  if (!['document_templates', 'excel_templates', 'all_templates'].includes(data.type)) {
    throw new Error('Invalid template file: Unknown type')
  }

  return true
}

/**
 * Convert old CRM templates to new format
 */
export function convertTemplates(
  data: OldExportData & { _masterFiles?: Record<string, { blob: Blob; filename: string }> }
): ImportResult {
  const result: ImportResult = {
    success: true,
    templates: [],
    errors: [],
    skipped: [],
  }

  // Get Excel templates from the data
  let oldTemplates: OldExcelTemplate[] = []

  if (data.type === 'excel_templates' && data.templates) {
    oldTemplates = data.templates
  } else if (data.type === 'all_templates' && data.excelTemplates) {
    oldTemplates = data.excelTemplates
  } else {
    result.errors.push('No Excel templates found in import file')
    result.success = false
    return result
  }

  for (const oldTemplate of oldTemplates) {
    try {
      // Convert field mappings
      const fieldMappings = convertFieldMappings(oldTemplate.fieldMappings ?? {})
      const sheetNames = extractSheetNames(fieldMappings)

      const convertedTemplate: ConvertedTemplate = {
        name: oldTemplate.name,
        field_mappings: fieldMappings,
        sheet_names: sheetNames,
      }

      // Attach master file if available
      if (data._masterFiles?.[oldTemplate.id]) {
        convertedTemplate.masterFileBlob = data._masterFiles[oldTemplate.id].blob
        convertedTemplate.masterFileName = data._masterFiles[oldTemplate.id].filename
      }

      result.templates.push(convertedTemplate)
    } catch (err) {
      result.errors.push(`Failed to convert "${oldTemplate.name}": ${(err as Error).message}`)
    }
  }

  if (result.templates.length === 0 && result.errors.length > 0) {
    result.success = false
  }

  return result
}

/**
 * Main import function
 */
export async function importTemplatesFromFile(file: File): Promise<ImportResult> {
  try {
    const data = await parseImportFile(file)
    validateImportData(data)
    return convertTemplates(data)
  } catch (err) {
    return {
      success: false,
      templates: [],
      errors: [(err as Error).message],
      skipped: [],
    }
  }
}
