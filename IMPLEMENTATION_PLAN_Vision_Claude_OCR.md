# Implementation Plan: Vision → Claude OCR (Testing Option)

## Current State Analysis

### ✅ Already Implemented
1. **Document Upload System** (`customerDocumentService.ts`)
   - Supabase storage integration
   - Folder organization by document type
   - URL caching (6-hour cache)
   - Batch operations
   - Multi-file upload support

2. **AI Classification** (`documentClassifierService.ts`)
   - Gemini 2.5 Flash via Edge Function
   - Document type detection (NRIC, VSA, passport, etc.)
   - Batch processing with 1.5s rate limiting
   - Excel file classification by filename
   - Confidence scoring

3. **UI Components** (`DocumentsTab.tsx`)
   - "Import from Folder" button
   - AI scan workflow
   - Classification results review
   - Manual type correction
   - Progress tracking

4. **Document Migration** (`documentMigrationService.ts`)
   - Bulk folder import
   - File filtering
   - Progress callbacks

### ❌ Not Implemented (What We Need to Build)
1. Google Cloud Vision API integration
2. Claude Haiku 4.5 API integration
3. Vision → Claude hybrid OCR pipeline
4. Enhanced bulk import with Vision + Claude
5. A/B testing UI (compare Gemini vs Vision+Claude)

---

## Implementation Steps

### Phase 1: Setup & Dependencies (30 min)

#### Step 1.1: Install NPM Packages
```bash
npm install @google-cloud/vision @anthropic-ai/sdk
```

**Files to modify:** `package.json`

#### Step 1.2: Add Environment Variables
Add to `.env`:
```env
VITE_GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Files to modify:** `.env`, `.env.example`

#### Step 1.3: Update TypeScript Types
**Files to create:**
- `src/types/ocr.types.ts` - Shared OCR types for both approaches

---

### Phase 2: Core Services (2-3 hours)

#### Step 2.1: Create Vision OCR Service
**File:** `src/services/visionOcrService.ts`

**What it does:**
- Google Cloud Vision API wrapper
- Convert File → base64
- Extract text with 98% accuracy
- Batch processing support
- Error handling & retries

**Key functions:**
```typescript
export async function extractTextWithVision(imageBuffer: Buffer): Promise<string>
export async function batchExtractText(files: File[]): Promise<Map<string, string>>
```

**Dependencies:**
- `@google-cloud/vision`
- Environment variable: `VITE_GOOGLE_CLOUD_API_KEY`

---

#### Step 2.2: Create Claude Processing Service
**File:** `src/services/claudeProcessingService.ts`

**What it does:**
- Claude Haiku 4.5 API wrapper
- Intelligent document classification
- Data extraction and validation
- Prompt caching for cost optimization

**Key functions:**
```typescript
export async function classifyWithClaude(
  rawText: string,
  documentType: 'auto' | 'nric' | 'vsa' | 'trade_in'
): Promise<ClaudeClassification>

export async function extractNricWithClaude(rawText: string): Promise<NricData>
export async function extractVsaWithClaude(rawText: string): Promise<VsaData>
```

**Prompt caching strategy:**
- System prompts cached for 90% savings
- 5-minute TTL
- Consistent prompt formatting

---

#### Step 2.3: Create Hybrid Vision+Claude Service
**File:** `src/services/hybridOcrService.ts`

**What it does:**
- Orchestrates Vision → Claude pipeline
- Combines best of both services
- Maintains backward compatibility

**Key functions:**
```typescript
export async function classifyDocumentHybrid(
  file: File,
  onProgress?: (stage: string) => void
): Promise<HybridClassificationResult>

export async function batchClassifyHybrid(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<HybridClassificationResult[]>
```

**Process:**
1. Vision OCR → raw text (98% accuracy)
2. Claude classification → structured data
3. Return combined result with confidence

---

#### Step 2.4: Update Bulk Import Service
**File:** `src/services/bulkDocumentImportService.ts` (already created, needs integration)

**Modifications needed:**
- Add `ocrMethod` parameter: `'gemini' | 'vision-claude'`
- Support both classification approaches
- Maintain existing Gemini workflow

**New function:**
```typescript
export async function processBulkDocuments(
  files: File[],
  customers: Customer[],
  options: {
    ocrMethod: 'gemini' | 'vision-claude';
    onProgress?: (progress: BulkImportProgress) => void;
  }
): Promise<ProcessedDocument[]>
```

---

### Phase 3: UI Integration (2-3 hours)

#### Step 3.1: Add Scan Method Selector to DocumentsTab
**File:** `src/components/CustomerDetails/tabs/DocumentsTab.tsx`

**Changes:**
1. Add state for OCR method selection:
```typescript
const [scanMethod, setScanMethod] = useState<'gemini' | 'vision-claude'>('gemini');
```

2. Update Migration Modal with method selector:
```tsx
<div className="scan-method-selector">
  <label>
    <input
      type="radio"
      value="gemini"
      checked={scanMethod === 'gemini'}
      onChange={(e) => setScanMethod(e.target.value as 'gemini')}
    />
    Gemini AI (Current) - Fast, good for general docs
  </label>
  <label>
    <input
      type="radio"
      value="vision-claude"
      checked={scanMethod === 'vision-claude'}
      onChange={(e) => setScanMethod(e.target.value as 'vision-claude')}
    />
    Vision + Claude (New) - High accuracy, structured extraction
  </label>
</div>
```

3. Update `handleAIScan` to use selected method:
```typescript
const handleAIScan = async () => {
  if (scanMethod === 'gemini') {
    // Existing Gemini flow
    await classifyDocuments(...);
  } else {
    // New Vision + Claude flow
    await classifyDocumentsHybrid(...);
  }
};
```

**UI Preview:**
```
┌─────────────────────────────────────────┐
│ Import Documents from Folder            │
├─────────────────────────────────────────┤
│                                         │
│ Found 47 documents to import            │
│                                         │
│ Choose scan method:                     │
│ ○ Gemini AI (Current)                  │
│   Fast, good for general documents     │
│                                         │
│ ● Vision + Claude (New) [TESTING]      │
│   Higher accuracy, better extraction   │
│                                         │
│ [Cancel] [✨ Scan with AI]              │
└─────────────────────────────────────────┘
```

---

#### Step 3.2: Update Classification Results Display
**File:** Same as above (`DocumentsTab.tsx`)

**Enhancement:**
Show OCR method used in results:
```tsx
<div className="classification-header">
  <span>Scanned with: {scanMethod === 'gemini' ? 'Gemini AI' : 'Vision + Claude'}</span>
  <span className="accuracy-badge">
    {scanMethod === 'vision-claude' && '98% OCR Accuracy'}
  </span>
</div>
```

---

### Phase 4: Cost Tracking & Analytics (1 hour)

#### Step 4.1: Create OCR Analytics Service
**File:** `src/services/ocrAnalyticsService.ts`

**What it does:**
- Track OCR usage by method
- Calculate costs
- Store in Supabase (optional)

**Schema (optional table):**
```sql
CREATE TABLE ocr_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  method TEXT, -- 'gemini' or 'vision-claude'
  documents_processed INT,
  total_cost DECIMAL(10,4),
  average_confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key functions:**
```typescript
export function trackOcrUsage(
  method: 'gemini' | 'vision-claude',
  documentsProcessed: number,
  averageConfidence: number
): void

export function calculateCost(
  method: 'gemini' | 'vision-claude',
  documentsProcessed: number
): number
```

---

#### Step 4.2: Add Cost Display to UI
**File:** `DocumentsTab.tsx`

**Enhancement:**
```tsx
{classifiedFiles.length > 0 && (
  <div className="scan-summary">
    <span>Processed: {classifiedFiles.length} files</span>
    <span>Method: {scanMethod}</span>
    <span>
      Estimated cost: $
      {calculateCost(scanMethod, classifiedFiles.length).toFixed(4)}
    </span>
    <span>
      Avg confidence:{' '}
      {(
        classifiedFiles.reduce((sum, f) => sum + f.classification.confidence, 0) /
        classifiedFiles.length
      ).toFixed(1)}
      %
    </span>
  </div>
)}
```

---

### Phase 5: Testing & Validation (1-2 hours)

#### Step 5.1: Create Test Document Set
**Location:** `test-documents/`

**Structure:**
```
test-documents/
├── nric/
│   ├── sample-nric-1.jpg
│   ├── sample-nric-2.jpg
│   └── sample-nric-blurry.jpg
├── vsa/
│   ├── sample-vsa-1.pdf
│   └── sample-vsa-2.xlsx
├── trade-in/
│   ├── valuation-1.jpg
│   └── valuation-2.pdf
└── mixed/
    └── 20-random-docs.zip
```

#### Step 5.2: A/B Testing Workflow
1. Import same folder with Gemini
2. Note: accuracy, speed, cost
3. Import same folder with Vision+Claude
4. Compare results side-by-side

**Create comparison table:**
| Metric | Gemini | Vision+Claude |
|--------|--------|---------------|
| Accuracy | ? | ? |
| Speed | ? | ? |
| Cost (100 docs) | ? | ? |
| NRIC extraction | ? | ? |
| VSA extraction | ? | ? |

---

### Phase 6: Documentation & Polish (30 min)

#### Step 6.1: Update CODEBASE.md
Add new services to documentation:
- `visionOcrService.ts` - Google Cloud Vision integration
- `claudeProcessingService.ts` - Claude Haiku 4.5 processing
- `hybridOcrService.ts` - Vision → Claude pipeline
- `ocrAnalyticsService.ts` - Usage tracking

#### Step 6.2: Create Migration Guide
**File:** `MIGRATION_GUIDE_Vision_Claude.md`

Instructions for:
- How to enable Vision+Claude
- API key setup
- Cost estimates
- Troubleshooting

---

## File Checklist

### Files to Create (New)
- [ ] `src/types/ocr.types.ts`
- [ ] `src/services/visionOcrService.ts`
- [ ] `src/services/claudeProcessingService.ts`
- [ ] `src/services/hybridOcrService.ts`
- [ ] `src/services/ocrAnalyticsService.ts`
- [ ] `MIGRATION_GUIDE_Vision_Claude.md`
- [ ] `test-documents/` (folder with samples)

### Files to Modify (Existing)
- [ ] `src/components/CustomerDetails/tabs/DocumentsTab.tsx`
  - Add scan method selector
  - Update `handleAIScan` with method routing
  - Add cost/analytics display
- [ ] `src/services/bulkDocumentImportService.ts`
  - Add `ocrMethod` parameter support
- [ ] `CODEBASE.md`
  - Document new services
- [ ] `package.json`
  - Add dependencies
- [ ] `.env.example`
  - Add new API key placeholders

### Files to Keep Unchanged (Preserved)
- ✅ `src/services/documentClassifierService.ts` - Keep Gemini working
- ✅ `src/services/customerDocumentService.ts` - No changes needed
- ✅ `src/services/geminiService.ts` - Keep existing
- ✅ All existing UI components (except DocumentsTab)

---

## Implementation Order

**Recommended sequence:**

1. **Day 1: Backend Foundation**
   - Install dependencies
   - Create `visionOcrService.ts`
   - Create `claudeProcessingService.ts`
   - Test individually with console logs

2. **Day 2: Integration**
   - Create `hybridOcrService.ts`
   - Update `bulkDocumentImportService.ts`
   - End-to-end testing

3. **Day 3: UI & Testing**
   - Update `DocumentsTab.tsx` with selector
   - A/B test with real documents
   - Compare accuracy and costs

4. **Day 4: Polish**
   - Add analytics
   - Update documentation
   - Performance optimization

---

## Testing Strategy

### Unit Tests (Optional but Recommended)
```typescript
// Test Vision OCR
test('Vision OCR extracts NRIC correctly', async () => {
  const result = await extractTextWithVision(nricImageBuffer);
  expect(result).toContain('S1234567A');
});

// Test Claude Classification
test('Claude classifies NRIC document', async () => {
  const result = await classifyWithClaude(nricOcrText, 'auto');
  expect(result.documentType).toBe('nric');
  expect(result.confidence).toBeGreaterThan(0.9);
});
```

### Integration Tests
1. **Upload 10 NRIC scans** with both methods → Compare extraction accuracy
2. **Upload 10 VSA forms** with both methods → Compare field extraction
3. **Upload 50 mixed docs** → Compare overall performance

### Success Criteria
- [ ] Vision+Claude accuracy ≥ 95% (vs Gemini ~85-90%)
- [ ] Cost per document ≤ $0.005 (with caching)
- [ ] Processing time ≤ 5 seconds per document
- [ ] Zero breaking changes to existing Gemini workflow
- [ ] UI allows easy switching between methods

---

## Cost Estimates

### Per 100 Documents (Average 800×800px images)

| Method | Cost | Breakdown |
|--------|------|-----------|
| **Gemini (Current)** | ~$0.10 | Edge function calls |
| **Vision+Claude (No cache)** | **$0.50** | Vision: $0.15, Claude: $0.35 |
| **Vision+Claude (With cache)** | **$0.23** | Vision: $0.15, Claude: $0.08 |

**Savings with caching:** ~54% cheaper after first batch

---

## Rollback Plan

If Vision+Claude has issues:
1. User can select "Gemini AI (Current)" in UI
2. All existing functionality remains untouched
3. No data migration needed
4. Simply revert DocumentsTab.tsx changes

---

## Next Steps After Implementation

1. **Collect user feedback** on accuracy improvements
2. **Monitor costs** in production
3. **Gradually migrate** to Vision+Claude if successful
4. **Deprecate Gemini** option after 3-6 months (optional)
5. **Add more document types** (passports, licenses, etc.)

---

## Questions to Answer During Testing

- [ ] Which method has better NRIC extraction accuracy?
- [ ] Which handles handwritten text better?
- [ ] Which is more cost-effective at scale (100+ docs/day)?
- [ ] Which provides better structured data extraction?
- [ ] Is prompt caching reliable in production?
- [ ] What's the failure rate for each method?

---

## Support & Resources

- **Google Cloud Vision Docs:** https://cloud.google.com/vision/docs
- **Anthropic Claude API Docs:** https://docs.anthropic.com/
- **Current Gemini Implementation:** `src/services/documentClassifierService.ts`
- **Existing bulk import:** `src/components/CustomerDetails/tabs/DocumentsTab.tsx:586-616`
