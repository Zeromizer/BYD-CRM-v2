# Bulk Document Import & Classification Workflow

## Overview

When importing a folder of mixed documents (images, PDFs, Excel files), the system will:
1. **Scan & Identify** - Detect file types and filter processable documents
2. **Extract & Classify** - Use Vision OCR + Claude for images/PDFs, direct parsing for Excel
3. **Validate & Match** - Link documents to customers via NRIC/name matching
4. **Rename & Organize** - Apply standardized naming and folder structure
5. **Upload & Index** - Store in Supabase with metadata

---

## Process Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ACTION: Select Folder with Documents                      │
│  (Mixed: JPG, PNG, PDF, XLSX, etc.)                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: FILE SCANNING & TYPE DETECTION                         │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Scan all files in folder                              │     │
│  │ Group by file type:                                   │     │
│  │   • Images: .jpg, .jpeg, .png, .heic                 │     │
│  │   • PDFs: .pdf                                        │     │
│  │   • Excel: .xlsx, .xls                                │     │
│  │   • Unsupported: Skip with warning                    │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  IMAGES & PDFs           │   │  EXCEL FILES             │
│  (Need OCR)              │   │  (Direct Extraction)     │
└──────────┬───────────────┘   └──────────┬───────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2A: OCR EXTRACTION (Images/PDFs)                          │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Google Cloud Vision API                               │     │
│  │ • Batch process all images in parallel                │     │
│  │ • Extract raw text with 98% accuracy                  │     │
│  │ • Cost: $0.0015 per image                            │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2B: EXCEL DATA EXTRACTION                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ xlsx-populate library                                 │     │
│  │ • Parse Excel structure                               │     │
│  │ • Detect if it's a VSA form / customer list           │     │
│  │ • Extract customer data from known patterns           │     │
│  │ • No OCR needed - direct data access                  │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: INTELLIGENT CLASSIFICATION (Claude Haiku 4.5)          │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Process raw text/data with Claude:                    │     │
│  │                                                        │     │
│  │ For each document, extract:                           │     │
│  │   • Document type (NRIC, Passport, VSA, Trade-in, etc)│     │
│  │   • Customer NRIC (for matching)                      │     │
│  │   • Customer name                                      │     │
│  │   • Key fields (dates, amounts, vehicle info)         │     │
│  │   • Confidence score                                   │     │
│  │                                                        │     │
│  │ Cost: $0.00075 per document (with prompt caching)     │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: CUSTOMER MATCHING                                      │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Match documents to existing customers:                │     │
│  │                                                        │     │
│  │ 1. Try NRIC exact match (primary key)                │     │
│  │ 2. Try fuzzy name match (if NRIC not found)          │     │
│  │ 3. Suggest creating new customer (if no match)       │     │
│  │                                                        │     │
│  │ Output:                                                │     │
│  │   • Matched customer ID                                │     │
│  │   • Match confidence (high/medium/low)                │     │
│  │   • Suggested action (auto-attach / review / create)  │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: FILE RENAMING                                          │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Standardized naming convention:                       │     │
│  │                                                        │     │
│  │ Format: {DocType}_{NRIC}_{Name}_{Date}.{ext}         │     │
│  │                                                        │     │
│  │ Examples:                                              │     │
│  │   • NRIC_S1234567A_JohnTan_20260102.jpg              │     │
│  │   • VSA_S7654321B_MaryLim_20260102.pdf               │     │
│  │   • Passport_G9876543_AlexWong_20260102.jpg          │     │
│  │   • TradeIn_S1111111A_DavidChua_20260102.xlsx        │     │
│  │   • Insurance_S2222222B_SarahNg_20260102.pdf         │     │
│  │                                                        │     │
│  │ Sanitization: Remove special chars, spaces → underscores │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: FOLDER ORGANIZATION                                    │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Supabase Storage Structure:                           │     │
│  │                                                        │     │
│  │ customer-documents/                                    │     │
│  │   └── {customer_id}/                                   │     │
│  │       ├── identity/                                    │     │
│  │       │   ├── NRIC_S1234567A_JohnTan_20260102.jpg    │     │
│  │       │   └── Passport_G9876543_JohnTan_20251215.pdf │     │
│  │       ├── vsa/                                         │     │
│  │       │   └── VSA_S1234567A_JohnTan_20260102.pdf     │     │
│  │       ├── trade_in/                                    │     │
│  │       │   ├── TradeIn_S1234567A_JohnTan_20260102.xlsx│     │
│  │       │   └── TradeInPhotos_20260102.jpg             │     │
│  │       ├── insurance/                                   │     │
│  │       │   └── Insurance_S1234567A_JohnTan.pdf        │     │
│  │       ├── registration/                                │     │
│  │       ├── delivery/                                    │     │
│  │       └── miscellaneous/                              │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: UPLOAD & INDEX                                         │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • Upload to Supabase Storage                          │     │
│  │ • Update document_checklist in customer record        │     │
│  │ • Store metadata:                                      │     │
│  │   - Original filename                                  │     │
│  │   - Document type                                      │     │
│  │   - Extracted data (NRIC, name, dates, amounts)       │     │
│  │   - Classification confidence                          │     │
│  │   - Upload timestamp                                   │     │
│  │   - Processing status                                  │     │
│  └───────────────────────────────────────────────────────┘     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 8: USER REVIEW INTERFACE                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Show results table:                                    │     │
│  │                                                        │     │
│  │ Filename | DocType | Customer | Confidence | Action   │     │
│  │ ---------|---------|----------|------------|--------- │     │
│  │ img1.jpg | NRIC    | John Tan | High ✓     | Auto ✓  │     │
│  │ form.pdf | VSA     | Mary Lim | High ✓     | Auto ✓  │     │
│  │ scan.jpg | Unknown | -        | Low ⚠      | Review  │     │
│  │ doc2.pdf | NRIC    | New?     | Medium ⚠   | Create? │     │
│  │                                                        │     │
│  │ User can:                                              │     │
│  │   • Approve auto-matched documents                     │     │
│  │   • Manually correct misclassifications                │     │
│  │   • Create new customers for unmatched docs           │     │
│  │   • Skip/delete irrelevant files                      │     │
│  └───────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Document Type Classification Rules

### Supported Document Types

| Document Type | File Extensions | Detection Keywords | Target Folder |
|--------------|----------------|-------------------|---------------|
| **NRIC** | jpg, png, pdf | "NRIC", "Identity Card", "Singapore", NRIC pattern | `identity/` |
| **Passport** | jpg, png, pdf | "PASSPORT", "Republic of", passport MRZ | `identity/` |
| **Driver's License** | jpg, png, pdf | "Driving Licence", "Traffic Police" | `identity/` |
| **VSA Form** | pdf, xlsx | "VSA", "Vehicle Sales Agreement", "BYD" | `vsa/` |
| **Trade-in Valuation** | pdf, xlsx, jpg | "Trade-in", "Valuation", car plate pattern | `trade_in/` |
| **Insurance Certificate** | pdf | "Insurance", "Policy", "Premium" | `insurance/` |
| **Registration Certificate** | pdf, jpg | "Registration", "LTA", "Certificate of Entitlement" | `registration/` |
| **COE Document** | pdf | "COE", "Certificate of Entitlement", "Open Bid" | `registration/` |
| **Bank Loan Approval** | pdf | "Loan Approval", "Bank", "Credit Facility" | `vsa/` |
| **Delivery Order** | pdf, jpg | "Delivery Order", "Vehicle Handover" | `delivery/` |
| **Miscellaneous** | any | (fallback) | `miscellaneous/` |

---

## Excel File Handling

### Excel Document Types

```typescript
// Different Excel file patterns in BYD CRM

1. VSA Form Template (single customer)
   - Pattern: Has cells like "Customer Name", "NRIC", "Vehicle Model"
   - Extraction: Read specific cells to get customer data
   - Classification: "VSA"

2. Customer List / Import (multiple customers)
   - Pattern: Row 1 has headers (Name, NRIC, Phone, etc.)
   - Extraction: Parse each row as a customer
   - Classification: "Customer Import"

3. Trade-in Valuation Sheet
   - Pattern: Vehicle details, quoted price, settlement
   - Extraction: Vehicle info + financial data
   - Classification: "Trade-in"

4. Pricing/Quotation Template
   - Pattern: Model, price breakdown, benefits
   - Extraction: Proposal data
   - Classification: "Proposal"
```

### Excel Processing Logic

```typescript
async function classifyExcelFile(workbook: XlsxWorkbook): Promise<ExcelClassification> {
  const sheet = workbook.sheet(0);

  // Sample cells to determine type
  const A1 = sheet.cell('A1').value();
  const A2 = sheet.cell('A2').value();
  const B1 = sheet.cell('B1').value();

  // Check for VSA template
  if (containsAny([A1, A2, B1], ['Customer Name', 'NRIC', 'VSA No'])) {
    return {
      type: 'vsa_form',
      customerData: extractVsaFromExcel(sheet),
      confidence: 'high'
    };
  }

  // Check for customer list
  if (containsAny([A1, B1], ['Name', 'NRIC', 'Phone', 'Email'])) {
    return {
      type: 'customer_list',
      customers: extractCustomerListFromExcel(sheet),
      confidence: 'high'
    };
  }

  // Check for trade-in valuation
  if (containsAny([A1, A2], ['Trade-in', 'Vehicle Plate', 'Valuation'])) {
    return {
      type: 'trade_in',
      customerData: extractTradeInFromExcel(sheet),
      confidence: 'medium'
    };
  }

  // Unknown - use Claude to analyze
  const sampleText = extractFirstNRowsAsText(sheet, 10);
  return await classifyWithClaude(sampleText, 'excel');
}
```

---

## File Naming Convention

### Standard Format

```
{DocType}_{NRIC}_{Name}_{Date}_{Optional}.{ext}
```

### Examples by Document Type

| Original Filename | Detected Type | Extracted Data | Final Filename |
|------------------|---------------|----------------|----------------|
| `IMG_20260102_143022.jpg` | NRIC | S1234567A, John Tan | `NRIC_S1234567A_JohnTan_20260102.jpg` |
| `scan0001.pdf` | VSA Form | S7654321B, Mary Lim | `VSA_S7654321B_MaryLim_20260102.pdf` |
| `document.xlsx` | Trade-in | S1111111A, David Chua | `TradeIn_S1111111A_DavidChua_20260102.xlsx` |
| `photo.heic` | Passport | G9876543, Alex Wong | `Passport_G9876543_AlexWong_20260102.jpg` |
| `form_v2_final.pdf` | Insurance | S2222222B, Sarah Ng | `Insurance_S2222222B_SarahNg_20260102.pdf` |

### Naming Rules

1. **Document Type Prefix**: Standardized codes (NRIC, VSA, Passport, TradeIn, etc.)
2. **NRIC/ID**: Primary identifier for matching
3. **Name**: Sanitized customer name (remove spaces, special chars)
4. **Date**: YYYYMMDD format (upload date or document date)
5. **Optional**: Counter if multiple same-type docs (e.g., `_001`, `_002`)
6. **Extension**: Original extension or converted (HEIC → JPG)

### Sanitization

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace special chars
    .replace(/_{2,}/g, '_')            // Collapse multiple underscores
    .replace(/^_+|_+$/g, '')           // Trim underscores
    .substring(0, 100);                 // Max 100 chars
}
```

---

## Customer Matching Algorithm

### Priority Order

```
1. Exact NRIC match (100% confidence)
   └─> Auto-attach to customer

2. Fuzzy name match (>85% similarity)
   └─> Suggest customer, require confirmation

3. Phone/Email match (if found in document)
   └─> Suggest customer, medium confidence

4. No match found
   └─> Offer to create new customer with extracted data
```

### Matching Logic

```typescript
async function matchDocumentToCustomer(
  extractedData: ExtractedDocumentData,
  customers: Customer[]
): Promise<CustomerMatch> {

  // 1. Exact NRIC match
  if (extractedData.nric) {
    const exactMatch = customers.find(c => c.nric === extractedData.nric);
    if (exactMatch) {
      return {
        customerId: exactMatch.id,
        confidence: 'high',
        matchType: 'nric_exact',
        suggestedAction: 'auto_attach'
      };
    }
  }

  // 2. Fuzzy name match
  if (extractedData.name) {
    const nameMatches = customers.map(c => ({
      customer: c,
      similarity: calculateStringSimilarity(
        extractedData.name.toLowerCase(),
        c.name.toLowerCase()
      )
    }))
    .filter(m => m.similarity > 0.85)
    .sort((a, b) => b.similarity - a.similarity);

    if (nameMatches.length > 0) {
      return {
        customerId: nameMatches[0].customer.id,
        confidence: 'medium',
        matchType: 'name_fuzzy',
        similarity: nameMatches[0].similarity,
        suggestedAction: 'review'
      };
    }
  }

  // 3. Phone/Email match
  if (extractedData.phone || extractedData.email) {
    const contactMatch = customers.find(c =>
      c.phone === extractedData.phone ||
      c.email === extractedData.email
    );

    if (contactMatch) {
      return {
        customerId: contactMatch.id,
        confidence: 'medium',
        matchType: 'contact',
        suggestedAction: 'review'
      };
    }
  }

  // 4. No match - suggest creating new customer
  return {
    customerId: null,
    confidence: 'none',
    matchType: 'no_match',
    suggestedAction: 'create_customer',
    suggestedCustomerData: extractedData
  };
}
```

---

## Cost Analysis

### Scenario: Import 100 mixed documents

| File Type | Count | Processing | Cost per File | Total Cost |
|-----------|-------|-----------|---------------|------------|
| **NRIC scans (JPG)** | 30 | Vision + Claude | $0.00225 | $0.07 |
| **VSA forms (PDF)** | 20 | Vision + Claude | $0.00225 | $0.05 |
| **Excel VSA templates** | 15 | xlsx-populate + Claude | $0.00075 | $0.01 |
| **Trade-in docs (PDF)** | 10 | Vision + Claude | $0.00225 | $0.02 |
| **Passport scans** | 10 | Vision + Claude | $0.00225 | $0.02 |
| **Misc documents** | 15 | Vision + Claude | $0.00225 | $0.03 |
| **Total** | **100** | **Hybrid** | **-** | **$0.20** |

**Cost per bulk import (100 files): ~$0.20**

### Time Savings

**Manual process:**
- 100 documents × 2 min per document = 200 minutes (~3.3 hours)
- Manual typing errors, inconsistent naming

**Automated process:**
- OCR + Classification: ~5 minutes total
- User review: 15 minutes
- **Total: ~20 minutes** (90% time savings)

---

## Error Handling & Edge Cases

### Low Confidence Documents

```typescript
// Documents with confidence < 70% go to manual review queue

interface ReviewQueueItem {
  file: File;
  rawText: string;
  suggestedType: string;
  suggestedCustomer: Customer | null;
  confidence: number;
  issues: string[];
  actions: ['approve', 'edit', 'skip', 'delete'];
}
```

### Duplicate Detection

```typescript
// Check for duplicates before upload

async function detectDuplicates(
  file: File,
  customerId: string,
  documentType: string
): Promise<DuplicateCheck> {

  // Check by filename
  const existingByName = await checkExistingFilename(file.name, customerId);

  // Check by file hash (more reliable)
  const fileHash = await calculateFileHash(file);
  const existingByHash = await checkExistingHash(fileHash, customerId);

  if (existingByHash) {
    return {
      isDuplicate: true,
      reason: 'identical_file',
      existingFile: existingByHash,
      suggestedAction: 'skip'
    };
  }

  if (existingByName) {
    return {
      isDuplicate: true,
      reason: 'similar_name',
      existingFile: existingByName,
      suggestedAction: 'rename_or_replace'
    };
  }

  return { isDuplicate: false };
}
```

### Multi-Page PDFs

```typescript
// For multi-page PDFs, extract text from all pages

async function processPdfDocument(pdfBuffer: Buffer): Promise<ExtractedData> {
  // Use Vision API with PDF support
  const [result] = await visionClient.documentTextDetection({
    image: { content: pdfBuffer }
  });

  // Vision API automatically handles multi-page PDFs
  const fullText = result.fullTextAnnotation?.text || '';

  // Process with Claude
  return await classifyWithClaude(fullText, 'pdf_multipage');
}
```

### Unsupported File Types

```typescript
const SUPPORTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.heic',  // Images
  '.pdf',                             // PDFs
  '.xlsx', '.xls'                     // Excel
];

function filterUnsupportedFiles(files: File[]): {
  supported: File[];
  unsupported: File[];
} {
  const supported = [];
  const unsupported = [];

  for (const file of files) {
    const ext = getFileExtension(file.name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      supported.push(file);
    } else {
      unsupported.push(file);
    }
  }

  return { supported, unsupported };
}
```

---

## User Interface Flow

### Step 1: Folder Selection

```
┌────────────────────────────────────────────────┐
│  Bulk Document Import                          │
├────────────────────────────────────────────────┤
│                                                │
│  [📁 Select Folder]  [📎 Select Files]        │
│                                                │
│  Selected: /Users/john/Desktop/BYD_Docs/       │
│                                                │
│  Found 127 files:                              │
│    ✓ 85 images (JPG, PNG)                     │
│    ✓ 30 PDFs                                   │
│    ✓ 12 Excel files                            │
│    ⚠ 2 unsupported (skip)                     │
│                                                │
│  [Cancel]  [▶ Start Processing]                │
└────────────────────────────────────────────────┘
```

### Step 2: Processing Progress

```
┌────────────────────────────────────────────────┐
│  Processing Documents... 47/125 (38%)          │
├────────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░  38%      │
│                                                │
│  Current: Extracting text from IMG_0234.jpg    │
│                                                │
│  ✓ Completed: 45                               │
│  ⚠ Needs Review: 2                             │
│  ⏳ Processing: 1                              │
│  ⏸ Pending: 78                                 │
│                                                │
│  Estimated time: 2 minutes                     │
└────────────────────────────────────────────────┘
```

### Step 3: Review & Confirm

```
┌───────────────────────────────────────────────────────────────────┐
│  Review Imported Documents (125 total)                            │
├───────────────────────────────────────────────────────────────────┤
│  Filters: [All] [✓ Auto-matched (98)] [⚠ Review (12)] [✗ Failed (3)] │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Filename          │ Type    │ Customer     │ Conf  │ Action     │
│  ─────────────────│─────────│──────────────│───────│────────────│
│  ✓ IMG_0234.jpg   │ NRIC    │ John Tan     │ 98% ✓ │ Auto ✓     │
│  ✓ scan001.pdf    │ VSA     │ Mary Lim     │ 95% ✓ │ Auto ✓     │
│  ⚠ document.jpg   │ Unknown │ -            │ 45% ⚠ │ [Review]   │
│  ⚠ form2.pdf      │ NRIC    │ New Customer?│ 72% ⚠ │ [Create?]  │
│  ✗ corrupted.jpg  │ -       │ -            │ 0%  ✗ │ [Skip]     │
│                                                                   │
│  [◀ Back]  [Skip Failed (3)]  [✓ Approve & Import (122)]         │
└───────────────────────────────────────────────────────────────────┘
```

### Step 4: Results Summary

```
┌────────────────────────────────────────────────┐
│  Import Complete! ✓                            │
├────────────────────────────────────────────────┤
│                                                │
│  Successfully imported: 122 documents          │
│    • Auto-matched to customers: 98             │
│    • Created new customers: 12                 │
│    • Skipped/failed: 3                         │
│                                                │
│  Documents organized into:                     │
│    📁 identity/ (45 docs)                      │
│    📁 vsa/ (35 docs)                           │
│    📁 trade_in/ (18 docs)                      │
│    📁 insurance/ (12 docs)                     │
│    📁 miscellaneous/ (12 docs)                 │
│                                                │
│  Processing cost: $0.27                        │
│  Time saved: ~3.5 hours                        │
│                                                │
│  [View Imported Documents]  [Close]            │
└────────────────────────────────────────────────┘
```

---

## Next Steps

1. Implement `BulkDocumentImportService` with Vision + Claude + Excel handling
2. Create `DocumentClassificationService` with type detection rules
3. Build `CustomerMatchingService` with fuzzy matching algorithm
4. Design UI component for bulk import wizard
5. Add batch processing queue for large imports
6. Implement duplicate detection and file hash tracking
7. Create review interface for low-confidence documents
