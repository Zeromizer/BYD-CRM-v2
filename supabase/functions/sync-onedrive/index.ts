/**
 * Supabase Edge Function: sync-onedrive
 * Syncs documents from OneDrive folder, classifies them with AI, and stores in Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const ONEDRIVE_FOLDER_PATH = '/BYD CRM/Scanned Docs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  '@microsoft.graph.downloadUrl'?: string;
}

interface DocumentClassification {
  documentType: 'ic_card' | 'driving_license' | 'sales_agreement' | 'booking_form' | 'insurance' | 'other' | 'unknown';
  customerName?: string;
  icNumber?: string;
  confidence: number;
  extractedData: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const MS_TENANT_ID = Deno.env.get('MS_TENANT_ID');
    const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID');
    const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
      throw new Error('Microsoft credentials not configured');
    }
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Get Microsoft access token
    console.log('Getting Microsoft access token...');
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token error:', errorText);
      throw new Error(`Failed to get Microsoft token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Get files from OneDrive folder
    console.log('Fetching files from OneDrive...');
    const encodedPath = encodeURIComponent(ONEDRIVE_FOLDER_PATH);

    // For application permissions, we need to specify a user
    // First, get the users to find which one has OneDrive
    const usersResponse = await fetch(
      'https://graph.microsoft.com/v1.0/users',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      console.error('Users error:', errorText);
      throw new Error(`Failed to get users: ${usersResponse.status}`);
    }

    const usersData = await usersResponse.json();
    const users = usersData.value || [];

    if (users.length === 0) {
      throw new Error('No users found in the directory');
    }

    // Use the first user (or you can specify a specific user)
    const userId = users[0].id;
    console.log(`Using user: ${users[0].displayName} (${users[0].userPrincipalName})`);

    // Get files from the folder
    const filesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${ONEDRIVE_FOLDER_PATH}:/children`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!filesResponse.ok) {
      const errorText = await filesResponse.text();
      console.error('Files error:', errorText);

      if (filesResponse.status === 404) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'OneDrive folder not found or empty',
            processed: 0,
            pending: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to get files: ${filesResponse.status}`);
    }

    const filesData = await filesResponse.json();
    const files: OneDriveFile[] = (filesData.value || []).filter((f: any) =>
      f.file && (f.file.mimeType?.startsWith('image/') || f.file.mimeType === 'application/pdf')
    ).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.file.mimeType,
      '@microsoft.graph.downloadUrl': f['@microsoft.graph.downloadUrl'],
    }));

    console.log(`Found ${files.length} files to process`);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No new files to process',
          processed: 0,
          pending: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get existing customers for matching
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, ic_number, phone');

    const results = {
      processed: 0,
      pending: 0,
      failed: 0,
      details: [] as any[],
    };

    // Step 4: Process each file
    for (const file of files) {
      try {
        console.log(`Processing: ${file.name}`);

        // Download the file
        const downloadUrl = file['@microsoft.graph.downloadUrl'];
        if (!downloadUrl) {
          // Get download URL if not provided
          const downloadResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${file.id}/content`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              redirect: 'follow',
            }
          );

          if (!downloadResponse.ok) {
            throw new Error(`Failed to download file: ${downloadResponse.status}`);
          }
        }

        const fileResponse = await fetch(downloadUrl ||
          `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${file.id}/content`, {
          headers: downloadUrl ? {} : { Authorization: `Bearer ${accessToken}` },
        });

        if (!fileResponse.ok) {
          throw new Error(`Failed to download file: ${fileResponse.status}`);
        }

        const fileBuffer = await fileResponse.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

        // Classify with Gemini AI
        const classification = await classifyDocument(
          base64Content,
          file.mimeType,
          GEMINI_API_KEY,
          customers || []
        );

        console.log(`Classification result:`, classification);

        // Find matching customer
        let matchedCustomerId: number | null = null;

        if (classification.icNumber && customers) {
          const match = customers.find(c =>
            c.ic_number?.replace(/[- ]/g, '') === classification.icNumber?.replace(/[- ]/g, '')
          );
          if (match) matchedCustomerId = match.id;
        }

        if (!matchedCustomerId && classification.customerName && customers) {
          const match = customers.find(c =>
            c.name?.toLowerCase().includes(classification.customerName?.toLowerCase() || '') ||
            classification.customerName?.toLowerCase().includes(c.name?.toLowerCase() || '')
          );
          if (match) matchedCustomerId = match.id;
        }

        // Determine storage path
        const timestamp = Date.now();
        let storagePath: string;
        let status: 'processed' | 'pending_review';

        if (matchedCustomerId) {
          storagePath = `${matchedCustomerId}/${classification.documentType}/${timestamp}_${file.name}`;
          status = 'processed';
        } else {
          storagePath = `pending-review/${timestamp}_${file.name}`;
          status = 'pending_review';
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('customer-documents')
          .upload(storagePath, fileBuffer, {
            contentType: file.mimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Create database record
        const { error: dbError } = await supabase
          .from('customer_documents')
          .insert({
            customer_id: matchedCustomerId,
            document_type: classification.documentType,
            file_name: file.name,
            file_path: storagePath,
            file_size: file.size,
            mime_type: file.mimeType,
            onedrive_source: `${ONEDRIVE_FOLDER_PATH}/${file.name}`,
            ai_extracted_data: classification.extractedData,
            ai_confidence: classification.confidence,
            status,
          });

        if (dbError) {
          throw new Error(`Database insert failed: ${dbError.message}`);
        }

        // Delete from OneDrive (only if successfully processed)
        if (status === 'processed') {
          const deleteResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${file.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!deleteResponse.ok && deleteResponse.status !== 204) {
            console.warn(`Warning: Could not delete file from OneDrive: ${file.name}`);
          }
        }

        if (status === 'processed') {
          results.processed++;
        } else {
          results.pending++;
        }

        results.details.push({
          file: file.name,
          status,
          customerId: matchedCustomerId,
          documentType: classification.documentType,
          confidence: classification.confidence,
        });

      } catch (fileError) {
        console.error(`Error processing ${file.name}:`, fileError);
        results.failed++;
        results.details.push({
          file: file.name,
          status: 'failed',
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync complete: ${results.processed} processed, ${results.pending} pending review, ${results.failed} failed`,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Classify document using Gemini AI
 */
async function classifyDocument(
  base64Content: string,
  mimeType: string,
  apiKey: string,
  customers: Array<{ id: number; name: string; ic_number?: string; phone?: string }>
): Promise<DocumentClassification> {
  const customerList = customers.slice(0, 50).map(c =>
    `- ${c.name}${c.ic_number ? ` (IC: ${c.ic_number})` : ''}`
  ).join('\n');

  const prompt = `Analyze this scanned document and provide classification.

Document Types:
- ic_card: Malaysian IC card (MyKad) - front or back
- driving_license: Driving license
- sales_agreement: Vehicle sales agreement or contract
- booking_form: Vehicle booking form
- insurance: Insurance documents
- other: Other document types
- unknown: Cannot determine

Known customers in the system:
${customerList || 'No customers in system yet'}

Please respond with ONLY a JSON object (no markdown, no explanation):
{
  "documentType": "one of the types above",
  "customerName": "full name if visible on document, or null",
  "icNumber": "IC number if visible (format: XXXXXX-XX-XXXX), or null",
  "confidence": 0.0 to 1.0,
  "extractedData": {
    "any other relevant data extracted from the document"
  }
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Content,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    console.error('Gemini API error:', await response.text());
    return {
      documentType: 'unknown',
      confidence: 0,
      extractedData: { error: 'AI classification failed' },
    };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        documentType: parsed.documentType || 'unknown',
        customerName: parsed.customerName || undefined,
        icNumber: parsed.icNumber || undefined,
        confidence: parsed.confidence || 0.5,
        extractedData: parsed.extractedData || {},
      };
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
  }

  return {
    documentType: 'unknown',
    confidence: 0,
    extractedData: { rawResponse: text },
  };
}
