/**
 * Intelligent OCR Service
 *
 * Two-step approach:
 * 1. Google Cloud Vision - High-accuracy OCR text extraction
 * 2. Claude Haiku 4.5 - Intelligent processing, validation, and structuring
 *
 * This approach optimizes for both accuracy and cost while enabling
 * sophisticated document understanding.
 */

import Anthropic from '@anthropic-ai/sdk';

// Types
export interface NricData {
  nric: string;
  name: string;
  dateOfBirth: string;
  address: string;
  race?: string;
  sex?: string;
  validation: {
    nricValid: boolean;
    ageCalculated: number;
    confidence: 'high' | 'medium' | 'low';
    issues: string[];
  };
}

export interface VsaFormData {
  customerName: string;
  nric: string;
  vehicleModel: string;
  sellingPrice: number;
  coeAmount: number;
  deposit: number;
  loanAmount: number;
  validation: {
    totalsMatch: boolean;
    allFieldsPresent: boolean;
    calculatedTotal: number;
    issues: string[];
  };
}

export interface OcrResult<T = any> {
  rawText: string;
  structuredData: T;
  confidence: number;
  processingTime: number;
}

// Google Cloud Vision OCR
async function extractTextWithVision(imageBuffer: Buffer): Promise<string> {
  // Placeholder - implement based on your setup
  // Option 1: Use @google-cloud/vision SDK
  // Option 2: Use REST API with fetch

  const vision = await import('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient({
    apiKey: import.meta.env.VITE_GOOGLE_CLOUD_API_KEY
  });

  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  });

  return result.fullTextAnnotation?.text || '';
}

// Claude Haiku 4.5 - Intelligent Processing
async function processWithClaude<T>(
  rawText: string,
  documentType: 'nric' | 'passport' | 'vsa_form' | 'trade_in_doc',
  systemPrompt: string
): Promise<T> {
  const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY
  });

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20241022',
    max_tokens: 1024,
    // Enable prompt caching for system prompt (saves 90% on repeated calls)
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Extract and validate information from this ${documentType} OCR text:\n\n${rawText}`
      }
    ]
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return JSON.parse(content.text);
  }

  throw new Error('Unexpected response format from Claude');
}

/**
 * Extract NRIC information with validation
 */
export async function extractNricData(imageBuffer: Buffer): Promise<OcrResult<NricData>> {
  const startTime = Date.now();

  // Step 1: Google Cloud Vision OCR (high accuracy)
  const rawText = await extractTextWithVision(imageBuffer);

  // Step 2: Claude intelligent processing
  const systemPrompt = `You are an expert at extracting and validating Singapore NRIC (National Registration Identity Card) information.

Your task:
1. Extract all relevant fields from the OCR text
2. Validate the NRIC format (should match: [STFG]\\d{7}[A-Z])
3. Calculate age from date of birth
4. Check for data consistency
5. Identify any missing or unclear fields

Return ONLY a JSON object with this exact structure:
{
  "nric": "S1234567A",
  "name": "FULL NAME",
  "dateOfBirth": "YYYY-MM-DD",
  "address": "FULL ADDRESS",
  "race": "Race (if visible)",
  "sex": "M or F (if visible)",
  "validation": {
    "nricValid": true/false,
    "ageCalculated": 35,
    "confidence": "high/medium/low",
    "issues": ["List any problems like unclear text, missing fields, format errors"]
  }
}`;

  const structuredData = await processWithClaude<NricData>(
    rawText,
    'nric',
    systemPrompt
  );

  return {
    rawText,
    structuredData,
    confidence: structuredData.validation.confidence === 'high' ? 0.95 :
                structuredData.validation.confidence === 'medium' ? 0.75 : 0.5,
    processingTime: Date.now() - startTime
  };
}

/**
 * Extract VSA form data with financial validation
 */
export async function extractVsaFormData(imageBuffer: Buffer): Promise<OcrResult<VsaFormData>> {
  const startTime = Date.now();

  // Step 1: OCR with Google Vision
  const rawText = await extractTextWithVision(imageBuffer);

  // Step 2: Claude processing with financial validation
  const systemPrompt = `You are an expert at processing Vehicle Sales Agreement (VSA) forms for BYD Singapore.

Your task:
1. Extract all customer and vehicle information
2. Extract all pricing fields (selling price, COE, deposit, loan amount, etc.)
3. Validate that totals add up correctly
4. Check for missing required fields
5. Flag any inconsistencies

Key calculations to verify:
- Total Price = Selling Price + COE Amount
- Loan Amount = Total Price - Deposit
- All currency values should be in SGD

Return ONLY a JSON object with this structure:
{
  "customerName": "Name",
  "nric": "S1234567A",
  "vehicleModel": "BYD Model",
  "sellingPrice": 123456.78,
  "coeAmount": 50000.00,
  "deposit": 10000.00,
  "loanAmount": 163456.78,
  "validation": {
    "totalsMatch": true/false,
    "allFieldsPresent": true/false,
    "calculatedTotal": 173456.78,
    "issues": ["List calculation errors, missing fields, inconsistencies"]
  }
}`;

  const structuredData = await processWithClaude<VsaFormData>(
    rawText,
    'vsa_form',
    systemPrompt
  );

  return {
    rawText,
    structuredData,
    confidence: structuredData.validation.allFieldsPresent && structuredData.validation.totalsMatch ? 0.95 : 0.7,
    processingTime: Date.now() - startTime
  };
}

/**
 * Generic document extraction with custom prompt
 */
export async function extractDocumentData<T = any>(
  imageBuffer: Buffer,
  documentType: string,
  customSystemPrompt: string
): Promise<OcrResult<T>> {
  const startTime = Date.now();

  // Step 1: OCR
  const rawText = await extractTextWithVision(imageBuffer);

  // Step 2: Intelligent processing
  const structuredData = await processWithClaude<T>(
    rawText,
    documentType as any,
    customSystemPrompt
  );

  return {
    rawText,
    structuredData,
    confidence: 0.85,
    processingTime: Date.now() - startTime
  };
}

/**
 * Batch processing with cost optimization
 */
export async function batchExtractDocuments(
  documents: Array<{ buffer: Buffer; type: 'nric' | 'vsa_form' }>
): Promise<OcrResult[]> {
  // Process all OCR in parallel (fast)
  const ocrPromises = documents.map(doc => extractTextWithVision(doc.buffer));
  const rawTexts = await Promise.all(ocrPromises);

  // Process with Claude (can use batch API for 50% discount)
  const results: OcrResult[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const rawText = rawTexts[i];

    if (doc.type === 'nric') {
      const systemPrompt = getNricSystemPrompt();
      const structuredData = await processWithClaude<NricData>(rawText, 'nric', systemPrompt);
      results.push({
        rawText,
        structuredData,
        confidence: 0.9,
        processingTime: 0
      });
    } else if (doc.type === 'vsa_form') {
      const systemPrompt = getVsaSystemPrompt();
      const structuredData = await processWithClaude<VsaFormData>(rawText, 'vsa_form', systemPrompt);
      results.push({
        rawText,
        structuredData,
        confidence: 0.9,
        processingTime: 0
      });
    }
  }

  return results;
}

// Helper functions for system prompts (can be cached)
function getNricSystemPrompt(): string {
  return `You are an expert at extracting and validating Singapore NRIC information...`;
}

function getVsaSystemPrompt(): string {
  return `You are an expert at processing Vehicle Sales Agreement (VSA) forms...`;
}
