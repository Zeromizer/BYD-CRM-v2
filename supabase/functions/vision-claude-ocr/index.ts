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
- driving_license_front: Front of Singapore Driving License
- driving_license_back: Back of Singapore Driving License
- test_drive_form: Test Drive Agreement/Form
- vsa: Vehicle Sales Agreement, Proforma Invoice, Sales Contract
- pdpa: PDPA Consent Form (data protection), Privacy Policy acknowledgment
- loan_approval: Bank/Finance Loan Approval Letter
- loan_application: Loan Application Form
- insurance_quote: Insurance Quote/Proposal/Quotation
- insurance_policy: Insurance Policy Document, Certificate of Insurance, Cover Note
- insurance_acceptance: Insurance Acceptance Form, Declaration of Loss of Insurance
- payment_proof: Payment receipt, bank transfer, invoice for payment
- delivery_checklist: Vehicle Delivery Checklist
- registration_card: Vehicle Registration Card
- trade_in_docs: Trade-in related documents, vehicle valuation
- coe_bidding: COE Bidding Form, COE Authorization Letter
- purchase_agreement: Vehicle Purchase Agreement (trade-in)
- parf_rebate: PARF/COE Rebate inquiry, rebate documents
- authorized_letter: Authorized Letter for finance/HP settlement
- proposal_form: New Car Proposal Form (internal sales document)
- price_list: Vehicle Price List, promotional pricing
- id_documents: Multiple ID documents scanned together on same page
- other: Document does not match any of the above categories
`;

// Document type to friendly name mapping (for batch classification)
const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  nric_front: 'NRIC Front',
  nric_back: 'NRIC Back',
  nric: 'NRIC (Combined)',
  driving_license: 'Driving License',
  driving_license_front: 'Driving License Front',
  driving_license_back: 'Driving License Back',
  test_drive_form: 'Test Drive Form',
  vsa: 'Vehicle Sales Agreement',
  pdpa: 'PDPA Consent Form',
  loan_approval: 'Loan Approval Letter',
  loan_application: 'Loan Application',
  insurance_quote: 'Insurance Quote',
  insurance_policy: 'Cover Note',
  insurance_acceptance: 'Insurance Acceptance',
  payment_proof: 'Payment Proof',
  delivery_checklist: 'Delivery Checklist',
  registration_card: 'Registration Card',
  trade_in_docs: 'Trade-in Documents',
  coe_bidding: 'COE Bidding Form',
  purchase_agreement: 'Purchase Agreement',
  parf_rebate: 'PARF/COE Rebate',
  authorized_letter: 'Authorized Letter',
  proposal_form: 'Proposal Form',
  price_list: 'Price List',
  id_documents: 'ID Documents',
  other: 'Other Document',
};

interface VisionClaudeRequest {
  imageData?: string; // base64 data URL (for images/PDFs)
  rawText?: string; // Pre-extracted text (for Excel files) - skips Vision API
  documentType?: 'auto' | 'nric' | 'vsa' | 'trade_in';
  sourceType?: 'image' | 'excel'; // Helps Claude understand the context
  visionOnly?: boolean; // If true, only run Vision OCR and return raw text (skip Claude)
  mode?: 'batch-classify' | 'analyze-pdf'; // For batch classification or direct PDF analysis
  pageTexts?: string[]; // Array of OCR text from each page (for batch-classify mode)
  pdfData?: string; // Base64 PDF data URL (for analyze-pdf mode)
}

// Batch classification response for sales pack analysis
interface BatchClassifyResponse {
  customerName: string;
  pages: {
    documentType: string;
    documentTypeName: string;
    confidence: number;
  }[];
  documentGroups: {
    documentType: string;
    documentTypeName: string;
    pages: number[]; // 1-indexed page numbers
    confidence: number;
  }[];
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

/**
 * Batch classify multiple pages from a sales pack PDF
 * Classifies each page and groups consecutive pages of the same document type
 */
async function batchClassifyPages(
  pageTexts: string[],
  apiKey: string
): Promise<BatchClassifyResponse> {
  const systemPrompt = `You are analyzing pages from a scanned "Sales Pack" PDF for a Singapore car dealership CRM.
This PDF contains multiple document types that need to be identified and grouped.

YOUR TASKS:
1. Classify each page into one of the document types
2. Group CONSECUTIVE pages that belong to the same document
3. Extract the customer name (appears on multiple documents)

DOCUMENT TYPES (choose the BEST match for each page):
${DOCUMENT_TYPES}

GROUPING RULES - These help you decide how to group pages:
- VSA (Vehicle Sales Agreement) is typically 2-4 pages with terms and conditions
- PDPA consent is typically 1-2 pages
- NRIC front and back should be SEPARATE documents (nric_front, nric_back)
- Driving license front and back should be SEPARATE documents
- Insurance documents may be 1-3 pages
- COE bidding forms are typically 2 pages
- Purchase agreements (for trade-in vehicles) are typically 2 pages
- Price lists are usually 1 page with multiple vehicle models
- Proposal forms are internal sales documents with pricing and benefits
- Blank pages should be grouped with the preceding document
- Pages with "CONDITIONS OF SALE" or similar legal text belong to VSA
- Group consecutive pages of the SAME document type together

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{
  "customerName": "EXTRACTED CUSTOMER NAME IN CAPS",
  "pages": [
    { "documentType": "vsa", "confidence": 95 },
    { "documentType": "vsa", "confidence": 90 },
    { "documentType": "nric_front", "confidence": 88 }
  ],
  "documentGroups": [
    { "documentType": "vsa", "pages": [1, 2], "confidence": 92 },
    { "documentType": "nric_front", "pages": [3], "confidence": 88 }
  ]
}

IMPORTANT:
- pages array must have exactly one entry per page in order
- documentGroups must cover ALL pages with no gaps
- pages in documentGroups are 1-indexed (first page is 1)
- confidence is 0-100 based on text clarity and match certainty
- Blank or mostly empty pages should have confidence < 50 and type "other"`;

  // Build the user message with page contents (truncate each page to avoid token limits)
  const MAX_CHARS_PER_PAGE = 3000;
  const pageContents = pageTexts.map((text, i) => {
    const truncated = text.length > MAX_CHARS_PER_PAGE
      ? text.substring(0, MAX_CHARS_PER_PAGE) + '... [truncated]'
      : text;
    return `=== PAGE ${i + 1} ===\n${truncated || '[BLANK PAGE]'}`;
  }).join('\n\n');

  const userMessage = `Analyze this ${pageTexts.length}-page sales pack PDF and classify each page:

${pageContents}`;

  console.log(`Batch classifying ${pageTexts.length} pages with Claude...`);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096, // More tokens for batch response
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

    // Validate and enhance response
    const pages = (result.pages || []).map((p: { documentType?: string; confidence?: number }) => ({
      documentType: p.documentType || 'other',
      documentTypeName: DOCUMENT_TYPE_NAMES[p.documentType || 'other'] || 'Other Document',
      confidence: p.confidence || 50,
    }));

    const documentGroups = (result.documentGroups || []).map((g: { documentType?: string; pages?: number[]; confidence?: number }) => ({
      documentType: g.documentType || 'other',
      documentTypeName: DOCUMENT_TYPE_NAMES[g.documentType || 'other'] || 'Other Document',
      pages: g.pages || [],
      confidence: g.confidence || 50,
    }));

    console.log(`Batch classification complete: ${documentGroups.length} document groups identified`);

    return {
      customerName: result.customerName || '',
      pages,
      documentGroups,
    };
  } catch (err) {
    console.error('Failed to parse batch classification response:', err);
    throw new Error('Failed to parse Claude response as JSON');
  }
}

/**
 * Analyze PDF directly with Claude Vision
 * Sends the PDF as a document and asks Claude to analyze all pages
 */
async function analyzePdfWithClaude(
  pdfBase64: string,
  apiKey: string
): Promise<{
  totalPages: number;
  pageTexts: string[];
  customerName: string;
  documentGroups: BatchClassifyResponse['documentGroups'];
}> {
  const systemPrompt = `You are analyzing a multi-page "Sales Pack" PDF for a Singapore car dealership CRM.
This PDF contains multiple document types that need to be identified and grouped.

YOUR TASKS:
1. Count the total number of pages in the PDF
2. For each page, extract key text content
3. Classify each page into one of the document types
4. Group consecutive pages that belong to the same document
5. Extract the customer name (appears on multiple documents)
6. Identify and EXCLUDE blank pages from document groups

DOCUMENT TYPES (choose the BEST match for each page):
${DOCUMENT_TYPES}

GROUPING RULES:
- VSA (Vehicle Sales Agreement) is typically 2-4 pages with terms and conditions
- PDPA consent is typically 1-2 pages
- NRIC front and back should be SEPARATE documents
- Insurance documents may be 1-3 pages
- Group consecutive pages of the SAME document type together
- BLANK PAGES: Pages with no content or only page numbers/headers should be marked with "[BLANK]" in pageTexts and NOT included in any documentGroup

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "totalPages": 5,
  "customerName": "CUSTOMER NAME IN CAPS",
  "pageTexts": ["text from page 1...", "[BLANK]", "text from page 3..."],
  "documentGroups": [
    { "documentType": "vsa", "pages": [1], "confidence": 95 },
    { "documentType": "nric_front", "pages": [3], "confidence": 90 }
  ]
}

IMPORTANT:
- pageTexts array must have one entry per page with key text from that page (first 500 chars), or "[BLANK]" for blank pages
- documentGroups should NOT include blank pages - skip them
- pages in documentGroups are 1-indexed (first page is 1)`;

  console.log('Analyzing PDF with Claude Vision...');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: systemPrompt,
            },
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

    const documentGroups = (result.documentGroups || []).map((g: { documentType?: string; pages?: number[]; confidence?: number }) => ({
      documentType: g.documentType || 'other',
      documentTypeName: DOCUMENT_TYPE_NAMES[g.documentType || 'other'] || 'Other Document',
      pages: g.pages || [],
      confidence: g.confidence || 50,
    }));

    console.log(`PDF analysis complete: ${result.totalPages} pages, ${documentGroups.length} document groups`);

    return {
      totalPages: result.totalPages || 1,
      pageTexts: result.pageTexts || [],
      customerName: result.customerName || '',
      documentGroups,
    };
  } catch (err) {
    console.error('Failed to parse PDF analysis response:', err);
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
    const { imageData, rawText: preExtractedText, documentType = 'auto', sourceType, visionOnly = false, mode, pageTexts } = body;

    // Handle batch-classify mode for sales pack PDFs
    if (mode === 'batch-classify') {
      if (!pageTexts || !Array.isArray(pageTexts) || pageTexts.length === 0) {
        return new Response(
          JSON.stringify({ error: 'pageTexts array is required for batch-classify mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Batch classify mode: processing ${pageTexts.length} pages`);
      const batchResult = await batchClassifyPages(pageTexts, anthropicApiKey);

      return new Response(
        JSON.stringify(batchResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle analyze-pdf mode for direct Claude Vision PDF analysis
    if (mode === 'analyze-pdf') {
      const { pdfData } = body;
      if (!pdfData) {
        return new Response(
          JSON.stringify({ error: 'pdfData is required for analyze-pdf mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract base64 data from data URL if present
      const base64Data = pdfData.includes('base64,') ? pdfData.split('base64,')[1] : pdfData;

      console.log(`Analyze-pdf mode: sending PDF directly to Claude Vision (${base64Data.length} bytes base64)`);
      const pdfResult = await analyzePdfWithClaude(base64Data, anthropicApiKey);

      return new Response(
        JSON.stringify(pdfResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Either imageData or rawText must be provided for standard mode
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
