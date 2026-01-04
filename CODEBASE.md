# BYD CRM V2 - Codebase Documentation

> **Purpose**: This document provides a comprehensive map of the codebase structure, architecture, and key patterns to help quickly understand the project in new development sessions.

---

## Project Overview

**BYD CRM V2** is a Customer Relationship Management system for BYD vehicle sales, managing the complete customer journey from test drive through delivery.

### Tech Stack
| Category | Technology |
|----------|------------|
| Frontend | React 19.2.0, TypeScript 5.9.3 |
| Build | Vite 7.2.4 |
| State | Zustand 5.0.9 |
| Backend | Supabase (Auth, Database, Storage, Realtime, Edge Functions) |
| AI | Google Gemini 2.5 Flash (document classification), Claude Haiku 4.5 (OCR classification) |
| Vision API | Google Cloud Vision (text extraction from images/PDFs) |
| Icons | @phosphor-icons/react |
| Excel | xlsx-populate (generation), xlsx (preview extraction) |
| PDF | jsPDF (generation), pdf.js (rendering, thumbnails) |
| OCR | Vision+Claude hybrid pipeline (primary), Tesseract.js (fallback) |

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
│   ├── lib/                 # Supabase client setup
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

| Route | Component | Description |
|-------|-----------|-------------|
| `/auth` | AuthPage | Login/signup (public) |
| `/` | Dashboard | Main 3-panel dashboard |
| `/customers/:id` | Dashboard | Dashboard with selected customer |
| `/documents` | DocumentsPage | Document template management |
| `/excel` | ExcelPage | Excel template management |

**Protection**: `AuthGuard` wraps protected routes.

---

## State Management (Zustand Stores)

### useAuthStore (`src/stores/useAuthStore.ts`)
- **State**: `user`, `session`, `profile`, `isLoading`, `isInitialized`
- **Key Actions**: `signIn()`, `signUp()`, `signOut()`, `updateProfile()`
- **Selectors**: `useUser()`, `useProfile()`, `useIsAuthenticated()`

### useCustomerStore (`src/stores/useCustomerStore.ts`)
- **State**: `customers`, `selectedCustomerId`, `isLoading`, `isSaving`
- **Key Actions**: `fetchCustomers()`, `createCustomer()`, `updateCustomer()`, `deleteCustomer()`, `archiveCustomer()`, `updateChecklistItem()`, `setCurrentMilestone()`
- **Selectors**: `useCustomers()`, `useSelectedCustomer()`
- **Realtime**: Subscribes to customer table changes

### useDocumentStore (`src/stores/useDocumentStore.ts`)
- **State**: `templates`, `selectedTemplateId`
- **Key Actions**: CRUD for document templates, field mappings, storage operations

### useExcelStore (`src/stores/useExcelStore.ts`)
- **State**: `templates`, `selectedTemplateId`
- **Key Actions**: CRUD for Excel templates, field mappings, file upload/download

### useTodoStore (`src/stores/useTodoStore.ts`)
- **State**: `todos`, `sidebarOpen`, `activeFilter`, `isSaving`
- **Key Actions**: `fetchTodos()`, `createTodo()`, `updateTodo()`, `deleteTodo()`, `toggleTodo()`, `subscribeToChanges()`
- **Selectors**: `useTodos()`, `useTodoSidebarOpen()`, `useTodoActiveFilter()`
- **Realtime**: Subscribes to todo table changes
- **Filters**: `all`, `today`, `overdue`, `high_priority`, `completed`

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
const isMobile = useIsMobile(); // true when viewport <= 768px
const isTablet = useIsTablet(); // true when viewport <= 1024px
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

| Service | Purpose |
|---------|---------|
| `excelService.ts` | Populate Excel templates with 200+ customer fields |
| `documentClassifierService.ts` | AI-powered document type classification using Gemini |
| `intelligentOcrService.ts` | Vision+Claude hybrid OCR with parallel processing |
| `bulkDocumentImportService.ts` | Batch document import and AI classification |
| `customerImportService.ts` | Import/export customers (JSON/CSV) |
| `customerDocumentService.ts` | Upload documents to Supabase storage |
| `geminiService.ts` | Google Gemini API configuration |

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

| Table | Description |
|-------|-------------|
| `profiles` | User settings, theme, API keys |
| `customers` | Main customer records |
| `guarantors` | Customer co-signers |
| `document_templates` | Editable document templates |
| `excel_templates` | Excel template field mappings |
| `todos` | Customer-related tasks |

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
  url: string;
  mimeType: string;
  filename?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  onClick?: () => void;
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
  imageData?: string;      // Base64 data URL
  rawText?: string;        // Pre-extracted text (Excel)
  documentType?: 'auto' | 'nric' | 'vsa' | 'trade_in';
  sourceType?: 'image' | 'excel';
  visionOnly?: boolean;    // Skip Claude, return OCR text only
}
```

**Response:**
```typescript
interface VisionClaudeResponse {
  documentType: string;    // e.g., 'nric_front', 'vsa', 'loan_approval'
  confidence: number;      // 0-100
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
  4  // concurrency limit
);
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

## Recent Changes (Reference)

| Commit | Description |
|--------|-------------|
| Latest | ProgressSidebar right border for proper panel boundary |
| Previous | PrintManager back page photo attachment for double-sided printing |
| Previous | Mobile action sheet portal fix for swipe containers |
| Previous | Enterprise optimization: code splitting, pagination, error boundaries |
| Previous | Add Generate Document button to CustomerDetails header |
| Previous | Document thumbnail card grid layout with large previews |
| Previous | Mobile documents tab optimization with action sheets |
| Previous | Vision+Claude OCR pipeline with parallel processing |
| Previous | Mobile optimization with swipe-based panel navigation |
| Previous | Task/Todo feature with inline forms, customer-specific tasks |
| 4fffb70 | Excel file classification, batch processing |
| 0faf764 | Excel integration, document management |
| 5dd6bd2 | OneDrive sync for scanned documents |

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
- React Compiler (`babel-plugin-react-compiler`) is installed but disabled - causes significant dev mode slowdown
- Can be re-enabled for production-only builds once stable
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
    <img src="photo1.jpg" /> <img src="photo2.jpg" />
    <img src="photo3.jpg" /> <img src="photo4.jpg" />
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
});

export function getSupabase() {
  return supabaseInstance;
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
        .single();
      // ... update state
    }, 0);
  }
});
```

See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

### Store Realtime Pattern
All stores (Customer, Document, Todo, Excel) follow this pattern for realtime subscriptions:

```typescript
subscribeToChanges: () => {
  const existing = get()._channel;
  if (existing) existing.unsubscribe();

  const channel = getSupabase()
    .channel('table_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'xxx' },
      (payload) => { /* handle INSERT/UPDATE/DELETE */ }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => get().subscribeToChanges(), 3000);
      }
    });

  set({ _channel: channel });
  return () => { channel.unsubscribe(); set({ _channel: null }); };
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
  fetchCustomers: async () => { /* ... */ },
}));

export const useCustomers = () => useCustomerStore((s) => s.customers);
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
svg[xmlns="http://www.w3.org/2000/svg"] {
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
