/**
 * Bulk Document Import Service
 *
 * Handles mass import of mixed documents (images, PDFs, Excel) with:
 * - Automatic OCR and classification
 * - Customer matching
 * - Intelligent file renaming
 * - Folder organization
 *
 * Process Flow:
 * 1. Scan files → 2. Extract/OCR → 3. Classify → 4. Match customer →
 * 5. Rename → 6. Organize → 7. Upload
 */

import type { Customer } from '@/types';
import { extractNricData, extractVsaFormData, extractDocumentData } from './intelligentOcrService';
import { parseExcelFile } from './excelService';

// ==================== TYPES ====================

export interface FileToProcess {
  file: File;
  originalName: string;
  fileType: 'image' | 'pdf' | 'excel' | 'unsupported';
  extension: string;
}

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  extractedData: ExtractedDocumentData;
  rawText?: string;
}

export interface ExtractedDocumentData {
  nric?: string;
  name?: string;
  phone?: string;
  email?: string;
  vehicleModel?: string;
  dateOfBirth?: string;
  address?: string;
  // VSA specific
  sellingPrice?: number;
  coeAmount?: number;
  deposit?: number;
  loanAmount?: number;
  // Trade-in specific
  tradeInCarPlate?: string;
  tradeInModel?: string;
  tradeInAmount?: number;
  // Document metadata
  documentDate?: string;
  [key: string]: any;
}

export interface CustomerMatch {
  customerId: string | null;
  customer: Customer | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchType: 'nric_exact' | 'name_fuzzy' | 'contact' | 'no_match';
  similarity?: number;
  suggestedAction: 'auto_attach' | 'review' | 'create_customer' | 'skip';
  suggestedCustomerData?: Partial<Customer>;
}

export interface ProcessedDocument {
  id: string;
  file: File;
  originalName: string;
  newFileName: string;
  classification: DocumentClassification;
  customerMatch: CustomerMatch;
  targetFolder: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'review_needed';
  error?: string;
}

export interface BulkImportProgress {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  needsReview: number;
  failed: number;
  currentFile?: string;
}

export type DocumentType =
  | 'nric'
  | 'passport'
  | 'drivers_license'
  | 'vsa_form'
  | 'trade_in'
  | 'insurance'
  | 'registration'
  | 'coe_document'
  | 'bank_loan'
  | 'delivery_order'
  | 'customer_list'
  | 'proposal'
  | 'miscellaneous'
  | 'unknown';

// ==================== CONSTANTS ====================

const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic'];
const SUPPORTED_PDF_EXTENSIONS = ['.pdf'];
const SUPPORTED_EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

const DOCUMENT_TYPE_FOLDERS: Record<DocumentType, string> = {
  nric: 'identity',
  passport: 'identity',
  drivers_license: 'identity',
  vsa_form: 'vsa',
  trade_in: 'trade_in',
  insurance: 'insurance',
  registration: 'registration',
  coe_document: 'registration',
  bank_loan: 'vsa',
  delivery_order: 'delivery',
  customer_list: 'imports',
  proposal: 'vsa',
  miscellaneous: 'miscellaneous',
  unknown: 'miscellaneous',
};

const DOCUMENT_TYPE_PREFIXES: Record<DocumentType, string> = {
  nric: 'NRIC',
  passport: 'Passport',
  drivers_license: 'License',
  vsa_form: 'VSA',
  trade_in: 'TradeIn',
  insurance: 'Insurance',
  registration: 'Registration',
  coe_document: 'COE',
  bank_loan: 'Loan',
  delivery_order: 'Delivery',
  customer_list: 'CustomerList',
  proposal: 'Proposal',
  miscellaneous: 'Document',
  unknown: 'Unknown',
};

// ==================== FILE SCANNING ====================

export function scanFiles(files: File[]): FileToProcess[] {
  return files.map((file) => {
    const extension = getFileExtension(file.name).toLowerCase();
    let fileType: FileToProcess['fileType'];

    if (SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      fileType = 'image';
    } else if (SUPPORTED_PDF_EXTENSIONS.includes(extension)) {
      fileType = 'pdf';
    } else if (SUPPORTED_EXCEL_EXTENSIONS.includes(extension)) {
      fileType = 'excel';
    } else {
      fileType = 'unsupported';
    }

    return {
      file,
      originalName: file.name,
      fileType,
      extension,
    };
  });
}

export function filterSupportedFiles(scannedFiles: FileToProcess[]): {
  supported: FileToProcess[];
  unsupported: FileToProcess[];
} {
  const supported = scannedFiles.filter((f) => f.fileType !== 'unsupported');
  const unsupported = scannedFiles.filter((f) => f.fileType === 'unsupported');
  return { supported, unsupported };
}

// ==================== DOCUMENT CLASSIFICATION ====================

export async function classifyDocument(
  fileToProcess: FileToProcess
): Promise<DocumentClassification> {
  const { file, fileType } = fileToProcess;

  if (fileType === 'excel') {
    return await classifyExcelDocument(file);
  }

  if (fileType === 'image' || fileType === 'pdf') {
    return await classifyImageOrPdfDocument(file);
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

async function classifyImageOrPdfDocument(file: File): Promise<DocumentClassification> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Try specific extractors first (higher accuracy)

  // Try NRIC extraction
  try {
    const result = await extractNricData(buffer);
    if (result.structuredData.validation.confidence === 'high') {
      return {
        documentType: 'nric',
        confidence: result.confidence,
        extractedData: {
          nric: result.structuredData.nric,
          name: result.structuredData.name,
          dateOfBirth: result.structuredData.dateOfBirth,
          address: result.structuredData.address,
        },
        rawText: result.rawText,
      };
    }
  } catch (err) {
    // Not an NRIC, try next
  }

  // Try VSA form extraction
  try {
    const result = await extractVsaFormData(buffer);
    if (result.structuredData.validation.allFieldsPresent) {
      return {
        documentType: 'vsa_form',
        confidence: result.confidence,
        extractedData: {
          name: result.structuredData.customerName,
          nric: result.structuredData.nric,
          vehicleModel: result.structuredData.vehicleModel,
          sellingPrice: result.structuredData.sellingPrice,
          coeAmount: result.structuredData.coeAmount,
          deposit: result.structuredData.deposit,
          loanAmount: result.structuredData.loanAmount,
        },
        rawText: result.rawText,
      };
    }
  } catch (err) {
    // Not a VSA form, try generic classification
  }

  // Generic document classification
  const genericResult = await extractDocumentData<any>(
    buffer,
    'unknown',
    getGenericClassificationPrompt()
  );

  return {
    documentType: genericResult.structuredData.documentType || 'unknown',
    confidence: genericResult.confidence,
    extractedData: genericResult.structuredData,
    rawText: genericResult.rawText,
  };
}

async function classifyExcelDocument(file: File): Promise<DocumentClassification> {
  // Parse Excel file
  const sheets = await parseExcelFile(file);

  // For now, simple heuristic - would expand with xlsx-populate cell reading
  // In real implementation, read cells to detect VSA template vs customer list

  return {
    documentType: 'vsa_form', // Placeholder
    confidence: 0.7,
    extractedData: {
      // Would extract from Excel cells
    },
  };
}

function getGenericClassificationPrompt(): string {
  return `Analyze this document and extract key information.

Determine the document type from these options:
- nric: Singapore NRIC card
- passport: Passport
- drivers_license: Driver's license
- vsa_form: Vehicle Sales Agreement
- trade_in: Trade-in valuation document
- insurance: Insurance certificate
- registration: Vehicle registration
- coe_document: COE related document
- bank_loan: Bank loan approval
- delivery_order: Vehicle delivery order
- proposal: Sales proposal/quotation
- miscellaneous: Other document
- unknown: Cannot determine

Extract any visible:
- NRIC numbers
- Names
- Phone numbers
- Email addresses
- Vehicle details
- Dates
- Amounts

Return JSON:
{
  "documentType": "type_here",
  "nric": "if found",
  "name": "if found",
  "phone": "if found",
  "email": "if found",
  "vehicleModel": "if found",
  "confidence": 0.0-1.0
}`;
}

// ==================== CUSTOMER MATCHING ====================

export async function matchDocumentToCustomer(
  extractedData: ExtractedDocumentData,
  customers: Customer[]
): Promise<CustomerMatch> {
  // 1. Exact NRIC match (highest priority)
  if (extractedData.nric) {
    const exactMatch = customers.find((c) => c.nric === extractedData.nric);
    if (exactMatch) {
      return {
        customerId: exactMatch.id,
        customer: exactMatch,
        confidence: 'high',
        matchType: 'nric_exact',
        suggestedAction: 'auto_attach',
      };
    }
  }

  // 2. Fuzzy name match
  if (extractedData.name) {
    const nameMatches = customers
      .map((c) => ({
        customer: c,
        similarity: calculateStringSimilarity(
          extractedData.name!.toLowerCase(),
          c.name.toLowerCase()
        ),
      }))
      .filter((m) => m.similarity > 0.85)
      .sort((a, b) => b.similarity - a.similarity);

    if (nameMatches.length > 0) {
      const bestMatch = nameMatches[0];
      return {
        customerId: bestMatch.customer.id,
        customer: bestMatch.customer,
        confidence: bestMatch.similarity > 0.95 ? 'high' : 'medium',
        matchType: 'name_fuzzy',
        similarity: bestMatch.similarity,
        suggestedAction: bestMatch.similarity > 0.95 ? 'auto_attach' : 'review',
      };
    }
  }

  // 3. Contact match (phone/email)
  if (extractedData.phone || extractedData.email) {
    const contactMatch = customers.find(
      (c) =>
        (extractedData.phone && c.phone === extractedData.phone) ||
        (extractedData.email && c.email === extractedData.email)
    );

    if (contactMatch) {
      return {
        customerId: contactMatch.id,
        customer: contactMatch,
        confidence: 'medium',
        matchType: 'contact',
        suggestedAction: 'review',
      };
    }
  }

  // 4. No match - suggest creating new customer
  return {
    customerId: null,
    customer: null,
    confidence: 'none',
    matchType: 'no_match',
    suggestedAction: 'create_customer',
    suggestedCustomerData: {
      name: extractedData.name || '',
      nric: extractedData.nric || '',
      phone: extractedData.phone || '',
      email: extractedData.email || '',
      address: extractedData.address || '',
      dob: extractedData.dateOfBirth || '',
    },
  };
}

// ==================== FILE NAMING ====================

export function generateFileName(
  classification: DocumentClassification,
  customerMatch: CustomerMatch,
  originalExtension: string
): string {
  const { documentType, extractedData } = classification;

  // Get prefix
  const prefix = DOCUMENT_TYPE_PREFIXES[documentType] || 'Document';

  // Get identifier (NRIC or ID number)
  const identifier = extractedData.nric || extractedData.phone || 'NoID';

  // Get name (sanitized)
  const name = extractedData.name
    ? sanitizeForFilename(extractedData.name)
    : customerMatch.customer
    ? sanitizeForFilename(customerMatch.customer.name)
    : 'Unknown';

  // Get date
  const date = formatDateForFilename(new Date());

  // Combine
  return `${prefix}_${identifier}_${name}_${date}${originalExtension}`;
}

function sanitizeForFilename(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function getTargetFolder(documentType: DocumentType): string {
  return DOCUMENT_TYPE_FOLDERS[documentType] || 'miscellaneous';
}

// ==================== BATCH PROCESSING ====================

export async function processBulkDocuments(
  files: File[],
  customers: Customer[],
  onProgress?: (progress: BulkImportProgress) => void
): Promise<ProcessedDocument[]> {
  const scannedFiles = scanFiles(files);
  const { supported, unsupported } = filterSupportedFiles(scannedFiles);

  const processedDocuments: ProcessedDocument[] = [];
  let completedCount = 0;

  for (const fileToProcess of supported) {
    const id = generateId();

    // Update progress
    if (onProgress) {
      onProgress({
        total: supported.length,
        completed: completedCount,
        processing: 1,
        pending: supported.length - completedCount - 1,
        needsReview: processedDocuments.filter((d) => d.status === 'review_needed').length,
        failed: processedDocuments.filter((d) => d.status === 'failed').length,
        currentFile: fileToProcess.originalName,
      });
    }

    try {
      // Classify document
      const classification = await classifyDocument(fileToProcess);

      // Match to customer
      const customerMatch = await matchDocumentToCustomer(classification.extractedData, customers);

      // Generate new filename
      const newFileName = generateFileName(
        classification,
        customerMatch,
        fileToProcess.extension
      );

      // Determine target folder
      const targetFolder = getTargetFolder(classification.documentType);

      // Determine status
      let status: ProcessedDocument['status'] = 'completed';
      if (classification.confidence < 0.7) {
        status = 'review_needed';
      } else if (customerMatch.suggestedAction === 'review') {
        status = 'review_needed';
      }

      processedDocuments.push({
        id,
        file: fileToProcess.file,
        originalName: fileToProcess.originalName,
        newFileName,
        classification,
        customerMatch,
        targetFolder,
        status,
      });

      completedCount++;
    } catch (error) {
      processedDocuments.push({
        id,
        file: fileToProcess.file,
        originalName: fileToProcess.originalName,
        newFileName: fileToProcess.originalName,
        classification: {
          documentType: 'unknown',
          confidence: 0,
          extractedData: {},
        },
        customerMatch: {
          customerId: null,
          customer: null,
          confidence: 'none',
          matchType: 'no_match',
          suggestedAction: 'skip',
        },
        targetFolder: 'miscellaneous',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      completedCount++;
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: supported.length,
      completed: completedCount,
      processing: 0,
      pending: 0,
      needsReview: processedDocuments.filter((d) => d.status === 'review_needed').length,
      failed: processedDocuments.filter((d) => d.status === 'failed').length,
    });
  }

  return processedDocuments;
}

// ==================== HELPER FUNCTIONS ====================

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Levenshtein distance based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
