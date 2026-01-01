/**
 * Supabase Edge Function: classify-document
 * Classifies documents using Claude Haiku 3.5
 * Identifies document type, extracts customer name, suggests categorization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Document types the AI should recognize
const DOCUMENT_TYPES = `
- nric_front: Front of Singapore NRIC card (pink card with photo, name, NRIC number starting with S/T/F/G)
- nric_back: Back of Singapore NRIC card showing address
- nric: Combined NRIC (front and back together on same page)
- driving_license: Singapore Driving License (card with "REPUBLIC OF SINGAPORE DRIVING LICENCE", photo, license classes)
- test_drive_form: Test Drive Agreement/Form
- vsa: Vehicle Sales Agreement, Proforma Invoice, Sales Contract, Purchase Agreement (any document showing car price, payment terms, vehicle details for sale)
- pdpa: PDPA Consent Form (data protection)
- loan_approval: Bank/Finance Loan Approval Letter
- loan_application: Loan Application Form
- insurance_quote: Insurance Quote/Proposal/Quotation
- insurance_policy: Insurance Policy Document, Certificate of Insurance
- insurance_acceptance: Insurance Acceptance Form, Declaration of Loss of Insurance, Insurance Cover Note
- payment_proof: Payment receipt, bank transfer, invoice for payment
- delivery_checklist: Vehicle Delivery Checklist
- registration_card: Vehicle Registration Card
- trade_in_docs: Trade-in related documents, vehicle valuation
- id_documents: Multiple ID documents scanned together on same page
- other: ONLY use this if document does not match ANY of the above categories
`;

interface ClassifyRequest {
  imageData: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as ClassifyRequest;
    const { imageData } = body;

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are a document classifier for a Singapore car dealership CRM. Analyze this document and classify it.

DOCUMENT TYPES (choose the BEST match, avoid "other"):
${DOCUMENT_TYPES}

CLASSIFICATION RULES:
1. Look for key identifiers: "DRIVING LICENCE" = driving_license, "PROFORMA INVOICE" or price breakdown = vsa, "NRIC" with photo = nric_front
2. If document shows vehicle price, financing, or sales terms = vsa
3. If document mentions insurance declaration, loss, or cover = insurance_acceptance
4. If multiple different ID types on same page = id_documents
5. ONLY use "other" if document truly doesn't fit any category

Extract:
- Customer name (look for buyer/applicant/owner/insured name)
- Whether document is signed

Return ONLY this JSON (no markdown):
{
  "documentType": "vsa",
  "confidence": 85,
  "customerName": "TAN AH KOW",
  "signed": true,
  "summary": "Vehicle Sales Agreement for Toyota Camry"
}`;

    // Extract base64 and mime type from data URL
    const base64Data = dataUrlToBase64(imageData);
    let mimeType = getMimeTypeFromDataUrl(imageData);

    // Build the content based on file type
    let contentBlock: any;

    if (mimeType === 'application/pdf') {
      // PDF document - use document type
      contentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      };
    } else {
      // Image - use image type
      contentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64Data,
        },
      };
    }

    // Call Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Claude API error: ${response.status}`;
      console.error('Claude API error:', errorData);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textResponse = data.content?.[0]?.text;

    if (!textResponse) {
      return new Response(
        JSON.stringify({ error: 'No response from Claude' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON from response
    let jsonStr = textResponse.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    // Try to extract JSON if response has extra text
    if (!jsonStr.startsWith('{')) {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // Return error if parsing fails - no fallback
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        documentType: result.documentType || 'other',
        confidence: result.confidence || 50,
        customerName: result.customerName || '',
        signed: result.signed === true,
        summary: result.summary || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Convert base64 data URL to base64 string (without prefix)
 */
function dataUrlToBase64(dataUrl: string): string {
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Extract mime type from base64 data URL
 */
function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  if (match) {
    return match[1];
  }
  return 'image/jpeg';
}
