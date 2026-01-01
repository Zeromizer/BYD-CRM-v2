/**
 * Document Classifier Service
 * Uses Gemini 2.5 Flash AI to classify scanned documents
 * Identifies document type, extracts customer name, suggests folder placement
 */

import { supabase } from '@/lib/supabase';

// Document types that can be classified
export const DOCUMENT_TYPES = {
  nric_front: { id: 'nric_front', name: 'NRIC Front', folder: 'NRIC', milestone: 'test_drive' },
  nric_back: { id: 'nric_back', name: 'NRIC Back', folder: 'NRIC', milestone: 'test_drive' },
  nric: { id: 'nric', name: 'NRIC (Combined)', folder: 'NRIC', milestone: 'test_drive' },
  driving_license: { id: 'driving_license', name: 'Driving License', folder: 'Driving License', milestone: 'test_drive' },
  test_drive_form: { id: 'test_drive_form', name: 'Test Drive Form', folder: 'Test Drive', milestone: 'test_drive' },
  vsa: { id: 'vsa', name: 'Vehicle Sales Agreement', folder: 'VSA', milestone: 'close_deal' },
  pdpa: { id: 'pdpa', name: 'PDPA Consent Form', folder: 'PDPA', milestone: 'close_deal' },
  loan_approval: { id: 'loan_approval', name: 'Loan Approval Letter', folder: 'Finance', milestone: 'close_deal' },
  loan_application: { id: 'loan_application', name: 'Loan Application', folder: 'Finance', milestone: 'close_deal' },
  insurance_quote: { id: 'insurance_quote', name: 'Insurance Quote', folder: 'Insurance', milestone: 'registration' },
  insurance_policy: { id: 'insurance_policy', name: 'Insurance Policy', folder: 'Insurance', milestone: 'registration' },
  insurance_acceptance: { id: 'insurance_acceptance', name: 'Insurance Acceptance', folder: 'Insurance', milestone: 'registration' },
  payment_proof: { id: 'payment_proof', name: 'Payment Proof', folder: 'Payments', milestone: 'registration' },
  delivery_checklist: { id: 'delivery_checklist', name: 'Delivery Checklist', folder: 'Delivery', milestone: 'delivery' },
  registration_card: { id: 'registration_card', name: 'Registration Card', folder: 'Registration', milestone: 'delivery' },
  trade_in_docs: { id: 'trade_in_docs', name: 'Trade-in Documents', folder: 'Trade-In', milestone: 'close_deal' },
  id_documents: { id: 'id_documents', name: 'ID Documents (Multiple)', folder: 'ID Documents', milestone: 'test_drive' },
  other: { id: 'other', name: 'Other Document', folder: 'Other', milestone: 'test_drive' },
} as const;

export type DocumentTypeId = keyof typeof DOCUMENT_TYPES;

export interface ClassificationResult {
  documentType: DocumentTypeId;
  documentTypeName: string;
  confidence: number;
  folder: string;
  milestone: string;
  customerName: string;
  suggestedFilename: string;
  summary: string;
  signed: boolean;
}

export interface ProcessingProgress {
  stage: string;
  progress: number;
}

/**
 * Convert File to base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Classify a single document using Gemini AI
 */
export async function classifyDocument(
  imageData: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ClassificationResult> {
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  onProgress?.({ stage: 'Analyzing document...', progress: 10 });

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Please sign in to use the document scanner.');
  }

  onProgress?.({ stage: 'Processing with AI...', progress: 30 });

  console.log('Calling classify-document Edge Function...');
  console.log('Image data size:', imageData.length, 'chars');

  // Add timeout to prevent hanging
  const timeoutMs = 20000; // 20 seconds timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Classification timed out. Please try again.')), timeoutMs);
  });

  const classifyPromise = supabase.functions.invoke('classify-document', {
    body: { imageData },
  });

  const { data, error } = await Promise.race([classifyPromise, timeoutPromise]);

  console.log('Edge Function response:', { data, error });

  onProgress?.({ stage: 'Parsing results...', progress: 80 });

  if (error) {
    console.error('Document classification error:', error);
    throw new Error(error.message || 'Failed to classify document. Please try again.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  onProgress?.({ stage: 'Complete', progress: 100 });

  // Map the result to our type structure
  const docType = DOCUMENT_TYPES[data?.documentType as DocumentTypeId] || DOCUMENT_TYPES.other;

  return {
    documentType: (data?.documentType || 'other') as DocumentTypeId,
    documentTypeName: docType.name,
    confidence: data?.confidence || 50,
    folder: docType.folder,
    milestone: docType.milestone,
    customerName: data?.customerName || '',
    suggestedFilename: data?.suggestedFilename || '',
    summary: data?.summary || '',
    signed: data?.signed || false,
  };
}

/**
 * Classify a single file (helper for parallel processing)
 * Includes timeout for the entire operation including base64 conversion
 */
async function classifySingleFile(
  file: File,
  name: string
): Promise<{ file: File; name: string; classification: ClassificationResult }> {
  console.log(`[classifySingleFile] Starting: ${name}, type: ${file.type}, size: ${file.size}`);

  // 30 second timeout per file
  const TOTAL_TIMEOUT = 30000;
  console.log(`[classifySingleFile] Timeout: 30s, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);

  const classifyWithTimeout = async (): Promise<ClassificationResult> => {
    // Check if it's a supported file type
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    const lowerName = name.toLowerCase();
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel' ||
                    lowerName.endsWith('.xlsx') ||
                    lowerName.endsWith('.xls');

    // Excel files - classify based on filename since AI can't read them
    if (isExcel) {
      let docType: DocumentTypeId = 'other';
      let docTypeName = 'Other Document';
      let folder = 'Other';
      let milestone: string = 'test_drive';
      let confidence = 70;

      // Try to identify document type from filename
      if (lowerName.includes('invoice') || lowerName.includes('performa')) {
        docType = 'payment_proof';
        docTypeName = 'Payment Proof / Invoice';
        folder = 'Payments';
        milestone = 'registration';
        confidence = 85;
      } else if (lowerName.includes('loan') || lowerName.includes('finance')) {
        docType = 'loan_application';
        docTypeName = 'Loan Application';
        folder = 'Finance';
        milestone = 'close_deal';
        confidence = 80;
      } else if (lowerName.includes('insurance')) {
        docType = 'insurance_quote';
        docTypeName = 'Insurance Quote';
        folder = 'Insurance';
        milestone = 'registration';
        confidence = 80;
      } else if (lowerName.includes('vsa') || lowerName.includes('sales') || lowerName.includes('agreement')) {
        docType = 'vsa';
        docTypeName = 'Vehicle Sales Agreement';
        folder = 'VSA';
        milestone = 'close_deal';
        confidence = 80;
      } else if (lowerName.includes('trade') || lowerName.includes('valuation')) {
        docType = 'trade_in_docs';
        docTypeName = 'Trade-in Documents';
        folder = 'Trade-In';
        milestone = 'close_deal';
        confidence = 80;
      }

      // Try to extract customer name from filename
      const nameParts = name.replace(/[_-]/g, ' ').split(' ');
      const customerName = nameParts.length >= 2 ? `${nameParts[0]} ${nameParts[1]}` : '';

      console.log(`[classifySingleFile] Excel file classified by filename: ${docType}`);
      return {
        documentType: docType,
        documentTypeName: docTypeName,
        confidence: confidence,
        folder: folder,
        milestone: milestone,
        customerName: customerName,
        suggestedFilename: name,
        summary: 'Excel file - classified based on filename',
        signed: false,
      };
    }

    if (!isImage && !isPdf) {
      return {
        documentType: 'other',
        documentTypeName: 'Other Document',
        confidence: 0,
        folder: 'Other',
        milestone: 'test_drive',
        customerName: '',
        suggestedFilename: name,
        summary: 'Non-image file - manual classification needed',
        signed: false,
      };
    }

    console.log(`[classifySingleFile] Converting to base64: ${name}`);
    const imageData = await fileToBase64(file);
    console.log(`[classifySingleFile] Base64 done: ${name}, length: ${imageData.length}`);

    const classification = await classifyDocument(imageData);
    console.log(`[classifySingleFile] Classification done: ${name}`);
    return classification;
  };

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('File processing timed out')), TOTAL_TIMEOUT);
    });

    const classification = await Promise.race([classifyWithTimeout(), timeoutPromise]);
    console.log(`[classifySingleFile] Complete: ${name}`);
    return { file, name, classification };
  } catch (err) {
    console.error(`[classifySingleFile] Failed: ${name}:`, err);
    return {
      file,
      name,
      classification: {
        documentType: 'other',
        documentTypeName: 'Other Document',
        confidence: 0,
        folder: 'Other',
        milestone: 'test_drive',
        customerName: '',
        suggestedFilename: name,
        summary: `Classification failed: ${(err as Error).message}`,
        signed: false,
      },
    };
  }
}

/**
 * Classify multiple documents using parallel batch processing
 * Processes files in small batches to balance speed vs API rate limits
 */
export async function classifyDocuments(
  files: { file: File; name: string }[],
  onProgress?: (current: number, total: number, filename: string, result?: ClassificationResult) => void
): Promise<{ file: File; name: string; classification: ClassificationResult }[]> {
  const results: { file: File; name: string; classification: ClassificationResult }[] = [];
  const BATCH_SIZE = 1; // Process 1 file at a time to stay under rate limit
  const BATCH_DELAY = 1500; // 1.5 seconds between API calls

  const totalBatches = Math.ceil(files.length / BATCH_SIZE);
  console.log(`[Queue] Starting classification for ${files.length} files (${totalBatches} batches, size ${BATCH_SIZE})`);

  // Process files in batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`[Queue] Processing batch ${batchNum}/${totalBatches}: ${batch.map(f => f.name).join(', ')}`);

    // Report progress for batch start
    onProgress?.(i + 1, files.length, batch.map(f => f.name).join(', '));

    // Process batch in parallel
    const batchPromises = batch.map(({ file, name }) => classifySingleFile(file, name));
    const batchResults = await Promise.all(batchPromises);

    // Add results and report progress
    for (const result of batchResults) {
      results.push(result);
      onProgress?.(results.length, files.length, result.name, result.classification);
    }

    // Check if batch had API calls (images/PDFs need API, Excel files don't)
    const hadApiCalls = batch.some(({ file, name }) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
      return isImage || isPdf;
    });

    // Delay between batches (only if API calls were made and more batches remain)
    if (hadApiCalls && i + BATCH_SIZE < files.length) {
      console.log(`[Queue] Waiting ${BATCH_DELAY}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`[Queue] Completed classification for ${results.length} files`);
  return results;
}

/**
 * Get suggested filename based on classification and customer name
 */
export function getSuggestedFilename(
  classification: ClassificationResult,
  customerName: string,
  originalFilename: string
): string {
  const ext = originalFilename.slice(originalFilename.lastIndexOf('.'));
  const name = customerName || classification.customerName || 'Unknown';
  const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const docType = classification.documentType.replace(/_/g, '-');
  const timestamp = new Date().toISOString().slice(0, 10);

  return `${safeName}_${docType}_${timestamp}${ext}`;
}
