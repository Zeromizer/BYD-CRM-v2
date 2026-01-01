/**
 * Customer Document Service
 * Handles upload/download of customer-specific documents to Supabase Storage
 */

import { supabase } from '@/lib/supabase';

export interface CustomerDocument {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

const BUCKET_NAME = 'customer-documents';

/**
 * Sanitize customer name for use in file paths
 * Removes special characters and replaces spaces with underscores
 */
function sanitizeCustomerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
}

/**
 * Upload a document for a customer
 */
export async function uploadCustomerDocument(
  documentType: string,
  file: File,
  customerName: string,
  _onProgress?: (progress: UploadProgress) => void
): Promise<CustomerDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  // Format: CustomerName_DocumentType_XXXXXX.ext (e.g., "SIM_MENG_HUAT_nric_front_123456.pdf")
  const safeName = sanitizeCustomerName(customerName);
  const docTypeFormatted = documentType.replace(/_/g, '_');
  const uniqueSuffix = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const fileName = `${safeName}_${docTypeFormatted}_${uniqueSuffix}.${fileExt}`;
  // Folder structure: user.id/CustomerName/documentType/filename
  const filePath = `${user.id}/${safeName}/${documentType}/${fileName}`;

  // Upload file
  console.log(`[Upload] Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB) -> ${filePath}`);
  const uploadStart = Date.now();

  const { error: uploadError, data } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[Upload] Failed: ${file.name}:`, uploadError);
    throw uploadError;
  }
  console.log(`[Upload] Complete: ${file.name} in ${Date.now() - uploadStart}ms`);

  // Get signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600 * 24 * 7); // 7 days

  if (urlError) throw urlError;

  return {
    id: data.id || filePath,
    name: file.name,
    path: filePath,
    url: urlData.signedUrl,
    size: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Get all documents for a customer in a specific category
 */
export async function getCustomerDocuments(
  customerName: string,
  documentType?: string
): Promise<CustomerDocument[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeName = sanitizeCustomerName(customerName);
  const basePath = documentType
    ? `${user.id}/${safeName}/${documentType}`
    : `${user.id}/${safeName}`;

  const { data: files, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(basePath, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) throw error;

  if (!files || files.length === 0) return [];

  // Get signed URLs for all files
  const documents: CustomerDocument[] = [];

  for (const file of files) {
    if (file.id === null) continue; // Skip folders

    const filePath = `${basePath}/${file.name}`;
    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600 * 24 * 7);

    documents.push({
      id: file.id,
      name: file.name,
      path: filePath,
      url: urlData?.signedUrl || '',
      size: file.metadata?.size || 0,
      mimeType: file.metadata?.mimetype || 'application/octet-stream',
      uploadedAt: file.created_at || new Date().toISOString(),
    });
  }

  return documents;
}

/**
 * Get a signed URL for a document
 */
export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600 * 24); // 24 hours

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Download a document
 */
export async function downloadDocument(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) throw error;
  return data;
}

/**
 * Delete a customer document
 */
export async function deleteCustomerDocument(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) throw error;
}

/**
 * Delete multiple customer documents at once (batch delete)
 */
export async function deleteCustomerDocuments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (error) throw error;
}

/**
 * Delete all documents for a customer in a specific category
 */
export async function deleteAllCustomerDocuments(
  customerName: string,
  documentType: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeName = sanitizeCustomerName(customerName);
  const basePath = `${user.id}/${safeName}/${documentType}`;

  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(basePath);

  if (listError) throw listError;

  if (files && files.length > 0) {
    const paths = files
      .filter((f) => f.id !== null)
      .map((f) => `${basePath}/${f.name}`);

    if (paths.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(paths);

      if (deleteError) throw deleteError;
    }
  }
}

/**
 * Get all document folders (types) for a customer
 */
export async function getCustomerDocumentFolders(
  customerName: string
): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeName = sanitizeCustomerName(customerName);
  const basePath = `${user.id}/${safeName}`;

  const { data: folders, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(basePath, {
      limit: 100,
    });

  if (error) throw error;

  if (!folders) return [];

  // Return folder names (document types)
  return folders
    .filter((f) => f.id === null) // Folders have null id
    .map((f) => f.name);
}

/**
 * Get all documents for a customer across all folders
 */
export async function getAllCustomerDocuments(
  customerName: string
): Promise<{ documentType: string; documents: CustomerDocument[] }[]> {
  const folders = await getCustomerDocumentFolders(customerName);
  const result: { documentType: string; documents: CustomerDocument[] }[] = [];

  for (const folder of folders) {
    try {
      const docs = await getCustomerDocuments(customerName, folder);
      if (docs.length > 0) {
        result.push({
          documentType: folder,
          documents: docs,
        });
      }
    } catch (err) {
      console.error(`Error loading documents from ${folder}:`, err);
    }
  }

  return result;
}
