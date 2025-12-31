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
 * Upload a document for a customer
 */
export async function uploadCustomerDocument(
  customerId: number,
  documentType: string,
  file: File,
  _onProgress?: (progress: UploadProgress) => void
): Promise<CustomerDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${documentType}_${Date.now()}.${fileExt}`;
  const filePath = `${user.id}/${customerId}/${documentType}/${fileName}`;

  // Upload file
  const { error: uploadError, data } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

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
  customerId: number,
  documentType?: string
): Promise<CustomerDocument[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const basePath = documentType
    ? `${user.id}/${customerId}/${documentType}`
    : `${user.id}/${customerId}`;

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
 * Delete all documents for a customer in a specific category
 */
export async function deleteAllCustomerDocuments(
  customerId: number,
  documentType: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const basePath = `${user.id}/${customerId}/${documentType}`;

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
