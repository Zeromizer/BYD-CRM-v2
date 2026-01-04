/**
 * Customer Document Service
 * Handles upload/download of customer-specific documents to Supabase Storage
 */

import { getSupabase } from '@/lib/supabase';

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

// Cache user ID to avoid repeated auth calls
let cachedUserId: string | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Signed URL cache - URLs valid for 7 days, cache for 6 hours
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Document list cache - cache full document listings per customer
interface DocumentListCache {
  data: { documentType: string; documents: CustomerDocument[] }[];
  expiresAt: number;
}
const documentListCache = new Map<string, DocumentListCache>();
const DOCUMENT_LIST_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// In-flight request tracking to prevent duplicate requests
const inFlightRequests = new Map<string, Promise<{ documentType: string; documents: CustomerDocument[] }[]>>();

// Request queue for concurrency limiting
const MAX_CONCURRENT_REQUESTS = 6; // Browser typically allows 6 connections per host
let activeRequests = 0;
const requestQueue: (() => void)[] = [];

/**
 * Wait for a slot in the request queue
 */
async function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }

  return new Promise<void>((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

/**
 * Release a slot in the request queue
 */
function releaseRequestSlot(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Execute a request with concurrency limiting
 */
async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquireRequestSlot();
  try {
    return await fn();
  } finally {
    releaseRequestSlot();
  }
}

/**
 * Sanitize customer name for use in file paths
 * Removes special characters and replaces spaces with underscores
 */
function sanitizeCustomerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
}

/**
 * Get a cached signed URL if available and not expired
 */
function getCachedSignedUrl(path: string): string | null {
  const cached = signedUrlCache.get(path);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }
  signedUrlCache.delete(path);
  return null;
}

/**
 * Cache a signed URL
 */
function setCachedSignedUrl(path: string, url: string): void {
  signedUrlCache.set(path, {
    url,
    expiresAt: Date.now() + URL_CACHE_DURATION,
  });
}

/**
 * Clear the signed URL cache (call on logout)
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

/**
 * Clear the document list cache (call after uploads/deletes)
 */
export function clearDocumentListCache(customerName?: string): void {
  if (customerName) {
    const safeName = sanitizeCustomerName(customerName);
    documentListCache.delete(safeName);
    inFlightRequests.delete(safeName);
    console.log(`[Documents] Cleared cache for ${customerName}`);
  } else {
    const inFlightCount = inFlightRequests.size;
    const cacheCount = documentListCache.size;
    documentListCache.clear();
    inFlightRequests.clear();
    console.log(`[Documents] Cleared all caches (${cacheCount} cached, ${inFlightCount} in-flight)`);
  }
}

/**
 * Clear all caches (call on logout)
 */
export function clearAllCaches(): void {
  signedUrlCache.clear();
  documentListCache.clear();
  inFlightRequests.clear();
  cachedUserId = null;
  cacheTimestamp = 0;
}

/**
 * Clear user cache (call when auth state changes)
 */
export function clearUserCache(): void {
  cachedUserId = null;
  cacheTimestamp = 0;
}

/**
 * Wrapper to add timeout to any promise
 * Helps prevent hung requests from blocking indefinitely
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Get authenticated user ID with caching
 * Supabase handles token refresh automatically via autoRefreshToken: true
 */
async function getAuthenticatedUserId(): Promise<string> {
  const now = Date.now();

  // Return cached user if still valid
  if (cachedUserId && now - cacheTimestamp < CACHE_DURATION) {
    return cachedUserId;
  }

  // Get user - Supabase handles token refresh automatically
  const { data: { user }, error } = await getSupabase().auth.getUser();

  if (error || !user) {
    cachedUserId = null;
    cacheTimestamp = 0;
    throw new Error('Not authenticated');
  }

  // Cache the user ID
  cachedUserId = user.id;
  cacheTimestamp = now;
  return cachedUserId;
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
  const userId = await getAuthenticatedUserId();

  const fileExt = file.name.split('.').pop();
  // Format: CustomerName_DocumentType_XXXXXX.ext (e.g., "SIM_MENG_HUAT_nric_front_123456.pdf")
  const safeName = sanitizeCustomerName(customerName);
  const docTypeFormatted = documentType.replace(/_/g, '_');
  const uniqueSuffix = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const fileName = `${safeName}_${docTypeFormatted}_${uniqueSuffix}.${fileExt}`;
  // Folder structure: userId/CustomerName/documentType/filename
  const filePath = `${userId}/${safeName}/${documentType}/${fileName}`;

  // Upload file
  console.log(`[Upload] Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB) -> ${filePath}`);
  const uploadStart = Date.now();

  const supabase = getSupabase();
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
 * Only checks user-prefixed path structure (no legacy folder scanning)
 * Optimized with batch URL generation and caching
 */
export async function getCustomerDocuments(
  customerName: string,
  documentType?: string
): Promise<CustomerDocument[]> {
  const userId = await getAuthenticatedUserId();
  const safeName = sanitizeCustomerName(customerName);
  const documents: CustomerDocument[] = [];

  // Only check user-prefixed path (ONE API call)
  const basePath = documentType
    ? `${userId}/${safeName}/${documentType}`
    : `${userId}/${safeName}`;

  const { data: files } = await withConcurrencyLimit(() =>
    getSupabase().storage
      .from(BUCKET_NAME)
      .list(basePath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })
  );

  if (!files || files.length === 0) {
    return documents;
  }

  // Filter out folders, collect file paths
  const fileInfos = files
    .filter((file) => file.id !== null)
    .map((file) => ({
      file,
      filePath: `${basePath}/${file.name}`,
    }));

  if (fileInfos.length === 0) {
    return documents;
  }

  // Check cache for each file
  const cachedUrls = new Map<string, string>();
  const uncachedPaths: string[] = [];

  for (const { filePath } of fileInfos) {
    const cachedUrl = getCachedSignedUrl(filePath);
    if (cachedUrl) {
      cachedUrls.set(filePath, cachedUrl);
    } else {
      uncachedPaths.push(filePath);
    }
  }

  // Batch fetch signed URLs for uncached paths (ONE API call)
  const newUrls = new Map<string, string>();
  if (uncachedPaths.length > 0) {
    const { data: urlData } = await withConcurrencyLimit(() =>
      getSupabase().storage
        .from(BUCKET_NAME)
        .createSignedUrls(uncachedPaths, 3600 * 24 * 7) // 7 days
    );

    if (urlData) {
      for (const item of urlData) {
        if (item.signedUrl && item.path) {
          newUrls.set(item.path, item.signedUrl);
          setCachedSignedUrl(item.path, item.signedUrl);
        }
      }
    }
  }

  // Build document list
  for (const { file, filePath } of fileInfos) {
    documents.push({
      id: file.id,
      name: file.name,
      path: filePath,
      url: cachedUrls.get(filePath) || newUrls.get(filePath) || '',
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
  const { data, error } = await getSupabase().storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600 * 24); // 24 hours

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Download a document
 */
export async function downloadDocument(path: string): Promise<Blob> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) throw error;
  return data;
}

/**
 * Delete a customer document
 */
export async function deleteCustomerDocument(path: string): Promise<void> {
  const { error } = await getSupabase().storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) throw error;
}

/**
 * Delete multiple customer documents at once (batch delete)
 */
export async function deleteCustomerDocuments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await getSupabase().storage
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
  const userId = await getAuthenticatedUserId();

  const safeName = sanitizeCustomerName(customerName);
  const basePath = `${userId}/${safeName}/${documentType}`;

  const supabase = getSupabase();
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
 * Only checks user-prefixed path structure (no legacy folder scanning)
 * This dramatically reduces API calls from 50+ to just 1
 */
export async function getCustomerDocumentFolders(
  customerName: string
): Promise<string[]> {
  const userId = await getAuthenticatedUserId();
  const safeName = sanitizeCustomerName(customerName);

  // Only check user-prefixed path (new structure) - ONE API call
  // Path: {userId}/{customerName}/
  const result = await withConcurrencyLimit(() =>
    withTimeout(
      getSupabase().storage.from(BUCKET_NAME).list(`${userId}/${safeName}`, { limit: 100 }),
      5000,
      'list customer folders'
    )
  );

  if (result.data) {
    // Return only folder names (items with id === null are folders)
    return result.data
      .filter((f) => f.id === null)
      .map((f) => f.name);
  }

  return [];
}

/**
 * Get all documents for a customer across all folders
 * HIGHLY OPTIMIZED:
 * - Document list caching (2 min TTL)
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Fetches ALL folders in ONE call
 * - Fetches files from all folders SEQUENTIALLY (max 3 at a time)
 * - Batches ALL signed URLs in ONE call at the end
 */
export async function getAllCustomerDocuments(
  customerName: string
): Promise<{ documentType: string; documents: CustomerDocument[] }[]> {
  const safeName = sanitizeCustomerName(customerName);

  // Check cache first
  const cached = documentListCache.get(safeName);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[Documents] Cache hit for ${customerName}`);
    return cached.data;
  }

  // Check if there's already an in-flight request for this customer
  const inFlight = inFlightRequests.get(safeName);
  if (inFlight) {
    console.log(`[Documents] Waiting for in-flight request for ${customerName}`);
    return inFlight;
  }

  // Create the promise and store it for deduplication
  const fetchPromise = (async () => {
    try {
      const userId = await getAuthenticatedUserId();
      const customerPath = `${userId}/${safeName}`;

      // Step 1: Get all folders in ONE call
      console.log(`[Documents] Fetching folders for ${customerName}...`);
      const supabase = getSupabase();
      const { data: folderList } = await withConcurrencyLimit(() =>
        supabase.storage.from(BUCKET_NAME).list(customerPath, { limit: 100 })
      );

      const folders = folderList?.filter((f) => f.id === null).map((f) => f.name) || [];
      console.log(`[Documents] Found ${folders.length} folders for ${customerName}`);

      if (folders.length === 0) {
        return [];
      }

      // Step 2: Fetch files from each folder (sequentially, 3 at a time to avoid overwhelming)
      interface FileWithFolder {
        folder: string;
        file: { id: string; name: string; metadata?: { size?: number; mimetype?: string }; created_at?: string };
        filePath: string;
      }
      const allFiles: FileWithFolder[] = [];

      // Process folders in batches of 3
      for (let i = 0; i < folders.length; i += 3) {
        const batch = folders.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(async (folder) => {
            const folderPath = `${customerPath}/${folder}`;
            const { data: files } = await withConcurrencyLimit(() =>
              supabase.storage.from(BUCKET_NAME).list(folderPath, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' },
              })
            );
            return { folder, files: files || [] };
          })
        );

        for (const { folder, files } of batchResults) {
          for (const file of files) {
            if (file.id !== null) {
              allFiles.push({
                folder,
                file,
                filePath: `${customerPath}/${folder}/${file.name}`,
              });
            }
          }
        }
      }

      console.log(`[Documents] Found ${allFiles.length} total files`);

      if (allFiles.length === 0) {
        return [];
      }

      // Step 3: Check URL cache and batch fetch ALL uncached URLs in ONE call
      const cachedUrls = new Map<string, string>();
      const uncachedPaths: string[] = [];

      for (const { filePath } of allFiles) {
        const cachedUrl = getCachedSignedUrl(filePath);
        if (cachedUrl) {
          cachedUrls.set(filePath, cachedUrl);
        } else {
          uncachedPaths.push(filePath);
        }
      }

      const newUrls = new Map<string, string>();
      if (uncachedPaths.length > 0) {
        console.log(`[Documents] Fetching ${uncachedPaths.length} signed URLs...`);
        const { data: urlData } = await withConcurrencyLimit(() =>
          supabase.storage.from(BUCKET_NAME).createSignedUrls(uncachedPaths, 3600 * 24 * 7)
        );

        if (urlData) {
          for (const item of urlData) {
            if (item.signedUrl && item.path) {
              newUrls.set(item.path, item.signedUrl);
              setCachedSignedUrl(item.path, item.signedUrl);
            }
          }
        }
      }

      // Step 4: Group by folder and build result
      const folderMap = new Map<string, CustomerDocument[]>();

      for (const { folder, file, filePath } of allFiles) {
        if (!folderMap.has(folder)) {
          folderMap.set(folder, []);
        }
        folderMap.get(folder)!.push({
          id: file.id,
          name: file.name,
          path: filePath,
          url: cachedUrls.get(filePath) || newUrls.get(filePath) || '',
          size: file.metadata?.size || 0,
          mimeType: file.metadata?.mimetype || 'application/octet-stream',
          uploadedAt: file.created_at || new Date().toISOString(),
        });
      }

      const result = Array.from(folderMap.entries())
        .map(([documentType, documents]) => ({ documentType, documents }))
        .filter((r) => r.documents.length > 0);

      // Cache the result
      documentListCache.set(safeName, {
        data: result,
        expiresAt: Date.now() + DOCUMENT_LIST_CACHE_DURATION,
      });

      console.log(`[Documents] Loaded ${result.length} folders with documents`);
      return result;
    } finally {
      // Clean up in-flight request tracking
      inFlightRequests.delete(safeName);
    }
  })();

  // Store the in-flight promise for deduplication
  inFlightRequests.set(safeName, fetchPromise);

  return fetchPromise;
}

/**
 * Delete ALL documents for a customer (entire customer folder)
 * Called when a customer is deleted to clean up storage
 */
export async function deleteEntireCustomerFolder(customerName: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const safeName = sanitizeCustomerName(customerName);
  const basePath = `${userId}/${safeName}`;

  const supabase = getSupabase();

  // First, get all folders for this customer
  const { data: folders, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(basePath, { limit: 100 });

  if (listError) {
    console.error(`[Delete] Failed to list customer folders:`, listError);
    return;
  }

  if (!folders || folders.length === 0) {
    console.log(`[Delete] No documents found for customer ${customerName}`);
    return;
  }

  // Collect all file paths to delete
  const allFilePaths: string[] = [];

  for (const item of folders) {
    if (item.id === null) {
      // It's a folder, list its contents
      const folderPath = `${basePath}/${item.name}`;
      const { data: files } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath, { limit: 1000 });

      if (files) {
        for (const file of files) {
          if (file.id !== null) {
            allFilePaths.push(`${folderPath}/${file.name}`);
          }
        }
      }
    } else {
      // It's a file at root level (shouldn't happen, but handle it)
      allFilePaths.push(`${basePath}/${item.name}`);
    }
  }

  if (allFilePaths.length > 0) {
    console.log(`[Delete] Deleting ${allFilePaths.length} files for customer ${customerName}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(allFilePaths);

    if (deleteError) {
      console.error(`[Delete] Failed to delete customer files:`, deleteError);
    } else {
      console.log(`[Delete] Successfully deleted all files for customer ${customerName}`);
    }
  }

  // Clear caches for this customer
  clearDocumentListCache(customerName);
}
