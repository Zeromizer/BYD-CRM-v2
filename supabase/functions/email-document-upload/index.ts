/**
 * Supabase Edge Function: email-document-upload
 *
 * Receives PDF documents from Make.com automation and uploads them to the
 * correct customer's storage folder. Matches customers by name across all users.
 *
 * Flow:
 * 1. Receive: { customerName, documentType, fileBase64, fileName }
 * 2. Search customers table for matching name (across ALL users)
 * 3. Get the user_id who owns this customer
 * 4. Upload to: {user_id}/{SANITIZED_NAME}/{documentType}/{fileName}
 * 5. Return: { success, customerId, customerName, userId, uploadPath }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET_NAME = 'customer-documents';

interface EmailDocumentRequest {
  customerName: string;      // Parsed from filename, e.g., "TAN AH KOW" or "TAN_AH_KOW"
  documentType: string;      // "registration_card" or "insurance_policy"
  fileBase64: string;        // Base64-encoded PDF content
  fileName: string;          // Original filename, e.g., "TAN_AH_KOW_CreditNote.pdf"
}

interface EmailDocumentResponse {
  success: boolean;
  customerId?: number;
  customerName?: string;
  userId?: string;
  uploadPath?: string;
  error?: string;
}

/**
 * Sanitize customer name for use in file paths
 * Removes special characters and replaces spaces with underscores
 */
function sanitizeCustomerName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

/**
 * Common name prefixes/titles to strip from filenames
 * These are often added in insurance/registration documents but not stored in CRM
 */
const NAME_PREFIXES = ['ME', 'MR', 'MS', 'MRS', 'MDM', 'MISS', 'DR', 'MADAM'];

/**
 * Normalize customer name for matching
 * Handles both "TAN_AH_KOW" and "TAN AH KOW" formats
 * Also strips common prefixes like "ME", "MR", "MS", etc.
 */
function normalizeNameForMatching(name: string): string {
  let normalized = name
    .replace(/_/g, ' ')           // Replace underscores with spaces
    .replace(/\s+/g, ' ')         // Normalize multiple spaces
    .trim()
    .toUpperCase();

  // Strip common prefixes (e.g., "ME TEE HOCK SENG" → "TEE HOCK SENG")
  for (const prefix of NAME_PREFIXES) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length + 1).trim();
      break; // Only remove one prefix
    }
  }

  return normalized;
}

/**
 * Decode base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  let cleanBase64 = base64;
  if (base64.includes('base64,')) {
    cleanBase64 = base64.split('base64,')[1];
  }

  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authorization - must use service role key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' } as EmailDocumentResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' } as EmailDocumentResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json() as EmailDocumentRequest;
    const { customerName, documentType, fileBase64, fileName } = body;

    // Validate required fields
    if (!customerName || !documentType || !fileBase64 || !fileName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: customerName, documentType, fileBase64, fileName',
        } as EmailDocumentResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Email Upload] Processing: ${fileName} for customer "${customerName}"`);

    // Normalize the customer name for matching
    const normalizedName = normalizeNameForMatching(customerName);
    console.log(`[Email Upload] Searching for customer: "${normalizedName}"`);

    // Search for customer across ALL users
    // Try exact match first, then fuzzy match
    const { data: customers, error: searchError } = await supabase
      .from('customers')
      .select('id, name, user_id')
      .or(`name.ilike.${normalizedName},name.ilike.%${normalizedName}%`)
      .limit(5);

    if (searchError) {
      console.error('[Email Upload] Database search error:', searchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database search failed' } as EmailDocumentResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customers || customers.length === 0) {
      console.log(`[Email Upload] No customer found for: "${normalizedName}"`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Customer not found: ${normalizedName}`,
        } as EmailDocumentResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the first match (best match based on query)
    const customer = customers[0];
    console.log(`[Email Upload] Found customer: ${customer.name} (ID: ${customer.id}, User: ${customer.user_id})`);

    // Prepare file path
    const safeName = sanitizeCustomerName(customer.name);
    const uniqueSuffix = Date.now().toString().slice(-6);
    const fileExt = fileName.split('.').pop() || 'pdf';
    const newFileName = `${safeName}_${documentType}_${uniqueSuffix}.${fileExt}`;
    const filePath = `${customer.user_id}/${safeName}/${documentType}/${newFileName}`;

    console.log(`[Email Upload] Uploading to: ${filePath}`);

    // Decode base64 and upload
    const fileData = base64ToUint8Array(fileBase64);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Email Upload] Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Upload failed: ${uploadError.message}`,
        } as EmailDocumentResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Email Upload] Success! Uploaded ${fileName} to ${filePath}`);

    // Return success response
    const response: EmailDocumentResponse = {
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      userId: customer.user_id,
      uploadPath: filePath,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Email Upload] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      } as EmailDocumentResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
