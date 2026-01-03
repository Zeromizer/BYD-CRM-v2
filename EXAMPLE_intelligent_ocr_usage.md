# Intelligent OCR Usage Examples

## Basic NRIC Extraction

```typescript
import { extractNricData } from '@/services/intelligentOcrService';

// In your document upload handler
async function handleNricUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await extractNricData(buffer);

  console.log('Raw OCR text:', result.rawText);
  console.log('Structured data:', result.structuredData);

  // Auto-fill customer form
  if (result.structuredData.validation.confidence === 'high') {
    updateCustomerForm({
      nric: result.structuredData.nric,
      name: result.structuredData.name,
      dob: result.structuredData.dateOfBirth,
      address: result.structuredData.address
    });
  } else {
    // Show warning and let user verify
    showValidationWarning(result.structuredData.validation.issues);
  }
}
```

## VSA Form Processing with Validation

```typescript
import { extractVsaFormData } from '@/services/intelligentOcrService';

async function handleVsaFormUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await extractVsaFormData(buffer);

  // Check if calculations are correct
  if (!result.structuredData.validation.totalsMatch) {
    showAlert('Warning: VSA form calculations may be incorrect', {
      issues: result.structuredData.validation.issues,
      rawData: result.rawText
    });
  }

  // Auto-fill VSA fields
  updateVsaForm({
    vsa_selling_price: result.structuredData.sellingPrice,
    vsa_purchase_price_with_coe: result.structuredData.sellingPrice + result.structuredData.coeAmount,
    vsa_deposit: result.structuredData.deposit,
    vsa_loan_amount: result.structuredData.loanAmount
  });
}
```

## Cost Comparison Dashboard

### Scenario: 500 documents/month

| Document Type | Count | Service | Monthly Cost | Savings vs All-Claude |
|--------------|-------|---------|--------------|----------------------|
| NRIC scans (800×800) | 200 | Vision → Claude (cached) | $0.45 | $0.22 (33%) |
| VSA forms (1200×1200) | 150 | Vision → Claude (cached) | $0.51 | $0.15 (23%) |
| Trade-in docs (800×800) | 100 | Vision → Claude (cached) | $0.23 | $0.11 (33%) |
| Misc documents | 50 | Vision only | $0.08 | N/A |
| **Total** | **500** | **Hybrid** | **$1.27** | **$0.48 (27% cheaper)** |

**All Claude (direct image):** $1.75/month
**Hybrid (Vision → Claude cached):** $1.27/month
**All Vision (no intelligence):** $0.75/month

## When to Use Each Approach

### Use Vision → Claude (Cached)
✅ Repeated document types (NRIC, passport, VSA forms)
✅ Need validation and structured extraction
✅ Processing >10 similar documents/month (caching kicks in)
✅ Complex multi-field forms

### Use Vision Only
✅ Simple text extraction
✅ One-off document types
✅ Budget-critical projects
✅ Don't need validation

### Use Direct Claude (Image)
✅ Very small images (<400×400 px)
✅ Processing <10 documents/month
✅ Need Claude to see image context (layout, formatting)

## Advanced: Custom Document Types

```typescript
import { extractDocumentData } from '@/services/intelligentOcrService';

// Trade-in vehicle valuation form
const customPrompt = `Extract vehicle trade-in information.

Return JSON:
{
  "vehiclePlate": "SXX1234A",
  "make": "Toyota",
  "model": "Camry",
  "year": 2018,
  "mileage": 80000,
  "quotedValue": 45000,
  "settlementAmount": 12000,
  "netValue": 33000,
  "validation": {
    "calculationCorrect": true,
    "issues": []
  }
}`;

const result = await extractDocumentData<TradeInData>(
  imageBuffer,
  'trade_in_valuation',
  customPrompt
);
```

## Debugging: See What's Happening

```typescript
const result = await extractNricData(buffer);

// View raw OCR output (helps debug OCR issues)
console.log('OCR extracted:', result.rawText);

// View Claude's structured interpretation
console.log('Claude extracted:', result.structuredData);

// Check confidence
if (result.confidence < 0.7) {
  // Manual review needed
  showManualReviewDialog(result.rawText, result.structuredData);
}

// Performance monitoring
console.log(`Processed in ${result.processingTime}ms`);
```

## Prompt Caching Strategy

The key to cost savings is **using consistent system prompts**:

```typescript
// ✅ GOOD: Same system prompt = cached after first call
for (const nricImage of nricImages) {
  await extractNricData(nricImage); // Calls 2+ are 90% cheaper
}

// ❌ BAD: Different prompts = no caching benefit
for (const nricImage of nricImages) {
  await extractDocumentData(nricImage, 'nric', differentPromptEachTime);
}
```

**Cache duration**: 5 minutes (Anthropic's cache TTL)
**Best practice**: Process similar documents in batches

## Cost Optimization Tips

1. **Batch similar documents together** (within 5 min window for cache)
2. **Use standard document type functions** (extractNricData, extractVsaFormData) instead of custom prompts
3. **Resize images before OCR** (800×800 is optimal for ID cards)
4. **Use batch API for non-urgent processing** (50% additional discount)
5. **Monitor cache hit rates** in Anthropic dashboard

## Expected Performance

| Metric | Value |
|--------|-------|
| **OCR accuracy** | 98% (Vision) |
| **Extraction accuracy** | 92-95% (Claude) |
| **Processing time** | 2-4 seconds total |
| **Cost per document** | $0.00225 (with caching) |
| **Cache hit rate** | 85-95% (for repeated doc types) |
