/**
 * Supabase Edge Function: vision-claude-ocr
 *
 * Two-step OCR pipeline:
 * 1. Google Cloud Vision API - High-accuracy text extraction (98%) for images and PDFs
 * 2. Claude Haiku 4.5 - Intelligent classification and data structuring
 *
 * This hybrid approach provides better accuracy than using either service alone.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Document types for classification
const DOCUMENT_TYPES = `
- nric_front: Front of Singapore NRIC card (pink card with photo, name, NRIC number starting with S/T/F/G)
- nric_back: Back of Singapore NRIC card showing address
- nric: Combined NRIC (front and back together on same page)
- driving_license: Singapore Driving License (card with "REPUBLIC OF SINGAPORE DRIVING LICENCE", photo, license classes)
- test_drive_form: Test Drive Agreement/Form
- vsa: Vehicle Sales Agreement, Proforma Invoice, Sales Contract, Purchase Agreement
- pdpa: PDPA Consent Form (data protection)
- loan_approval: Bank/Finance Loan Approval Letter
- loan_application: Loan Application Form
- insurance_quote: Insurance Quote/Proposal/Quotation
- insurance_policy: Insurance Policy Document, Certificate of Insurance
- insurance_acceptance: Insurance Acceptance Form, Declaration of Loss of Insurance
- payment_proof: Payment receipt, bank transfer, invoice for payment
- delivery_checklist: Vehicle Delivery Checklist
- registration_card: Vehicle Registration Card
- trade_in_docs: Trade-in related documents, vehicle valuation
- id_documents: Multiple ID documents scanned together on same page
- other: Document does not match any of the above categories
`;

interface VisionClaudeRequest {
  imageData?: string; // base64 data URL (for images/PDFs)
  rawText?: string; // Pre-extracted text (for Excel files) - skips Vision API
  documentType?: 'auto' | 'nric' | 'vsa' | 'trade_in';
  sourceType?: 'image' | 'excel'; // Helps Claude understand the context
  visionOnly?: boolean; // If true, only run Vision OCR and return raw text (skip Claude)
}

interface VisionClaudeResponse {
  documentType: string;
  confidence: number;
  customerName: string;
  signed: boolean;
  summary: string;
  rawText: string;
  extractedData: {
    nric?: string;
    name?: string;
    dateOfBirth?: string;
    address?: string;
    phone?: string;
    email?: string;
    vehicleModel?: string;
    sellingPrice?: number;
    coeAmount?: number;
    deposit?: number;
    loanAmount?: number;
  };
  ocrMethod: 'vision-claude';
}

/**
 * Extract base64 data from data URL
 */
function dataUrlToBase64(dataUrl: string): string {
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Get mime type from data URL
 */
function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  if (match) {
    return match[1];
  }
  return 'image/jpeg';
}

/**
 * Step 1: Extract text using Google Cloud Vision API
 * Uses DOCUMENT_TEXT_DETECTION for better accuracy on documents
 */
async function extractTextWithVision(base64Data: string, mimeType: string, apiKey: string): Promise<string> {
  const isPdf = mimeType === 'application/pdf';

  // Use DOCUMENT_TEXT_DETECTION for both images and PDFs - it provides better OCR for documents
  const requestBody = {
    requests: [
      {
        image: {
          content: base64Data,
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
          },
        ],
      },
    ],
  };

  console.log(`Calling Vision API for ${isPdf ? 'PDF' : 'image'} (${base64Data.length} bytes base64)`);

  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Vision API error:', JSON.stringify(errorData));

    // Check for specific PDF error
    if (isPdf && errorData.error?.message?.includes('PDF')) {
      throw new Error('PDF processing failed. Please convert to image format (JPEG/PNG) for best results.');
    }

    throw new Error(`Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();

  // Check for API-level errors in responses
  if (data.responses?.[0]?.error) {
    const apiError = data.responses[0].error;
    console.error('Vision API response error:', JSON.stringify(apiError));
    throw new Error(`Vision API: ${apiError.message || 'Processing failed'}`);
  }

  // Extract full text annotation
  const textAnnotation = data.responses?.[0]?.fullTextAnnotation?.text
    || data.responses?.[0]?.textAnnotations?.[0]?.description
    || '';

  return textAnnotation;
}

/**
 * Step 2: Classify and extract data using Claude Haiku 4.5
 */
async function classifyWithClaude(
  rawText: string,
  documentTypeHint: string,
  apiKey: string
): Promise<Omit<VisionClaudeResponse, 'rawText' | 'ocrMethod'>> {

  const systemPrompt = `You are a document classifier and data extractor for a Singapore car dealership CRM.

You will receive OCR-extracted text from a document. Your job is to:
1. Identify the document type
2. Extract key customer and document information
3. Provide a confidence score

DOCUMENT TYPES (choose the BEST match):
${DOCUMENT_TYPES}

EXTRACTION RULES:
- NRIC format: [STFG]\\d{7}[A-Z] (e.g., S1234567A)
- Singapore phone: +65 or 8/9 followed by 7 digits
- Currency amounts: Look for $ or SGD followed by numbers
- Dates: DD/MM/YYYY or DD-MM-YYYY format common in Singapore

Return ONLY a valid JSON object with this exact structure:
{
  "documentType": "nric_front",
  "confidence": 85,
  "customerName": "TAN AH KOW",
  "signed": false,
  "summary": "Front of NRIC for Tan Ah Kow",
  "extractedData": {
    "nric": "S1234567A",
    "name": "TAN AH KOW",
    "dateOfBirth": "1990-05-15",
    "address": "123 EXAMPLE STREET #01-01 SINGAPORE 123456",
    "phone": null,
    "email": null,
    "vehicleModel": null,
    "sellingPrice": null,
    "coeAmount": null,
    "deposit": null,
    "loanAmount": null
  }
}

Important:
- Only include fields that you can extract from the text
- Set missing fields to null
- Confidence should be 0-100 based on text quality and match certainty`;

  const userMessage = documentTypeHint && documentTypeHint !== 'auto'
    ? `The user expects this to be a ${documentTypeHint} document. Verify if this is correct.

OCR Text:
${rawText}`
    : `Classify this document and extract information:

OCR Text:
${rawText}`;

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
            { type: 'text', text: systemPrompt },
            { type: 'text', text: userMessage },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Claude API error:', errorData);
    throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const textResponse = data.content?.[0]?.text;

  if (!textResponse) {
    throw new Error('No response from Claude');
  }

  // Parse JSON from response
  let jsonStr = textResponse.trim();

  // Remove markdown code blocks if present
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

  try {
    const result = JSON.parse(jsonStr);
    return {
      documentType: result.documentType || 'other',
      confidence: result.confidence || 50,
      customerName: result.customerName || result.extractedData?.name || '',
      signed: result.signed === true,
      summary: result.summary || '',
      extractedData: result.extractedData || {},
    };
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get API keys
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Cloud API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body = await req.json() as VisionClaudeRequest;
    const { imageData, rawText: preExtractedText, documentType = 'auto', sourceType, visionOnly = false } = body;

    // Either imageData or rawText must be provided
    if (!imageData && !preExtractedText) {
      return new Response(
        JSON.stringify({ error: 'Either imageData or rawText is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawText: string;

    // If pre-extracted text is provided (e.g., from Excel), skip Vision API
    if (preExtractedText) {
      console.log(`Processing pre-extracted text (${preExtractedText.length} chars) from ${sourceType || 'unknown source'}`);
      rawText = preExtractedText;
    } else {
      // Extract base64 and mime type from image data
      const base64Data = dataUrlToBase64(imageData!);
      const mimeType = getMimeTypeFromDataUrl(imageData!);

      console.log(`Processing ${mimeType} document with Vision + Claude pipeline`);

      // Check for unsupported file types
      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
      const isPdf = mimeType === 'application/pdf';
      const isImage = supportedImageTypes.includes(mimeType);

      if (!isImage && !isPdf) {
        return new Response(
          JSON.stringify({
            error: `Unsupported file type: ${mimeType}. Vision OCR only supports images (JPEG, PNG, GIF, WebP, BMP) and PDFs.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (isPdf) {
        console.log('Processing PDF with Vision API...');
      }

      // Step 1: Extract text with Vision API (supports both images and PDFs)
      console.log('Step 1: Extracting text with Google Cloud Vision...');
      rawText = await extractTextWithVision(base64Data, mimeType, googleApiKey);
    }

    if (!rawText || rawText.trim().length === 0) {
      return new Response(
        JSON.stringify({
          documentType: 'other',
          confidence: 0,
          customerName: '',
          signed: false,
          summary: 'No text could be extracted from the image',
          rawText: '',
          extractedData: {},
          ocrMethod: 'vision-claude',
        } as VisionClaudeResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${rawText.length} characters of text`);

    // If visionOnly mode, return just the OCR text without Claude classification
    // This is used for multi-page PDFs where we extract text from each page first,
    // then combine and classify once at the end
    if (visionOnly) {
      console.log('Vision-only mode: returning raw OCR text without classification');
      return new Response(
        JSON.stringify({
          rawText,
          ocrMethod: 'vision-only',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Classify with Claude
    console.log('Step 2: Classifying with Claude Haiku 4.5...');
    const classification = await classifyWithClaude(rawText, documentType, anthropicApiKey);

    // Combine results
    const response: VisionClaudeResponse = {
      ...classification,
      rawText,
      ocrMethod: 'vision-claude',
    };

    console.log(`Classification complete: ${response.documentType} (${response.confidence}%)`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in vision-claude-ocr:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
