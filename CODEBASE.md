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
| Backend | Supabase (Auth, Database, Storage, Realtime) |
| AI | Google Gemini 2.5 Flash (document classification) |
| Icons | lucide-react |
| Excel | xlsx-populate |
| PDF | jsPDF |
| OCR | Tesseract.js |

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
│   │   └── common/          # Button, Modal, Toast, InlineTaskForm
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
Three-panel layout:
1. **Left**: Customer list with search/filter
2. **Center**: Customer details (tabbed)
3. **Right**: Progress sidebar (progress, next steps, milestones, tasks)

### ProgressSidebar (`ProgressSidebar/`)
Right-side panel with four sections:
- **Progress**: Current milestone badge
- **Next Steps**: Uncompleted checklist items from current milestone
- **All Milestones**: Expandable list with progress bars and checklists
- **Tasks**: Customer-specific tasks with inline add form

**Components**:
- `ProgressSidebar.tsx` - Main container
- `TaskItem.tsx` - Individual task with toggle/delete
- `InlineTaskForm` (from common) - Inline task creation

### TodoSidebar (`Layout/TodoSidebar.tsx`)
Global task sidebar (accessible from header):
- Filter by: All, Today, Overdue, High Priority, Completed
- Inline task creation with `InlineTaskForm`
- Stats showing today's and overdue task counts

### CustomerDetails Tabs
- **DetailsTab**: Basic info, address, vehicle
- **VsaTab**: VSA details, financing, trade-in
- **ProposalTab**: Proposal and benefits
- **DocumentsTab**: Document checklist and uploads

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

## Recent Changes (Reference)

| Commit | Description |
|--------|-------------|
| Latest | Task/Todo feature with inline forms, customer-specific tasks |
| 4fffb70 | Excel file classification, batch processing |
| 0faf764 | Excel integration, document management |
| 5dd6bd2 | OneDrive sync for scanned documents |

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
