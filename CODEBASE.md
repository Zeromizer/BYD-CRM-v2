# BYD CRM V2 - Codebase Documentation

> **Purpose**: This document provides a comprehensive map of the codebase structure, architecture, and key patterns to help quickly understand the project in new development sessions.

---

## Project Overview

**BYD CRM V2** is a Customer Relationship Management system for BYD vehicle sales, managing the complete customer journey from test drive through delivery.

### Tech Stack

| Category   | Technology                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Frontend   | React 19.2.0, TypeScript 5.9.3                                                                                           |
| Build      | Vite 7.2.4, vite-plugin-pwa 1.2.0                                                                                        |
| State      | Zustand 5.0.9 (devtools + persist + subscribeWithSelector + immer)                                                       |
| Backend    | Supabase (Auth, Database, Storage, Realtime, Edge Functions)                                                             |
| AI         | Google Gemini 2.5 Flash (document classification), Claude Haiku 4.5 (OCR classification), Claude Sonnet 4 (PDF analysis) |
| Vision API | Google Cloud Vision (text extraction from images/PDFs)                                                                   |
| Icons      | @phosphor-icons/react                                                                                                    |
| Excel      | xlsx-populate (generation), xlsx (preview extraction)                                                                    |
| PDF        | jsPDF (generation), pdf.js (rendering, thumbnails), pdf-lib (splitting)                                                  |
| OCR        | Vision+Claude hybrid pipeline (primary), Tesseract.js (fallback)                                                         |

---

## Directory Structure

```
byd-crm-v2/
├── src/
│   ├── components/          # React UI components
│   │   ├── Auth/            # Login, signup, password reset
│   │   ├── Layout/          # Header, sidebar, main layout
│   │   ├── Dashboard/       # Main dashboard view
│   │   ├── CustomerList/    # Customer list with search/filter
│   │   ├── CustomerDetails/ # Tabbed customer view
│   │   ├── CustomerForm/    # Add/edit customer modal
│   │   ├── ProgressSidebar/ # Right panel: progress, next steps, milestones, tasks
│   │   ├── MilestoneSidebar/# (Legacy) Vertical milestone icon bar
│   │   ├── Documents/       # Document management
│   │   ├── Excel/           # Excel template management
│   │   └── common/          # Button, Modal, Toast, InlineTaskForm, DocumentThumbnail, PdfViewer, ImageViewer, ExcelViewer
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Shared utility functions
│   ├── services/            # Business logic & API integrations
│   ├── stores/              # Zustand state management
│   ├── types/               # TypeScript type definitions
│   ├── constants/           # Configuration & constants
│   ├── context/             # React context (Theme)
│   ├── config/              # Shared configuration (serviceConfig.ts)
│   ├── lib/                 # Shared utilities (supabase, pdfProcessor, errorHandler)
│   ├── styles/              # Global CSS
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # React entry point
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions
│       └── vision-claude-ocr/  # Vision+Claude OCR pipeline
├── public/                  # Static assets
└── dist/                    # Build output
```

---

## Routing

| Route            | Component     | Description                      |
| ---------------- | ------------- | -------------------------------- |
| `/auth`          | AuthPage      | Login/signup (public)            |
| `/`              | Dashboard     | Main 3-panel dashboard           |
| `/customers/:id` | Dashboard     | Dashboard with selected customer |
| `/documents`     | DocumentsPage | Document template management     |
| `/excel`         | ExcelPage     | Excel template management        |

**Protection**: `AuthGuard` wraps protected routes.

---

## State Management (Zustand Stores)

All stores use the **Zustand middleware stack** pattern with devtools, persist (where appropriate), subscribeWithSelector, and immer for immutable state updates.

### Middleware Stack Pattern

```typescript
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export const useExampleStore = create<State & Actions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // State with immer mutations
          items: [],
          addItem: (item) =>
            set((state) => {
              state.items.push(item)
            }),
        }))
      ), // close subscribeWithSelector
      {
        name: 'example-store',
        partialize: (state) => ({
          /* only persist essential data */
        }),
      }
    ), // close persist
    { name: 'ExampleStore' }
  ) // close devtools
) // close create
```

**Middleware Order (outer to inner):**

- **devtools** - Redux DevTools integration for debugging state changes
- **persist** - localStorage persistence for session recovery (optional)
- **subscribeWithSelector** - Fine-grained subscriptions to specific state slices for performance
- **immer** - Write mutable code that produces immutable updates (no spread operators needed)

### Store Persistence Strategy

| Store            | Persist? | Persisted Keys                |
| ---------------- | -------- | ----------------------------- |
| useAuthStore     | Yes      | `user`, `profile`             |
| useCustomerStore | Yes      | `selectedCustomerId`          |
| useTodoStore     | Yes      | `sidebarOpen`, `activeFilter` |
| useDocumentStore | No       | Data from Supabase            |
| useExcelStore    | No       | Data from Supabase            |

### useAuthStore (`src/stores/useAuthStore.ts`)

- **Middleware**: devtools + persist + subscribeWithSelector + immer
- **State**: `user`, `session`, `profile`, `isLoading`, `isInitialized`
- **Key Actions**: `signIn()`, `signUp()`, `signOut()`, `updateProfile()`
- **Selectors**: `useUser()`, `useProfile()`, `useIsAuthenticated()`
- **Persisted**: `user`, `profile` (for faster hydration)

### useCustomerStore (`src/stores/useCustomerStore.ts`)

- **Middleware**: devtools + persist + subscribeWithSelector + immer
- **State**: `customers`, `selectedCustomerId`, `isLoading`, `isSaving`
- **Key Actions**: `fetchCustomers()`, `createCustomer()`, `updateCustomer()`, `deleteCustomer()`, `archiveCustomer()`, `updateChecklistItem()`, `setCurrentMilestone()`
- **Selectors**: `useCustomers()`, `useSelectedCustomer()`
- **Realtime**: Subscribes to customer table changes
- **Persisted**: `selectedCustomerId` (preserves customer selection across sessions)

### useDocumentStore (`src/stores/useDocumentStore.ts`)

- **Middleware**: devtools + subscribeWithSelector + immer
- **State**: `templates`, `selectedTemplateId`
- **Key Actions**: CRUD for document templates, field mappings, storage operations

### useExcelStore (`src/stores/useExcelStore.ts`)

- **Middleware**: devtools + subscribeWithSelector + immer
- **State**: `templates`, `selectedTemplateId`
- **Key Actions**: CRUD for Excel templates, field mappings, file upload/download

### useTodoStore (`src/stores/useTodoStore.ts`)

- **Middleware**: devtools + persist + subscribeWithSelector + immer
- **State**: `todos`, `sidebarOpen`, `activeFilter`, `isSaving`
- **Key Actions**: `fetchTodos()`, `createTodo()`, `updateTodo()`, `deleteTodo()`, `toggleTodo()`, `subscribeToChanges()`
- **Selectors**: `useTodos()`, `useTodoSidebarOpen()`, `useTodoActiveFilter()`
- **Realtime**: Subscribes to todo table changes
- **Filters**: `all`, `today`, `overdue`, `high_priority`, `completed`
- **Persisted**: `sidebarOpen`, `activeFilter` (UI preferences)

---

## Custom Hooks (`src/hooks/`)

### useMilestoneChecklist

Shared logic for milestone checklist management, used by both `MilestoneTracker` and `MilestoneSidebar` components.

**Returns:**

- State: `expandedMilestone`, `currentMilestone`, `localChecklist`, `localMilestoneDates`, `hasChanges`, `isSaving`, `isCreatingTodos`
- Handlers: `handleMilestoneClick()`, `handleSetCurrentMilestone()`, `handleChecklistToggle()`, `handleMilestoneDateChange()`, `handleCreateTodosFromChecklist()`, `handleSaveChanges()`, `handleCancel()`, `handleClosePanel()`

### useMediaQuery / useIsMobile

Responsive breakpoint detection for mobile/desktop rendering.

```typescript
const isMobile = useIsMobile() // true when viewport <= 768px
const isTablet = useIsTablet() // true when viewport <= 1024px
```

### useSwipeNavigation

Touch gesture handling for swipe-based panel navigation on mobile.

**Config:**

- `panelCount` - Number of panels to navigate between
- `threshold` - Minimum swipe distance to trigger navigation (default: 50px)
- `velocityThreshold` - Minimum velocity for quick swipes (default: 0.5)
- `resistance` - Resistance when swiping past bounds (default: 0.3)

**Returns:**

- `activePanel`, `isSwiping`, `translateX`
- `setActivePanel(index)` - Programmatically change panel
- `handlers` - Touch event handlers to spread on container
- `getTransformStyle()` - CSS transform for panel positioning

---

## React 19 Features

### useTransition for Form Submissions

Form components use React 19's `useTransition` hook to manage async state transitions with built-in pending states:

**Files using useTransition:**

- `src/components/Dashboard/Dashboard.tsx` - Customer creation
- `src/components/Dashboard/MobileDashboard.tsx` - Customer creation (mobile)
- `src/components/common/InlineTaskForm.tsx` - Task creation
- `src/components/CustomerDetails/tabs/DetailsTab.tsx` - Customer details save
- `src/components/CustomerDetails/tabs/VsaTab.tsx` - VSA details save
- `src/components/CustomerDetails/tabs/ProposalTab.tsx` - Proposal save
- `src/components/ProgressSidebar/TaskItem.tsx` - Task toggle

**Pattern:**

```typescript
import { useTransition } from 'react';

function MyForm() {
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await saveData();
    });
  };

  return (
    <Button onClick={handleSave} isLoading={isPending}>
      Save
    </Button>
  );
}
```

**Benefits:**

- Built-in pending state without manual `useState`
- Non-blocking UI updates (other interactions remain responsive)
- Automatic error boundary integration
- Concurrent rendering support

### useOptimistic for Instant UI Feedback

Task toggling uses `useOptimistic` for instant checkbox feedback before API completion:

**File:** `src/components/ProgressSidebar/TaskItem.tsx`

```typescript
import { useOptimistic, useTransition } from 'react';

function TaskItem({ todo, onToggle }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticTodo, setOptimisticTodo] = useOptimistic(
    todo,
    (current, newCompleted: boolean) => ({
      ...current,
      completed: newCompleted,
    })
  );

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticTodo(!optimisticTodo.completed);
      await onToggle(todo.id);
    });
  };

  return (
    <div className={optimisticTodo.completed ? 'completed' : ''}>
      <input type="checkbox" checked={optimisticTodo.completed} onChange={handleToggle} />
    </div>
  );
}
```

**Benefits:**

- Checkbox toggles instantly without waiting for API
- Automatically reverts on error (when `todo` prop updates)
- Combined with `useTransition` for non-blocking updates

---

## Shared Utilities (`src/lib/`)

### Service Configuration (`src/config/serviceConfig.ts`)

Centralized configuration for all services:

```typescript
export const SERVICE_CONFIG = {
  timeouts: {
    ocr: 30000, // Vision+Claude OCR timeout
    classification: 20000, // Document classification
    upload: 60000, // File upload timeout
    edgeFunction: 30000, // Supabase Edge Function calls
    signedUrl: 10000, // Signed URL generation
  },
  batching: {
    concurrency: 4, // Max concurrent operations
    delayMs: 300, // Delay between batches
    apiDelayMs: 200, // Delay between API calls
  },
  retries: {
    maxAttempts: 3, // Retry count for transient failures
    backoffMs: 1000, // Exponential backoff base
  },
  cache: {
    signedUrlTtl: 6 * 60 * 60 * 1000, // 6 hours
    documentListTtl: 2 * 60 * 1000, // 2 minutes
  },
} as const
```

### PDF Processor (`src/lib/pdfProcessor.ts`)

Shared PDF.js utilities used by multiple services:

```typescript
// Initialization (idempotent)
initPdfWorker()

// Loading PDFs
const pdf = await loadPdfFromFile(file)
const pdf = await loadPdfFromBase64(dataUrl)
const pdf = await loadPdfFromUrl(url)

// Rendering
const canvas = await renderPdfPageToCanvas(pdf, pageNum, scale)
const dataUrl = await pdfPageToImage(pdf, pageNum, { format: 'image/jpeg', quality: 0.92 })

// Text extraction
const text = await extractTextFromPage(page)
const allTexts = await extractAllPdfText(pdf)

// Utilities
const isBlank = isPageBlank(pageText, threshold)
const thumbnail = await generatePdfThumbnail(pdf, maxWidth)
const metadata = await getPdfMetadata(pdf)
```

**Used by:**

- `src/services/intelligentOcrService.ts` - OCR processing
- `src/services/salesPackService.ts` - PDF splitting
- `src/components/common/DocumentThumbnail/` - Thumbnail generation
- `src/components/common/PdfViewer/` - PDF rendering

### Error Handler (`src/lib/errorHandler.ts`)

Centralized error handling utilities:

```typescript
// Supabase error handling
handleSupabaseError(error, 'uploadDocument') // throws with user-friendly message

// Timeout wrapper
const result = await withTimeout(promise, 30000, 'OCR processing')

// Retry with exponential backoff
const result = await withRetry(fetchData, {
  maxAttempts: 3,
  backoffMs: 1000,
  operationName: 'fetchCustomers',
  shouldRetry: (error) => isNetworkError(error),
})

// Network availability check
checkNetworkAvailability() // throws if offline

// Batch processing with rate limiting
const results = await processBatch(items, processor, {
  concurrency: 4,
  delayMs: 300,
  onProgress: (completed, total) => setProgress(completed / total),
})
```

---

## Utilities (`src/utils/`)

### formatting.ts

- `formatCurrency(value, options?)` - Format number as currency string
- `formatCurrencySGD(value)` - Format as SGD with 2 decimal places
- `currencyToNumber(value)` - Parse currency string to number
- `formatPercentage(value)` - Format as percentage

### milestoneIcons.tsx

- `getMilestoneIcon(iconName, size?, color?)` - Get milestone icon component
- `CheckmarkIcon` - Reusable checkmark SVG component

---

## Key Services

| Service                        | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `excelService.ts`              | Populate Excel templates with 200+ customer fields   |
| `documentClassifierService.ts` | AI-powered document type classification using Gemini |
| `intelligentOcrService.ts`     | Vision+Claude hybrid OCR with parallel processing    |
| `bulkDocumentImportService.ts` | Batch document import and AI classification          |
| `customerImportService.ts`     | Import/export customers (JSON/CSV)                   |
| `customerDocumentService.ts`   | Upload documents to Supabase storage                 |
| `salesPackService.ts`          | Sales pack PDF analysis, splitting, and upload       |
| `geminiService.ts`             | Google Gemini API configuration                      |

---

## Type System (`src/types/`)

### Core Types

**Customer** (`customer.types.ts`) - Main entity with 80+ fields:

- Basic info (name, phone, email, NRIC, address)
- Vehicle details (make, model, color, PRZ type)
- VSA details (package, pricing, COE, trade-in)
- Proposal (bank, rates, benefits)
- Status (milestone, archive status)
- JSONB: `checklist`, `milestone_dates`, `document_checklist`

**Guarantor** - Up to 5 per customer

**MilestoneId**: `'test_drive' | 'close_deal' | 'registration' | 'delivery' | 'nps'`

**DocumentStatus**: `'pending' | 'uploaded' | 'approved' | 'rejected' | 'expired' | 'not_applicable'`

**Todo** (`todo.types.ts`) - Task entity:

- `id`, `user_id`, `customer_id`, `customer_name`
- `text`, `completed`, `priority` (low/medium/high/urgent)
- `due_date`, `milestone_id`, `checklist_item_id`

**Priority**: `'low' | 'medium' | 'high' | 'urgent'`

---

## Constants (`src/constants/`)

### milestones.ts

Five-stage customer journey:

1. **Test Drive** (gray) - Initial contact
2. **COE Bidding** (cyan) - Certificate of Entitlement
3. **Registration** (indigo) - Vehicle registration
4. **Delivery** (emerald) - Vehicle handover
5. **NPS** (amber) - Net Promoter Score

Each milestone has 15-25 checklist items.

**Utilities**: `getMilestoneProgress()`, `getOverallProgress()`, `getMilestoneUrgency()`

### excelFields.ts

176 Excel-mappable fields organized by category (Basic Info, Vehicle, Trade-In, Loan, Guarantors, etc.)

### documentRequirements.ts

20+ document types with keywords for AI classification, organized by milestone.

---

## Database Schema (Supabase)

| Table                | Description                    |
| -------------------- | ------------------------------ |
| `profiles`           | User settings, theme, API keys |
| `customers`          | Main customer records          |
| `guarantors`         | Customer co-signers            |
| `document_templates` | Editable document templates    |
| `excel_templates`    | Excel template field mappings  |
| `todos`              | Customer-related tasks         |

### Storage Buckets

- `document-templates` - Template images
- `customer-documents` - Uploaded documents
- `excel-templates` - Excel files

---

## Component Patterns

### Dashboard Layout (`Dashboard.tsx`)

Responsive layout with mobile/desktop split:

**Desktop** (>768px): Three-panel layout

1. **Left**: Customer list with search/filter
2. **Center**: Customer details (tabbed)
3. **Right**: Progress sidebar (progress, next steps, milestones, tasks)

**Mobile** (≤768px): Swipe-based panel navigation

- Uses `MobileDashboard` component with `useSwipeNavigation` hook
- Three full-screen panels: CustomerList → CustomerDetails → ProgressSidebar
- Panel indicator dots at bottom for navigation
- Auto-navigates to details panel when customer selected

### MobileSummaryCard (`CustomerDetails/MobileSummaryCard.tsx`)

Compact customer info card (~200px height) optimized for mobile viewports:

- **Header Row**: Back button, avatar, name, vehicle, more actions menu
- **Progress Row**: Milestone badge + progress bar with percentage
- **Key Info Row**: Next due date + next uncompleted step
- **Quick Actions**: Call, Message, Email buttons (opens native apps)

### PanelIndicator (`common/PanelIndicator/`)

Navigation dots for mobile swipe panels:

- Shows active/inactive states
- 44px touch targets for accessibility
- Positioned at bottom of screen

### ProgressSidebar (`ProgressSidebar/`)

Right-side panel with four sections:

- **Progress**: Current milestone badge
- **Next Steps**: Uncompleted checklist items from current milestone
- **All Milestones**: Expandable list with progress bars and checklists
- **Tasks**: Customer-specific tasks with inline add form

**Styling**: Has left and right borders (`border-left`, `border-right`) to define panel boundaries.

**Components**:

- `ProgressSidebar.tsx` - Main container
- `TaskItem.tsx` - Individual task with toggle/delete
- `InlineTaskForm` (from common) - Inline task creation

### TodoSidebar (`Layout/TodoSidebar.tsx`)

Global task sidebar (accessible from header):

- Filter by: All, Today, Overdue, High Priority, Completed
- Inline task creation with `InlineTaskForm`
- Stats showing today's and overdue task counts

### CustomerDetails Header Actions

Action buttons in header (desktop) and action sheet (mobile):

- **Generate Excel** (FileXls icon) - Opens ExcelPopulateModal for Excel template generation
- **Generate Document** (FileDoc icon) - Opens template selector → PrintManager for PDF generation
- **Edit** (PencilSimple icon) - Opens CustomerForm modal
- **Archive/Unarchive** (Package/Export icon) - Toggle archive status
- **Delete** (Trash icon) - Delete confirmation modal

### CustomerDetails Tabs

- **DetailsTab**: Basic info, address, vehicle
- **VsaTab**: VSA details, financing, trade-in
- **ProposalTab**: Proposal and benefits
- **DocumentsTab**: Document checklist with card grid layout and large thumbnails

### Common Components (`src/components/common/`)

#### DocumentThumbnail

Renders document previews with PDF first-page rendering and file type icons.

**Props:**

```typescript
interface DocumentThumbnailProps {
  url: string
  mimeType: string
  filename?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  onClick?: () => void
}
```

**Size Variants:**
| Size | Desktop | Mobile | Use Case |
|------|---------|--------|----------|
| sm | 40×40px | 36×36px | Inline list items |
| md | 52×52px | 44×44px | Default |
| lg | 64×64px | 56×56px | Emphasized items |
| xl | 100% width, 4:3 aspect | 100% width | Card grid with max-width |
| full | 100% width, 4:3 aspect | 100% width | Full-width cards |

**Features:**

- PDF thumbnail generation using pdf.js (first page, 2x scale for retina)
- Direct image URL for image files
- File type icons for Excel, Word, Video, and generic files
- Loading spinner during thumbnail generation
- Error fallback to file type icon

#### PdfViewer / ImageViewer

Full-screen document viewers with zoom, pan, and navigation controls.

**Features:**

- Pinch-to-zoom on mobile (touch gestures)
- Click-and-drag panning when zoomed
- Page navigation for multi-page PDFs
- Download button in toolbar

#### ExcelViewer

Download prompt for Excel files (Supabase signed URLs cannot be previewed via Google/Microsoft viewers).

**Features:**

- Displays Excel icon and filename
- Single download button to open in native app

### Form Handling

- Controlled components with local state
- Toast notifications for feedback
- Modal wrapper for dialogs

---

## Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key  # Optional
```

---

## Key Workflows

### Customer Management

1. Create customer → Track through 5 milestones → Archive (lost/completed)
2. Each milestone has checklist items and required documents
3. Guarantors (up to 5) can be added for financing

### Document Management

1. Upload document → AI classifies type → Suggests folder/milestone
2. Track document status per milestone
3. Generate populated PDFs from templates

### Excel Automation

1. Upload Excel template → Map fields to cells
2. Select customer → Populate template → Download

---

## Development Commands

```bash
npm run dev      # Start dev server (port 5173)
npm run build    # TypeScript compile + Vite build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

---

## Vision+Claude OCR Pipeline

### Architecture Overview

The document OCR system uses a **hybrid two-step pipeline** for high-accuracy document classification:

1. **Google Cloud Vision API** - Text extraction (98% accuracy)
2. **Claude Haiku 4.5** - Intelligent classification and data structuring

This approach provides better accuracy than using either service alone.

### Edge Function: `vision-claude-ocr`

**Location:** `supabase/functions/vision-claude-ocr/index.ts`

**Supported Inputs:**

- Images: JPEG, PNG, GIF, WebP, BMP
- PDFs: Single and multi-page (converted to images client-side)
- Excel: Pre-extracted text (skips Vision API)

**Request Parameters:**

```typescript
interface VisionClaudeRequest {
  imageData?: string // Base64 data URL
  rawText?: string // Pre-extracted text (Excel)
  documentType?: 'auto' | 'nric' | 'vsa' | 'trade_in'
  sourceType?: 'image' | 'excel'
  visionOnly?: boolean // Skip Claude, return OCR text only
}
```

**Response:**

```typescript
interface VisionClaudeResponse {
  documentType: string // e.g., 'nric_front', 'vsa', 'loan_approval'
  confidence: number // 0-100
  customerName: string
  signed: boolean
  summary: string
  rawText: string
  extractedData: {
    nric?: string
    name?: string
    dateOfBirth?: string
    address?: string
    phone?: string
    email?: string
    vehicleModel?: string
    sellingPrice?: number
    coeAmount?: number
    deposit?: number
    loanAmount?: number
  }
  ocrMethod: 'vision-claude'
}
```

### Document Types

The system classifies documents into these categories:

- `nric_front`, `nric_back`, `nric` - Singapore NRIC cards
- `driving_license` - Singapore Driving License
- `test_drive_form` - Test Drive Agreement
- `vsa` - Vehicle Sales Agreement, Proforma Invoice
- `pdpa` - PDPA Consent Form
- `loan_approval`, `loan_application` - Loan documents
- `insurance_quote`, `insurance_policy`, `insurance_acceptance` - Insurance docs
- `payment_proof` - Payment receipts
- `delivery_checklist` - Vehicle delivery checklist
- `registration_card` - Vehicle registration
- `trade_in_docs` - Trade-in documents
- `id_documents` - Multiple IDs scanned together
- `other` - Unclassified

### Multi-page PDF Processing

Multi-page PDFs are processed efficiently using `visionOnly` mode:

```
Page 1 → Vision API (visionOnly: true) → raw text
Page 2 → Vision API (visionOnly: true) → raw text
Page 3 → Vision API (visionOnly: true) → raw text
Combined text → Claude Haiku → classification
```

This reduces API calls from N×2 to N+1 for N pages.

### Parallel Processing

The `classifyDocumentsWithVisionClaudeParallel()` function processes multiple documents concurrently:

```typescript
// Process 4 documents in parallel
const results = await classifyDocumentsWithVisionClaudeParallel(
  files,
  onProgress,
  4 // concurrency limit
)
```

**Performance:**

- Sequential (old): ~60-90s for 20 documents
- Parallel (new): ~15-25s for 20 documents (3-5x faster)

### Cost Estimate

- ~$0.005 per document (~0.5 cents)
- Breakdown: Vision API (free tier) + Claude Haiku tokens
- 100 documents ≈ $0.50

### Client-Side Service: `intelligentOcrService.ts`

**Key Functions:**

- `classifyWithVisionClaude(file)` - Classify single document
- `classifyDocumentsWithVisionClaudeParallel(files, onProgress, concurrency)` - Batch processing
- `classifyPdfWithVisionClaude(file)` - Multi-page PDF support with Vision-only extraction
- `classifyExcelWithVisionClaude(file)` - Excel file classification (extracts text locally)

**PDF Processing Flow:**

1. Load PDF with pdf.js
2. Render each page to canvas (300 DPI)
3. Convert to JPEG (quality 0.95)
4. Send each page to Vision API (`visionOnly: true`)
5. Combine all text
6. Send to Claude for classification

---

## Email-to-CRM Document Automation

### Overview

Automatically uploads insurance cover notes and vehicle registration PDFs from Outlook emails to the correct customer's folder in the CRM. Uses Make.com to watch emails and Supabase Edge Function to match customers and upload files.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Outlook   │────▶│   Make.com   │────▶│    Supabase     │────▶│   CRM Storage   │
│  (1 email   │     │  (Iterator   │     │  Edge Function  │     │  (Customer's    │
│  many PDFs) │     │  per PDF)    │     │  name matching) │     │   folder)       │
└─────────────┘     └──────────────┘     └─────────────────┘     └─────────────────┘
```

### Edge Function: `email-document-upload`

**Location:** `supabase/functions/email-document-upload/index.ts`

**Purpose:** Receives PDF documents from Make.com and uploads them to the correct customer's storage folder by matching customer names across all users.

**Request Parameters:**

```typescript
interface EmailDocumentRequest {
  customerName: string // Parsed from filename, e.g., "TEE HOCK SENG"
  documentType: string // "registration_card" or "insurance_policy"
  fileBase64: string // Base64-encoded PDF content
  fileName: string // Original filename
}
```

**Response:**

```typescript
interface EmailDocumentResponse {
  success: boolean
  customerId?: number
  customerName?: string
  userId?: string
  uploadPath?: string
  error?: string
}
```

**Key Features:**

- **Cross-user matching** - Searches all customers across all salespeople using service role key
- **Name prefix stripping** - Removes common titles from filenames: `ME`, `MR`, `MS`, `MRS`, `MDM`, `MISS`, `DR`, `MADAM`
- **Fuzzy matching** - Case-insensitive search with partial matching
- **Sanitized paths** - Customer names converted to uppercase with underscores

**Name Matching Flow:**

1. Input filename: `EQ COVER NOTE - ME TEE HOCK SENG.pdf`
2. Extract name: `ME TEE HOCK SENG`
3. Normalize: Replace underscores with spaces, uppercase
4. Strip prefix: `ME ` removed → `TEE HOCK SENG`
5. Search database: `SELECT * FROM customers WHERE name ILIKE '%TEE HOCK SENG%'`
6. Upload to: `{user_id}/TEE_HOCK_SENG/insurance_policy/{filename}`

### Make.com Workflow Configuration

**Modules:**

1. **Email (Watch Emails)** - Trigger on subject containing "Registration" or "Credit Note"
2. **Iterator** - Loop through all PDF attachments
3. **Filter (Get PDF)** - Only process `.pdf` files
4. **Text Parser (Match pattern)** - Extract customer name from filename
   - Pattern: `^.*? - (.+?)\.pdf$`
   - Extracts: `ME TEE HOCK SENG` from `LGXCH4CB252188047 - ME TEE HOCK SENG.pdf`
5. **Tools (Set variable)** - Determine document type from filename
   ```
   {{if(contains(lower(3.fileName); "cover note"); "insurance_policy";
     if(contains(lower(3.fileName); "credit note"); "insurance_policy";
       if(contains(lower(3.fileName); "registration"); "registration_card"; "other")))}}
   ```
6. **HTTP (Make a request)** - POST to Supabase Edge Function
7. **Ignore** - Error handler to continue processing on failures

**HTTP Module Configuration:**

- URL: `https://[project-ref].supabase.co/functions/v1/email-document-upload`
- Method: POST
- Headers: `Authorization: Bearer [SERVICE_ROLE_KEY]`
- Body Type: Data Structure (not raw JSON - avoids escape issues)
- Fields:
  - `customerName`: `{{replace(4.$1; "_"; " ")}}` (from text parser)
  - `documentType`: `{{7.docType}}` (from set variable)
  - `fileBase64`: `{{base64(3.data)}}` (from iterator)
  - `fileName`: `{{3.fileName}}` (from iterator)

### Document Categories in CRM

The Insurance category displays:

- **Insurance Quote** (`insurance_quote`)
- **Cover Note** (`insurance_policy`) - Label changed from "Insurance Policy"

Files are stored in `insurance_policy` folder but displayed as "Cover Note" in the UI.

---

## Sales Pack Upload Feature

### Overview

Upload a multi-page "Sales Pack" PDF containing multiple document types (VSA, NRIC, PDPA, insurance, etc.) and have AI automatically classify, split, and upload each document to the correct customer folder.

### Architecture

```
┌─────────────┐     ┌───────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PDF File  │────▶│  Claude Sonnet 4  │────▶│    pdf-lib      │────▶│   Upload to     │
│  (multi-pg) │     │  (analyze-pdf)    │     │  (split pages)  │     │   Storage       │
└─────────────┘     └───────────────────┘     └─────────────────┘     └─────────────────┘
```

### Components

**SalesPackUploadModal** (`src/components/CustomerDetails/tabs/SalesPackUploadModal.tsx`)
Multi-step modal with stages:

1. **Select** - File picker (PDF only)
2. **Analyzing** - Progress bar showing Claude Vision analysis
3. **Review** - Document cards with type dropdowns, merge/remove options
4. **Uploading** - Progress bar for each document upload
5. **Complete** - Success message

**salesPackService** (`src/services/salesPackService.ts`)
Core service functions:

- `analyzeSalesPack(file, onProgress)` - Send PDF to Claude Vision for analysis
- `splitPdf(file, splits, pageTexts)` - Split PDF using pdf-lib, removes blank pages
- `generateSplitFilename(customerName, documentType)` - Format: `CUSTOMER_NAME_type.pdf`
- `getAvailableDocumentTypes()` - Returns document type options for dropdown
- `isPageTextBlank(pageText)` - Detects blank pages by text content

### Edge Function: `vision-claude-ocr` (analyze-pdf mode)

**Request:**

```typescript
{
  mode: 'analyze-pdf',
  pdfData: string  // Base64 data URL of PDF
}
```

**Response:**

```typescript
{
  totalPages: number,
  customerName: string,
  pageTexts: string[],  // Text from each page, "[BLANK]" for blank pages
  documentGroups: [{
    documentType: string,
    documentTypeName: string,
    pages: number[],    // 1-indexed page numbers
    confidence: number
  }]
}
```

### Key Features

- **Direct PDF Analysis** - Sends entire PDF to Claude Sonnet 4 using `anthropic-beta: pdfs-2024-09-25` header
- **Smart Document Grouping** - Claude groups consecutive pages of same document type
- **Blank Page Removal** - Pages marked `[BLANK]` or with <20 chars are automatically removed during splitting
- **Customer Name Extraction** - Extracts customer name from documents for verification
- **Confidence Scores** - Each document group has a confidence percentage
- **Manual Adjustment** - Users can change document types, merge documents, or remove items before upload

### UI Flow

```
[Upload Sales Pack] button in DocumentsTab
         │
         ▼
┌─────────────────────────────┐
│  Select PDF File            │
│  [Drop or Browse]           │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Analyzing... 1/1 pages     │
│  Sending to Claude Vision   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Review Classifications     │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ VSA │ │PDPA │ │NRIC │   │
│  │ p1-3│ │ p4  │ │ p5  │   │
│  └─────┘ └─────┘ └─────┘   │
│   [Start Over] [Upload 3]   │
└─────────────────────────────┘
         │
         ▼
   Documents uploaded to
   customer's storage folders
```

### Document Types Supported (25 types)

- **ID**: `nric_front`, `nric_back`, `nric`, `driving_license`, `driving_license_front`, `driving_license_back`
- **Forms**: `test_drive_form`, `vsa`, `pdpa`
- **Finance**: `loan_approval`, `loan_application`
- **Insurance**: `insurance_quote`, `insurance_policy`, `insurance_acceptance`
- **Other**: `payment_proof`, `delivery_checklist`, `registration_card`, `trade_in_docs`, `coe_bidding`, `purchase_agreement`, `parf_rebate`, `authorized_letter`, `proposal_form`, `price_list`, `id_documents`, `other`

### CSS Styling

**Location:** `src/components/CustomerDetails/tabs/SalesPackUploadModal.css`

Key classes:

- `.sales-pack-modal` - Modal container with min-height
- `.sales-pack-dropzone` - Dashed border file picker
- `.sales-pack-analyzing` - Spinner and progress bar
- `.split-card` - Document card with thumbnail, dropdown, actions
- `.review-splits` - Scrollable document list

---

## Theme System

### Three-Theme Architecture

The app supports three distinct themes: **Light**, **Dark**, and **Cool**.

**Files:**

- `src/context/ThemeContext.tsx` - Theme state management with localStorage persistence
- `src/styles/globals.css` - CSS custom properties for all three themes
- `src/components/Layout/Header.tsx` - Theme selector dropdown menu
- `src/components/Layout/Layout.css` - Theme menu styling

### Theme Definitions

| Theme | Description                         | Use Case                                               |
| ----- | ----------------------------------- | ------------------------------------------------------ |
| Light | Warm neutrals (#fafafa backgrounds) | Traditional, approachable                              |
| Dark  | Dark backgrounds (#1a1a2e)          | Low light, reduced eye strain                          |
| Cool  | Slate blue-gray (Tailwind Slate)    | Professional, sophisticated (Stripe/Mercury aesthetic) |

### Theme Context (`src/context/ThemeContext.tsx`)

```typescript
type Theme = 'light' | 'dark' | 'cool'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  cycleTheme: () => void // light → dark → cool → light
}
```

**Features:**

- Persists to localStorage (`byd-crm-theme`)
- Sets `data-theme` attribute on document root
- `cycleTheme()` cycles through all three themes

### Theme Selector UI

Located in Header component, accessible via icon button:

- Sun icon (Light mode active)
- Moon icon (Dark mode active)
- Snowflake icon (Cool mode active)

Dropdown menu shows all three options with active state highlighting.

### CSS Custom Properties by Theme

Each theme defines these categories of variables:

- **Primary colors**: `--primary`, `--primary-hover`, `--primary-alpha`
- **Background colors**: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-elevated`
- **Text colors**: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-data`
- **Border colors**: `--border-color`, `--border-subtle`, `--border-hover`
- **Shadows**: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`

**Cool Theme Color Palette (Tailwind Slate):**

```css
[data-theme='cool'] {
  --bg-primary: #f8fafc; /* slate-50 */
  --bg-secondary: #f1f5f9; /* slate-100 */
  --bg-tertiary: #e2e8f0; /* slate-200 */
  --text-primary: #0f172a; /* slate-900 */
  --text-secondary: #475569; /* slate-600 */
  --border-color: #cbd5e1; /* slate-300 */
}
```

---

## PWA (Progressive Web App)

### Configuration

The app is configured as a Progressive Web App using `vite-plugin-pwa`, enabling installation on mobile devices and basic offline caching.

**Files:**

- `vite.config.ts` - VitePWA plugin configuration
- `index.html` - PWA meta tags (theme-color, apple-touch-icon)
- `public/pwa-192x192.png` - 192×192 app icon
- `public/pwa-512x512.png` - 512×512 app icon (also used as maskable)
- `public/apple-touch-icon.png` - 180×180 iOS icon
- `scripts/generate-pwa-icons.mjs` - Script to regenerate icons

### Manifest Configuration

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate', // Silent background updates
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'BYD CRM',
    short_name: 'BYD CRM',
    description: 'Customer Relationship Management for BYD',
    theme_color: '#1a1a2e',
    background_color: '#1a1a2e',
    display: 'standalone',
    start_url: '/BYD-CRM-v2/',
    scope: '/BYD-CRM-v2/',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
        },
      },
    ],
  },
})
```

### PWA Features

| Feature          | Behavior                                                           |
| ---------------- | ------------------------------------------------------------------ |
| Installation     | "Add to Home Screen" on mobile, "Install app" on desktop           |
| Update Strategy  | `autoUpdate` - Silent background updates, activated on next launch |
| Offline Support  | Static assets cached by Workbox service worker                     |
| Supabase Caching | NetworkFirst strategy with 1-hour cache for API calls              |

### iOS Compatibility

For iOS PWA support:

- PNG icons required (SVG not supported)
- `apple-touch-icon.png` (180×180) for home screen
- Dynamic viewport height (`100dvh`) for notched devices
- `-webkit-overflow-scrolling: touch` for smooth scrolling

### Regenerating Icons

To regenerate PWA icons (requires `sharp` package):

```bash
node scripts/generate-pwa-icons.mjs
```

This creates placeholder BYD CRM icons. Replace with actual branded icons as needed.

---

## Collapsible Section Component

### CollapsibleSection (`src/components/common/CollapsibleSection/`)

Reusable component for progressive disclosure in forms, reducing visual clutter.

**Props:**

```typescript
interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  defaultExpanded?: boolean
  persistKey?: string // localStorage key for expanded state
  children: React.ReactNode
}
```

**Features:**

- Persists expanded/collapsed state to localStorage per section
- Chevron icon rotates on expand (150ms transition)
- Used in DetailsTab and ProposalTab for form organization

**Usage:**

```tsx
<CollapsibleSection
  title="Contact Information"
  icon={<Phone size={18} />}
  defaultExpanded={true}
  persistKey="details-contact"
>
  {/* Form fields */}
</CollapsibleSection>
```

### Section Organization

**DetailsTab Sections:**

- Contact Information (expanded by default)
- Identity & Personal
- Address
- Sales Information
- Notes
- Guarantors (with count badge)

**ProposalTab Sections:**

- Vehicle (expanded by default)
- Pricing & Loan (expanded by default)
- Trade-In
- Benefits (with count of selected)
- Remarks

---

## Recent Changes (Reference)

| Commit   | Description                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Latest   | PWA Support: vite-plugin-pwa integration, iOS PNG icons, mobile scroll fixes, installable app with offline caching          |
| Previous | UI/UX Rework: Three-theme system (Light/Dark/Cool), CollapsibleSection component, form reorganization, design token updates |
| Previous | Codebase modernization: Zustand middleware stack, React 19 features (useTransition, useOptimistic), shared utilities        |
| Previous | Sales Pack Upload: AI-powered multi-page PDF splitting with Claude Vision analysis                                          |
| Previous | Email-to-CRM automation: Make.com + Supabase Edge Function for auto-uploading insurance/registration PDFs                   |
| Previous | CRM improvements: dropdown accessibility, grouped options, auto-calculations, data entry efficiency                         |
| Previous | Auto-upload scanned IDs and delete documents on customer delete                                                             |
| Previous | ID Scanner performance optimization with parallel processing                                                                |
| Previous | ProgressSidebar right border for proper panel boundary                                                                      |
| Previous | PrintManager back page photo attachment for double-sided printing                                                           |
| Previous | Mobile action sheet portal fix for swipe containers                                                                         |
| Previous | Enterprise optimization: code splitting, pagination, error boundaries                                                       |
| Previous | Add Generate Document button to CustomerDetails header                                                                      |
| Previous | Document thumbnail card grid layout with large previews                                                                     |
| Previous | Mobile documents tab optimization with action sheets                                                                        |
| Previous | Vision+Claude OCR pipeline with parallel processing                                                                         |
| Previous | Mobile optimization with swipe-based panel navigation                                                                       |
| Previous | Task/Todo feature with inline forms, customer-specific tasks                                                                |
| 4fffb70  | Excel file classification, batch processing                                                                                 |
| 0faf764  | Excel integration, document management                                                                                      |
| 5dd6bd2  | OneDrive sync for scanned documents                                                                                         |

### Auto-Upload Scanned IDs & Document Cleanup

**Modified Files:**

- `src/components/CustomerForm/CustomerForm.tsx` - Stores scanned images and passes to onSubmit
- `src/components/Dashboard/Dashboard.tsx` - Uploads scanned images after customer creation
- `src/components/Dashboard/MobileDashboard.tsx` - Same as Dashboard for mobile
- `src/stores/useCustomerStore.ts` - Deletes customer documents on customer delete
- `src/services/customerDocumentService.ts` - New `deleteEntireCustomerFolder` function

**Key Features:**

- **Scanned ID auto-upload** - After customer is created, scanned NRIC/license images are automatically uploaded to their documents folder
- **Document cleanup on delete** - When a customer is deleted, all their documents are removed from Supabase Storage
- **Background processing** - Both upload and delete run in background to not block UI

**Flow - Scanned ID Upload:**

1. User scans ID in CustomerForm (stores base64 images in `ScannedImages` state)
2. CustomerForm passes `scannedImages` to `onSubmit` callback
3. Dashboard/MobileDashboard receives customer + images after creation
4. `uploadScannedImages()` converts base64 to File and uploads to appropriate folders:
   - `nric_front/` - NRIC front image
   - `nric_back/` - NRIC back image
   - `driving_license/` - License front and back images

**Flow - Customer Document Deletion:**

1. User clicks delete on a customer
2. `deleteCustomer` in store gets customer name before DB delete
3. DB record is deleted, local state updated immediately
4. `deleteEntireCustomerFolder(customerName)` called in background
5. Function lists all folders, collects file paths, batch deletes, clears cache

**ScannedImages Interface:**

```typescript
interface ScannedImages {
  frontImage: string | null // NRIC front base64
  backImage: string | null // NRIC back base64
  licenseFrontImage: string | null
  licenseBackImage: string | null
}
```

**Helper Function - Base64 to File:**

```typescript
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}
```

### ID Scanner Performance Optimization

**Modified Files:**

- `src/components/IDScanner/IDScanner.tsx` - Performance optimizations for faster AI extraction

**Key Features:**

- **Guide frame cropping** - Images cropped to exact guide frame borders (85% width, 1.586 aspect ratio)
- **Dual image capture** - Full resolution (95% quality) for saving, AI-optimized (1280px, 85% quality) for processing
- **Pre-warm auth** - Authentication checked on modal open, not during processing
- **Parallel front processing** - Front image starts processing while user scans back

**Performance Constants:**

```typescript
const GUIDE_FRAME_WIDTH_PERCENT = 0.85 // 85% of container
const GUIDE_FRAME_ASPECT_RATIO = 1.586 // Credit card ratio (landscape)
const GUIDE_FRAME_WIDTH_PERCENT_PORTRAIT = 0.75
const GUIDE_FRAME_ASPECT_RATIO_PORTRAIT = 0.65
const AI_IMAGE_MAX_WIDTH = 1280 // Max width for AI processing
const AI_IMAGE_QUALITY = 0.85 // JPEG quality for AI
```

**Performance Improvement:**
| Scenario | Before | After |
|----------|--------|-------|
| Front only (skip back) | ~10s | ~2-4s |
| Front + Back | ~10s | ~4-6s |
| With license scan | ~15s | ~6-8s |

### Vision+Claude OCR Implementation

**New Files:**

- `supabase/functions/vision-claude-ocr/index.ts` - Edge Function for hybrid OCR
- `src/services/intelligentOcrService.ts` - Client-side OCR orchestration
- `src/services/bulkDocumentImportService.ts` - Batch document processing

**Key Features:**

- Two-step OCR: Google Vision (text extraction) → Claude Haiku (classification)
- Multi-page PDF support with efficient `visionOnly` mode
- Parallel processing (4 concurrent) for 3-5x faster batch uploads
- Excel file classification (extracts text locally, sends to Claude)
- Automatic document type detection (20+ Singapore document types)
- Customer data extraction (NRIC, name, address, phone, etc.)

### Mobile Optimization Implementation

**New Files:**

- `src/hooks/useMediaQuery.ts` - Responsive breakpoint detection
- `src/hooks/useSwipeNavigation.ts` - Touch gesture handling for panels
- `src/components/Dashboard/MobileDashboard.tsx` - Mobile panel container
- `src/components/Dashboard/MobileDashboard.css` - Mobile dashboard styles
- `src/components/common/PanelIndicator/` - Navigation dots component
- `src/components/CustomerDetails/MobileSummaryCard.tsx` - Compact customer card
- `src/components/CustomerDetails/MobileSummaryCard.css` - Summary card styles

**Key Features:**

- Swipe-based navigation between three full-screen panels
- 44px minimum touch targets for accessibility
- MobileSummaryCard fits 375px viewport without scrolling
- Quick action buttons (Call, Message, Email) for field sales
- ProgressSidebar now accessible on mobile (was hidden at 1024px)
- iOS zoom prevention with 16px input font-size
- Safe area support for notched phones (100dvh)

**CSS Variables Added:**

```css
--touch-target-min: 44px;
--mobile-padding: 16px;
--mobile-gap: 12px;
--mobile-header-height: 48px;
--panel-indicator-height: 56px;
```

### Mobile Documents Tab Optimization

**Modified Files:**

- `src/components/CustomerDetails/tabs/DocumentsTab.tsx` - Mobile-specific layout with action sheets
- `src/components/CustomerDetails/CustomerDetails.css` - Mobile document card styles (~225 new lines)
- `src/components/common/Modal/Modal.tsx` - Added portal rendering for proper z-index

**Key Features:**

- **Dropdown category selector** - Replaces horizontal scrolling buttons, saves vertical space
- **FAB button** (+) - Opens "Add Document" action sheet for Generate/Import
- **Tap-to-open document cards** - No inline action buttons, touch-friendly
- **Document action sheet** - View, Download, Replace, Delete (portaled to body)
- **Portal rendering** - Action sheets and modals render via `createPortal` to escape swipe container overflow clipping

**Mobile Layout Structure:**

```
┌─────────────────────────────────┐
│ [Identification (2/4)     ▼] [+]│  ← Dropdown + FAB
├─────────────────────────────────┤
│ ● NRIC Front                   >│  ← Tap opens action sheet
│   TEE_HOCK_SENG_nric_front...   │
├─────────────────────────────────┤
│ ● NRIC Back                    >│
│   TEE_HOCK_SENG_nric_back...    │
└─────────────────────────────────┘
```

**Portal Pattern for Mobile Overlays:**
The mobile swipe panels use `overflow: hidden` which clips fixed-position elements. Solution:

```typescript
import { createPortal } from 'react-dom';

// Render action sheet outside swipe container
{showActionSheet && createPortal(
  <>
    <div className="mobile-action-overlay" onClick={close} />
    <div className="mobile-action-sheet">...</div>
  </>,
  document.body
)}
```

**Z-Index Hierarchy:**

- Mobile action overlay: `z-index: 1000`
- Mobile action sheet: `z-index: 1001`
- Modal overlay: `z-index: 1100`

### Document Thumbnail Card Grid Implementation

**New Files:**

- `src/components/common/DocumentThumbnail/DocumentThumbnail.tsx` - Thumbnail component with PDF rendering
- `src/components/common/DocumentThumbnail/DocumentThumbnail.css` - Size variants and responsive styles
- `src/components/common/DocumentThumbnail/index.ts` - Module export

**Modified Files:**

- `src/components/CustomerDetails/tabs/DocumentsTab.tsx` - Card grid layout for all views
- `src/components/CustomerDetails/CustomerDetails.css` - Card grid CSS (~150 new lines)
- `src/components/common/ExcelViewer/ExcelViewer.tsx` - Simplified to download prompt
- `src/components/common/index.ts` - Added DocumentThumbnail export

**Key Features:**

- **Card-based grid layout** - Documents displayed as cards with large thumbnails (4x larger than before)
- **PDF thumbnail generation** - First page rendered at 2x scale for retina displays
- **Responsive grid** - `repeat(auto-fill, minmax(140px, 1fr))` on desktop, 2-column on mobile
- **Unified mobile layout** - Both "All Uploads" and category views use flat 2-column grid
- **Excel download prompt** - Replaces failed Google Docs Viewer (Supabase signed URLs incompatible)

**Desktop Layout:**

```
+----------------+ +----------------+ +----------------+
|   [THUMBNAIL]  | |   [THUMBNAIL]  | |   [THUMBNAIL]  |
|    (4:3 ratio) | |    (4:3 ratio) | |    (4:3 ratio) |
|----------------|  |----------------|  |----------------|
| filename.pdf   | | image.jpeg     | | doc.xlsx       |
| 1/3/2026       | | 1/3/2026       | | 1/3/2026       |
| [👁] [⬇] [🗑]  | | [👁] [⬇] [🗑]  | | [👁] [⬇] [🗑]  |
+----------------+ +----------------+ +----------------+
```

**Mobile Layout (2-column grid):**

```
+------------------+ +------------------+
|   [THUMBNAIL]    | |   [THUMBNAIL]    |
|     (4:3 ratio)  | |     (4:3 ratio)  |
|------------------|  |------------------|
| filename.pdf     | | image.jpeg       |
| 1/3/2026         | | 1/3/2026         |
+------------------+ +------------------+
```

**CSS Classes:**

- `.folder-documents-grid` - Desktop card grid container
- `.document-card` - Individual card with thumbnail + info
- `.document-card-thumbnail` - Thumbnail wrapper with 4:3 aspect ratio
- `.mobile-documents-list` - Mobile 2-column grid
- `.mobile-document-card` - Mobile card variant

### Task Feature Implementation

- **InlineTaskForm** (`common/InlineTaskForm.tsx`) - Compact inline form for task creation
  - Priority selector (L/M/H/! pills)
  - Quick date buttons (Today, Tomorrow) + date picker
  - Customer and milestone dropdowns
  - Context-aware: pre-fills customer/milestone when used in ProgressSidebar
- **TaskItem** (`ProgressSidebar/TaskItem.tsx`) - Task display with toggle/delete
  - Priority flag indicator
  - Due date badge with urgency styling (overdue, today, tomorrow, etc.)
  - Dropdown menu for actions
- **ProgressSidebar Tasks Section** - Customer-specific tasks with show/hide completed toggle
- **TodoSidebar** - Global task view with filters (replaced old `prompt()` dialog)

### Enterprise Optimization Implementation

**Modified Files:**

- `vite.config.ts` - Manual chunks for vendor splitting (React Compiler disabled for dev performance)
- `src/App.tsx` - Route-based code splitting with React.lazy, ErrorBoundary wrapper
- `src/stores/useCustomerStore.ts` - Pagination with infinite scroll (50 per page)
- `src/components/CustomerList/CustomerList.tsx` - Infinite scroll with IntersectionObserver
- `src/components/CustomerDetails/CustomerDetails.tsx` - Lazy loading for ExcelPopulateModal, PrintManager
- `src/components/CustomerForm/CustomerForm.tsx` - Lazy loading for IDScanner
- `src/components/common/DocumentThumbnail/DocumentThumbnail.tsx` - Lazy viewport loading, caching, memoization
- `src/context/ThemeContext.tsx` - Memoized context value to prevent unnecessary re-renders

**New Files:**

- `src/components/common/ErrorBoundary/` - Graceful error handling with fallback UI
- `src/utils/debug.ts` - Environment-aware logging utility

**Key Features:**

- **Code Splitting** - Heavy libraries (pdfjs-dist, xlsx, jspdf, tesseract.js) in separate chunks
- **Lazy Loading** - Dashboard, Documents, Excel pages loaded on demand
- **Pagination** - Customer list loads 50 at a time with infinite scroll
- **Error Boundaries** - Prevents app crashes, shows fallback UI
- **Vendor Chunking** - React, Supabase, PDF, Excel, OCR in separate bundles
- **Thumbnail Optimization** - IntersectionObserver for viewport-based loading, in-memory caching, lazy PDF.js import
- **Context Memoization** - ThemeContext uses useMemo/useCallback to prevent cascade re-renders

**Bundle Structure (after optimization):**

```
vendor-react.js     ~49KB   - React, React-DOM, Router
vendor-supabase.js  ~169KB  - Supabase client
vendor-pdf.js       ~822KB  - PDF.js (lazy loaded)
vendor-excel.js     ~687KB  - xlsx, xlsx-populate (lazy loaded)
index.js            ~217KB  - Main application
PrintManager.js     ~14KB   - Print feature (lazy loaded)
```

**Performance Notes:**

- React Compiler (`babel-plugin-react-compiler`) enabled for **production builds only** (causes dev mode slowdown)
- Configured in `vite.config.ts` with `isProduction` check
- DocumentThumbnail caches generated PDF thumbnails in memory to avoid re-rendering

### PrintManager Back Page Photo Attachment

**Modified Files:**

- `src/components/Documents/PrintManager.tsx` - Back page photo selection and PDF/print generation
- `src/components/Documents/PrintManager.css` - Photo modal and mobile action bar styles
- `src/components/CustomerDetails/CustomerDetails.tsx` - Portal rendering for mobile action sheet

**Key Features:**

- **Photo selection modal** - Select up to 4 photos from customer's documents folder
- **2x2 grid layout** - Photos positioned in quadrants for double-sided printing
- **PDF generation** - Back page added after each template page with photos
- **Print preview** - Separate `.page` containers for proper visual separation
- **Mobile support** - Photo button in bottom action bar, compact on small screens

**Photo Selection Flow:**

1. Click "Back" button (Images icon) in toolbar or mobile action bar
2. Modal opens with customer photos from all document subfolders
3. Select up to 4 photos (numbered positions 1-4)
4. Photos appear on back page in 2x2 grid when printing or downloading PDF

**Print Preview HTML Structure:**

```html
<div class="page front-page">
  <img src="[template with customer data]" />
</div>
<div class="page back-page">
  <div class="photo-grid">
    <img src="photo1.jpg" /> <img src="photo2.jpg" /> <img src="photo3.jpg" />
    <img src="photo4.jpg" />
  </div>
</div>
```

**CSS Page Styling:**

```css
.page {
  width: 210mm;
  min-height: 297mm;
  margin: 10px auto;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
@media print {
  .page {
    page-break-after: always;
  }
}
```

**Portal Pattern for Mobile Overlays:**
Mobile action sheets use `createPortal` to escape swipe container overflow clipping:

```typescript
import { createPortal } from 'react-dom';

{showMobileActions && createPortal(
  <>
    <div className="mobile-action-overlay" onClick={close} />
    <div className="mobile-action-sheet">...</div>
  </>,
  document.body
)}
```

---

## Supabase Architecture

### Supabase Client (`src/lib/supabase.ts`)

Simple singleton client:

```typescript
const supabaseInstance = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export function getSupabase() {
  return supabaseInstance
}
```

### Auth State Change Pattern (Critical)

The `onAuthStateChange` callback in Supabase has a **deadlock issue** - you cannot call other Supabase methods inside an async callback. This causes requests to hang indefinitely.

**Solution**: Use `setTimeout` to dispatch async work outside the callback:

```typescript
// In useAuthStore.ts
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    // MUST use setTimeout to avoid deadlock
    setTimeout(async () => {
      const { data: profile } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      // ... update state
    }, 0)
  }
})
```

See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

### Store Realtime Pattern

All stores (Customer, Document, Todo, Excel) follow this pattern for realtime subscriptions:

```typescript
subscribeToChanges: () => {
  const existing = get()._channel
  if (existing) existing.unsubscribe()

  const channel = getSupabase()
    .channel('table_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'xxx' }, (payload) => {
      /* handle INSERT/UPDATE/DELETE */
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => get().subscribeToChanges(), 3000)
      }
    })

  set({ _channel: channel })
  return () => {
    channel.unsubscribe()
    set({ _channel: null })
  }
}
```

### Customer Document Service (`src/services/customerDocumentService.ts`)

Optimized for performance:

- **URL caching** - 6-hour cache for signed URLs
- **Document list caching** - 2-minute cache per customer
- **Request deduplication** - Prevents duplicate in-flight requests
- **Batch operations** - Fetches all folders in one call, batches signed URL requests
- **Concurrency limiting** - Max 6 concurrent requests

---

## Quick Reference

### Adding a Feature

1. Types → `src/types/`
2. Constants → `src/constants/`
3. Store (if needed) → `src/stores/`
4. Service → `src/services/`
5. Components → `src/components/`

### Database Changes

1. Migration → `supabase/migrations/`
2. Update TypeScript types
3. Update Zustand store

### State Pattern

```typescript
// Zustand store with selectors
export const useCustomerStore = create<State & Actions>((set, get) => ({
  customers: [],
  fetchCustomers: async () => {
    /* ... */
  },
}))

export const useCustomers = () => useCustomerStore((s) => s.customers)
```

---

## Troubleshooting

### Invisible SVG Icons

When using icon libraries like `@phosphor-icons/react` or `lucide-react`, icons may appear invisible due to CSS conflicts.

**Symptoms:**

- Buttons appear empty but take up space
- DevTools shows SVG elements exist but nothing renders
- Unicode/emoji icons work but SVG icons don't

**Root Causes:**

1. **Missing `fill` property** - SVGs use `fill` instead of `color` for their paths
2. **CSS `display` override** - Some styles may set `display: none` or empty `display` on SVGs
3. **Opacity rules** - Generic selectors like `.header svg { opacity: 0.7 }` can affect icons unintentionally

**Solution - Global CSS Fix:**

Add this to `src/styles/globals.css`:

```css
/* Global SVG icon fix - ensures all SVGs render with proper fill */
svg {
  fill: currentColor;
}

/* Phosphor icons specific fix */
svg[xmlns='http://www.w3.org/2000/svg'] {
  display: inline-block;
  vertical-align: middle;
  fill: currentColor;
}
```

**Solution - Component-Specific Fix:**

For buttons containing SVG icons, use explicit styling with `!important`:

```css
.my-button svg {
  display: block !important;
  width: 16px !important;
  height: 16px !important;
  fill: currentColor !important;
  flex-shrink: 0;
}
```

**Why `!important` is needed:**
Phosphor and other icon libraries may inject inline styles or have high-specificity CSS that overrides your styles. Using `!important` ensures your styles take precedence.

**Debugging Steps:**

1. Check if the SVG element exists in DevTools (Elements tab)
2. Look for `element.style { display: }` or similar inline style overrides
3. Check if unchecking `display` in DevTools makes the icon appear
4. Test with Unicode characters (✓, ✕) - if these work, the issue is SVG-specific
5. Test with inline SVG + explicit `style={{ fill: '#color' }}` to confirm

**Files with SVG styling patterns:**

- `src/styles/globals.css` - Global SVG fix
- `src/components/CustomerList/CustomerList.css` - Button SVG styling
- `src/components/ProgressSidebar/ProgressSidebar.css` - Task button icons
- `src/components/common/InlineTaskForm.css` - Form button icons
