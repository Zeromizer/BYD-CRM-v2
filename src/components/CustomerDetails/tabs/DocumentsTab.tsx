import { useState, useEffect, useRef } from 'react';
import { Button, Modal, useToast } from '@/components/common';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Circle,
  FolderOpen,
  Loader2,
  X,
  AlertCircle,
  File,
  FileOutput,
} from 'lucide-react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useDocumentStore } from '@/stores/useDocumentStore';
import {
  uploadCustomerDocument,
  downloadDocument,
  deleteCustomerDocument,
  deleteCustomerDocuments,
  getAllCustomerDocuments,
  type CustomerDocument,
} from '@/services/customerDocumentService';
import {
  migrateCustomerDocuments,
  createMigrationFiles,
  filterSupportedFiles,
  type MigrationFile,
} from '@/services/documentMigrationService';
import {
  classifyDocuments,
  type ClassificationResult,
} from '@/services/documentClassifierService';
import { PrintManager } from '@/components/Documents/PrintManager';
import type { Customer, DocumentChecklistItem, MilestoneId, DocumentTemplate, DocumentChecklistState } from '@/types';

interface DocumentsTabProps {
  customer: Customer;
}

// Document categories and their requirements
// Note: 'alternateIds' allows matching uploads from AI classification that use different IDs
const DOCUMENT_CATEGORIES = [
  {
    id: 'identification',
    label: 'Identification',
    documents: [
      { id: 'nric_front', label: 'NRIC Front', alternateIds: ['nric', 'id_documents'] },
      { id: 'nric_back', label: 'NRIC Back', alternateIds: ['nric', 'id_documents'] },
      { id: 'license_front', label: 'Driving License Front', alternateIds: ['driving_license'] },
      { id: 'license_back', label: 'Driving License Back', alternateIds: ['driving_license'] },
    ],
  },
  {
    id: 'income',
    label: 'Income Documents',
    documents: [
      { id: 'payslip_1', label: 'Payslip (Latest)' },
      { id: 'payslip_2', label: 'Payslip (2nd Month)' },
      { id: 'payslip_3', label: 'Payslip (3rd Month)' },
      { id: 'cpf', label: 'CPF Statement' },
      { id: 'noa', label: 'Notice of Assessment' },
    ],
  },
  {
    id: 'loan',
    label: 'Loan Documents',
    documents: [
      { id: 'loan_application', label: 'Loan Application Form' },
      { id: 'loan_approval', label: 'Loan Approval Letter' },
      { id: 'giro_form', label: 'GIRO Form' },
    ],
  },
  {
    id: 'insurance',
    label: 'Insurance',
    documents: [
      { id: 'insurance_quote', label: 'Insurance Quote' },
      { id: 'insurance_policy', label: 'Insurance Policy' },
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    documents: [
      { id: 'vsa', label: 'Vehicle Sales Agreement' },
      { id: 'delivery_order', label: 'Delivery Order' },
      { id: 'handover_checklist', label: 'Handover Checklist' },
    ],
  },
];

interface UploadedDocuments {
  [docId: string]: CustomerDocument[];
}

export function DocumentsTab({ customer }: DocumentsTabProps) {
  const [activeCategory, setActiveCategory] = useState('identification');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocuments>({});
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ docId: string; doc: CustomerDocument } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentDocIdRef = useRef<string | null>(null);

  // Generate document state
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showPrintManager, setShowPrintManager] = useState(false);

  // Migration state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationFiles, setMigrationFiles] = useState<MigrationFile[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');
  const migrationInputRef = useRef<HTMLInputElement>(null);

  // AI Classification state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [classifiedFiles, setClassifiedFiles] = useState<{ file: File; name: string; classification: ClassificationResult }[]>([]);
  const [showClassificationResults, setShowClassificationResults] = useState(false);

  // All uploads state (for viewing all migrated documents)
  const [allUploads, setAllUploads] = useState<{ documentType: string; documents: CustomerDocument[] }[]>([]);

  // Multi-select state for bulk delete
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const { updateCustomer } = useCustomerStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const { templates, fetchTemplates } = useDocumentStore();
  const documentChecklist = customer.document_checklist;

  // Load uploaded documents and templates on mount
  useEffect(() => {
    loadDocuments();
    fetchTemplates();
  }, [customer.id, fetchTemplates]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load all documents from all folders
      const allDocsFromFolders = await getAllCustomerDocuments(customer.name);
      setAllUploads(allDocsFromFolders);

      // Also map to uploadedDocs for the category view
      const allDocs: UploadedDocuments = {};
      for (const folder of allDocsFromFolders) {
        allDocs[folder.documentType] = folder.documents;
      }
      setUploadedDocs(allDocs);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentStatus = (docId: string, alternateIds?: string[]): boolean => {
    // Check if we have uploaded files for this docId
    if (uploadedDocs[docId] && uploadedDocs[docId].length > 0) {
      return true;
    }
    // Check alternate IDs (e.g., 'driving_license' for 'license_front')
    if (alternateIds) {
      for (const altId of alternateIds) {
        if (uploadedDocs[altId] && uploadedDocs[altId].length > 0) {
          return true;
        }
      }
    }
    // Fallback to document checklist
    if (!documentChecklist) return false;
    const idsToCheck = [docId, ...(alternateIds || [])];
    for (const milestone of Object.values(documentChecklist)) {
      if (milestone && typeof milestone === 'object') {
        for (const checkId of idsToCheck) {
          if (checkId in milestone) {
            const doc = milestone[checkId];
            if (doc && (doc.status === 'approved' || doc.status === 'uploaded')) return true;
          }
        }
      }
    }
    return false;
  };

  const getCategoryProgress = (categoryId: string) => {
    const category = DOCUMENT_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return { completed: 0, total: 0 };

    const completed = category.documents.filter((doc: any) =>
      getDocumentStatus(doc.id, doc.alternateIds)
    ).length;
    return { completed, total: category.documents.length };
  };

  const handleUploadClick = (docId: string) => {
    currentDocIdRef.current = docId;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const docId = currentDocIdRef.current;

    if (!file || !docId) return;

    // Reset input
    event.target.value = '';

    setUploadingDocId(docId);
    setError(null);

    try {
      const uploadedDoc = await uploadCustomerDocument(docId, file, customer.name);

      // Update local state
      setUploadedDocs((prev) => ({
        ...prev,
        [docId]: [...(prev[docId] || []), uploadedDoc],
      }));

      // Update document checklist in customer record
      // Using the current milestone for document organization
      const milestoneId = customer.current_milestone;
      const currentChecklist = customer.document_checklist || {} as Record<MilestoneId, Record<string, DocumentChecklistItem>>;
      const milestoneChecklist = currentChecklist[milestoneId] || {};

      const updatedChecklist = {
        ...currentChecklist,
        [milestoneId]: {
          ...milestoneChecklist,
          [docId]: {
            status: 'uploaded' as const,
            uploadedAt: new Date().toISOString(),
            uploadedFiles: [
              {
                fileId: uploadedDoc.id,
                fileName: uploadedDoc.name,
                uploadedAt: uploadedDoc.uploadedAt,
              },
            ],
            reviewedAt: null,
            reviewedBy: null,
            notes: '',
          } as DocumentChecklistItem,
        },
      };

      await updateCustomer(customer.id, {
        document_checklist: updatedChecklist,
      });
    } catch (err) {
      setError('Failed to upload document');
      console.error('Error uploading document:', err);
    } finally {
      setUploadingDocId(null);
      currentDocIdRef.current = null;
    }
  };

  const handleView = async (docId: string) => {
    const docs = uploadedDocs[docId];
    if (!docs || docs.length === 0) return;

    const doc = docs[0]; // View the first/latest document
    setPreviewDoc(doc);
    setShowPreviewModal(true);
  };

  const handleDownload = async (docId: string) => {
    const docs = uploadedDocs[docId];
    if (!docs || docs.length === 0) return;

    const doc = docs[0];

    try {
      const blob = await downloadDocument(doc.path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download document');
      console.error('Error downloading document:', err);
    }
  };

  const handleDeleteClick = (docId: string) => {
    const docs = uploadedDocs[docId];
    if (!docs || docs.length === 0) return;

    setDocToDelete({ docId, doc: docs[0] });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;

    const { docId, doc } = docToDelete;

    try {
      await deleteCustomerDocument(doc.path);

      // Update local state
      setUploadedDocs((prev) => {
        const updated = { ...prev };
        if (updated[docId]) {
          updated[docId] = updated[docId].filter((d) => d.id !== doc.id);
          if (updated[docId].length === 0) {
            delete updated[docId];
          }
        }
        return updated;
      });

      // Update document checklist
      const milestoneId = customer.current_milestone;
      const currentChecklist = customer.document_checklist || {} as Record<MilestoneId, Record<string, DocumentChecklistItem>>;
      const milestoneChecklist = currentChecklist[milestoneId] || {};
      if (milestoneChecklist[docId]) {
        const updatedChecklist = {
          ...currentChecklist,
          [milestoneId]: {
            ...milestoneChecklist,
            [docId]: {
              ...milestoneChecklist[docId],
              status: 'pending' as const,
              uploadedFiles: [],
            },
          },
        };

        await updateCustomer(customer.id, {
          document_checklist: updatedChecklist,
        });
      }

      setShowDeleteConfirm(false);
      setDocToDelete(null);
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  // Multi-select handlers for bulk delete
  const toggleDocSelection = (docPath: string) => {
    setSelectedDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docPath)) {
        newSet.delete(docPath);
      } else {
        newSet.add(docPath);
      }
      return newSet;
    });
  };

  const selectAllDocs = () => {
    const allPaths = allUploads.flatMap(folder => folder.documents.map(doc => doc.path));
    setSelectedDocs(new Set(allPaths));
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedDocs.size === 0) return;

    const count = selectedDocs.size;
    setIsDeleting(true);
    try {
      // Delete all selected documents in one batch
      await deleteCustomerDocuments(Array.from(selectedDocs));

      toastSuccess(`Deleted ${count} documents`);
      setSelectedDocs(new Set());

      // Reload documents
      await loadDocuments();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toastError('Failed to delete documents');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeDocuments =
    DOCUMENT_CATEGORIES.find((c) => c.id === activeCategory)?.documents || [];

  const isImageFile = (mimeType: string): boolean => {
    return mimeType.startsWith('image/');
  };

  const isPdfFile = (mimeType: string): boolean => {
    return mimeType === 'application/pdf';
  };

  const handleGenerateDocument = () => {
    setShowTemplateSelect(true);
  };

  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelect(false);
    setShowPrintManager(true);
  };

  const handleClosePrintManager = () => {
    setShowPrintManager(false);
    setSelectedTemplate(null);
  };

  // Migration handlers
  const handleMigrationFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = createMigrationFiles(fileList);
    const supportedFiles = filterSupportedFiles(files);
    setMigrationFiles(supportedFiles);
    setShowMigrationModal(true);

    // Reset input
    event.target.value = '';
  };

  const handleStartMigration = async () => {
    if (migrationFiles.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress('Starting migration...');

    try {
      const result = await migrateCustomerDocuments(
        customer,
        migrationFiles,
        (current, total, filename) => {
          setMigrationProgress(`Uploading ${current}/${total}: ${filename}`);
        }
      ) as { success: boolean; uploaded: number; failed: number; errors: string[]; updatedChecklist?: DocumentChecklistState };

      setMigrationProgress('Saving document checklist...');

      // Save the updated checklist
      if (result.updatedChecklist) {
        try {
          await updateCustomer(customer.id, {
            document_checklist: result.updatedChecklist,
          });
        } catch (checklistErr) {
          console.error('Failed to save checklist:', checklistErr);
          // Continue anyway - files are uploaded
        }
      }

      // Show success toast first
      if (result.success) {
        toastSuccess(`Migrated ${result.uploaded} documents successfully`);
      } else {
        toastSuccess(`Migrated ${result.uploaded} documents (${result.failed} failed)`);
        if (result.errors.length > 0) {
          console.error('Migration errors:', result.errors);
        }
      }

      // Close modal and reset state immediately
      setShowMigrationModal(false);
      setMigrationFiles([]);
      setIsMigrating(false);
      setMigrationProgress('');

      // Reload documents in background (don't await)
      loadDocuments().catch(err => {
        console.error('Failed to reload documents:', err);
      });
    } catch (err) {
      console.error('Migration failed:', err);
      toastError('Failed to migrate documents');
      setIsMigrating(false);
      setMigrationProgress('');
    }
  };

  const handleCancelMigration = () => {
    setShowMigrationModal(false);
    setMigrationFiles([]);
    setIsMigrating(false);
    setMigrationProgress('');
    setIsScanning(false);
    setScanProgress('');
    setClassifiedFiles([]);
    setShowClassificationResults(false);
  };

  // AI Scan handler
  const handleAIScan = async () => {
    if (migrationFiles.length === 0) return;

    setIsScanning(true);
    setScanProgress('Starting AI scan...');

    try {
      // Convert MigrationFile[] to format needed for classification
      const filesToScan = migrationFiles
        .filter(mf => mf.file) // Only files that have File object
        .map(mf => ({ file: mf.file!, name: mf.name }));

      const results = await classifyDocuments(
        filesToScan,
        (current, total, filename, result) => {
          setScanProgress(`Scanning ${current}/${total}: ${filename}${result ? ` → ${result.documentTypeName}` : ''}`);
        }
      );

      setClassifiedFiles(results);
      setShowClassificationResults(true);
      toastSuccess(`Scanned ${results.length} documents with AI`);
    } catch (err) {
      console.error('AI scan failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toastError(`AI scan failed: ${errorMessage}`);
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // Upload classified files with AI-determined types
  const handleUploadClassified = async () => {
    if (classifiedFiles.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress('Uploading classified documents...');

    try {
      // Convert classified files to MigrationFile format with AI-determined types
      const filesToUpload: MigrationFile[] = classifiedFiles.map(cf => ({
        name: cf.name,
        path: cf.name,
        folder: cf.classification.folder,
        file: cf.file,
        // Override document type with AI classification
        documentType: cf.classification.documentType,
      }));

      // Update migration files with AI types before uploading
      const result = await migrateCustomerDocuments(
        customer,
        filesToUpload.map(f => ({
          ...f,
          folder: f.folder, // Use AI folder as hint
        })),
        (current, total, filename) => {
          setMigrationProgress(`Uploading ${current}/${total}: ${filename}`);
        }
      ) as { success: boolean; uploaded: number; failed: number; errors: string[]; updatedChecklist?: DocumentChecklistState };

      // Save checklist
      if (result.updatedChecklist) {
        try {
          await updateCustomer(customer.id, {
            document_checklist: result.updatedChecklist,
          });
        } catch (checklistErr) {
          console.error('Failed to save checklist:', checklistErr);
        }
      }

      if (result.success) {
        toastSuccess(`Uploaded ${result.uploaded} documents successfully`);
      } else {
        toastSuccess(`Uploaded ${result.uploaded} documents (${result.failed} failed)`);
      }

      // Reset all state
      setShowMigrationModal(false);
      setMigrationFiles([]);
      setIsMigrating(false);
      setMigrationProgress('');
      setClassifiedFiles([]);
      setShowClassificationResults(false);

      loadDocuments().catch(console.error);
    } catch (err) {
      console.error('Upload failed:', err);
      toastError('Failed to upload documents');
      setIsMigrating(false);
      setMigrationProgress('');
    }
  };

  // Update classification for a specific file
  const handleUpdateClassification = (index: number, newType: string) => {
    setClassifiedFiles(prev => {
      const updated = [...prev];
      const docTypes: Record<string, { name: string; folder: string; milestone: string }> = {
        nric_front: { name: 'NRIC Front', folder: 'NRIC', milestone: 'test_drive' },
        nric_back: { name: 'NRIC Back', folder: 'NRIC', milestone: 'test_drive' },
        driving_license: { name: 'Driving License', folder: 'Driving License', milestone: 'test_drive' },
        vsa: { name: 'Vehicle Sales Agreement', folder: 'VSA', milestone: 'close_deal' },
        insurance_quote: { name: 'Insurance Quote', folder: 'Insurance', milestone: 'registration' },
        insurance_policy: { name: 'Insurance Policy', folder: 'Insurance', milestone: 'registration' },
        payment_proof: { name: 'Payment Proof', folder: 'Payments', milestone: 'registration' },
        loan_approval: { name: 'Loan Approval', folder: 'Finance', milestone: 'close_deal' },
        delivery_checklist: { name: 'Delivery Checklist', folder: 'Delivery', milestone: 'delivery' },
        other: { name: 'Other', folder: 'Other', milestone: 'test_drive' },
      };
      const typeInfo = docTypes[newType] || docTypes.other;
      updated[index] = {
        ...updated[index],
        classification: {
          ...updated[index].classification,
          documentType: newType as ClassificationResult['documentType'],
          documentTypeName: typeInfo.name,
          folder: typeInfo.folder,
          milestone: typeInfo.milestone,
        },
      };
      return updated;
    });
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const category = template.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, DocumentTemplate[]>);

  const categoryLabels: Record<string, string> = {
    vsa: 'Vehicle Sales Agreement',
    insurance: 'Insurance',
    delivery: 'Delivery',
    test_drive: 'Test Drive',
    finance: 'Finance',
    other: 'Other',
  };

  // If showing print manager, render it full screen
  if (showPrintManager && selectedTemplate) {
    return (
      <PrintManager
        template={selectedTemplate}
        customer={customer}
        onClose={handleClosePrintManager}
      />
    );
  }

  return (
    <div className="documents-tab">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        hidden
      />

      {/* Hidden folder input for migration */}
      <input
        ref={migrationInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in types but works in browsers
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleMigrationFolderSelect}
        hidden
      />

      {/* Category Sidebar */}
      <div className="documents-sidebar">
        {/* Generate Document Button */}
        <Button
          className="generate-doc-btn"
          onClick={handleGenerateDocument}
          leftIcon={<FileOutput size={16} />}
        >
          Generate Document
        </Button>

        {/* Import from Folder Button */}
        <Button
          className="generate-doc-btn"
          variant="outline"
          onClick={() => migrationInputRef.current?.click()}
          leftIcon={<span style={{ fontSize: '14px' }}>📁</span>}
        >
          Import from Folder
        </Button>

        <div className="sidebar-divider" />
        {DOCUMENT_CATEGORIES.map((category) => {
          const progress = getCategoryProgress(category.id);
          const isComplete = progress.completed === progress.total;

          return (
            <button
              key={category.id}
              className={`category-button ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <div className="category-info">
                <FolderOpen size={16} />
                <span className="category-label">{category.label}</span>
              </div>
              <span
                className={`category-progress ${isComplete ? 'complete' : ''}`}
              >
                {progress.completed}/{progress.total}
              </span>
            </button>
          );
        })}

        <div className="sidebar-divider" />
        {/* All Uploads - shows all documents from Supabase */}
        <button
          className={`category-button ${activeCategory === 'all_uploads' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all_uploads')}
        >
          <div className="category-info">
            <File size={16} />
            <span className="category-label">All Uploads</span>
          </div>
          <span className="category-progress">
            {allUploads.reduce((sum, f) => sum + f.documents.length, 0)}
          </span>
        </button>
      </div>

      {/* Document List */}
      <div className="documents-content">
        <div className="documents-header">
          <h3>
            {activeCategory === 'all_uploads'
              ? 'All Uploads'
              : DOCUMENT_CATEGORIES.find((c) => c.id === activeCategory)?.label}
          </h3>
          {isLoading && (
            <div className="loading-indicator">
              <Loader2 size={16} className="spin" />
              Loading...
            </div>
          )}
        </div>

        {error && (
          <div className="documents-error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {activeCategory === 'all_uploads' ? (
          /* All Uploads View */
          <div className="all-uploads-list">
            {allUploads.length === 0 ? (
              <div className="no-uploads">
                <File size={48} strokeWidth={1} />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <>
                {/* Selection toolbar */}
                <div className="selection-toolbar">
                  <div className="selection-info">
                    <input
                      type="checkbox"
                      checked={selectedDocs.size > 0 && selectedDocs.size === allUploads.flatMap(f => f.documents).length}
                      onChange={(e) => e.target.checked ? selectAllDocs() : clearSelection()}
                      title="Select all"
                    />
                    <span>
                      {selectedDocs.size > 0
                        ? `${selectedDocs.size} selected`
                        : `${allUploads.reduce((sum, f) => sum + f.documents.length, 0)} documents`}
                    </span>
                  </div>
                  {selectedDocs.size > 0 && (
                    <div className="selection-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="danger"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            Delete ({selectedDocs.size})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {allUploads.map((folder) => (
                  <div key={folder.documentType} className="upload-folder">
                    <h4 className="folder-title">
                      <FolderOpen size={16} />
                      {folder.documentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      <span className="folder-count">({folder.documents.length})</span>
                    </h4>
                    <div className="folder-documents">
                      {folder.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`document-item uploaded ${selectedDocs.has(doc.path) ? 'selected' : ''}`}
                        >
                          <div className="document-info">
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(doc.path)}
                              onChange={() => toggleDocSelection(doc.path)}
                              className="doc-checkbox"
                            />
                            <FileText size={18} className="document-icon" />
                            <div className="document-details">
                              <span className="document-label">{doc.name}</span>
                              <span className="document-filename">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="document-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPreviewDoc(doc);
                                setShowPreviewModal(true);
                              }}
                              title="View"
                            >
                              <Eye size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const blob = await downloadDocument(doc.path);
                                  const url = URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = doc.name;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                } catch (err) {
                                  setError('Failed to download document');
                                }
                              }}
                              title="Download"
                            >
                              <Download size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDocToDelete({ docId: folder.documentType, doc });
                                setShowDeleteConfirm(true);
                              }}
                              title="Delete"
                              className="danger"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Category View */
          <div className="documents-list">
            {activeDocuments.map((doc: any) => {
              const isUploaded = getDocumentStatus(doc.id, doc.alternateIds);
              const isUploading = uploadingDocId === doc.id;
              // Get docs from primary ID or alternate IDs
              let docs = uploadedDocs[doc.id] || [];
              if (docs.length === 0 && doc.alternateIds) {
                for (const altId of doc.alternateIds) {
                  if (uploadedDocs[altId] && uploadedDocs[altId].length > 0) {
                    docs = uploadedDocs[altId];
                    break;
                  }
                }
              }

              return (
                <div
                  key={doc.id}
                  className={`document-item ${isUploaded ? 'uploaded' : ''}`}
                >
                  <div className="document-info">
                    {isUploaded ? (
                      <CheckCircle size={18} className="status-icon uploaded" />
                    ) : (
                      <Circle size={18} className="status-icon pending" />
                    )}
                    <FileText size={18} className="document-icon" />
                    <div className="document-details">
                      <span className="document-label">{doc.label}</span>
                      {docs.length > 0 && (
                        <span className="document-filename">{docs[0].name}</span>
                      )}
                    </div>
                  </div>

                  <div className="document-actions">
                    {isUploading ? (
                      <div className="uploading-indicator">
                        <Loader2 size={16} className="spin" />
                        Uploading...
                      </div>
                    ) : isUploaded ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(doc.id)}
                          title="View"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc.id)}
                          title="Download"
                        >
                          <Download size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(doc.id)}
                          title="Delete"
                          className="danger"
                        >
                          <Trash2 size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUploadClick(doc.id)}
                          title="Replace"
                        >
                          <Upload size={14} />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadClick(doc.id)}
                      >
                        <Upload size={14} />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewDoc(null);
        }}
        title={previewDoc?.name || 'Document Preview'}
        size="lg"
      >
        <div className="document-preview">
          {previewDoc && (
            <>
              {isImageFile(previewDoc.mimeType) ? (
                <img src={previewDoc.url} alt={previewDoc.name} />
              ) : isPdfFile(previewDoc.mimeType) ? (
                <iframe src={previewDoc.url} title={previewDoc.name} />
              ) : (
                <div className="unsupported-preview">
                  <File size={48} strokeWidth={1} />
                  <p>Preview not available for this file type</p>
                  <Button onClick={() => handleDownload(docToDelete?.docId || '')}>
                    <Download size={14} />
                    Download to View
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDocToDelete(null);
        }}
        title="Delete Document"
        size="sm"
      >
        <div className="delete-confirmation">
          <p>
            Are you sure you want to delete <strong>{docToDelete?.doc.name}</strong>?
          </p>
          <p className="warning">This action cannot be undone.</p>
          <div className="confirmation-actions">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDocToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Template Selection Modal */}
      <Modal
        isOpen={showTemplateSelect}
        onClose={() => setShowTemplateSelect(false)}
        title="Select Document Template"
        size="lg"
      >
        <div className="template-select-modal">
          <p className="template-select-description">
            Select a template to generate a document for <strong>{customer.name}</strong>
          </p>

          {templates.length === 0 ? (
            <div className="no-templates">
              <FileText size={48} strokeWidth={1} />
              <p>No document templates available</p>
              <p className="hint">Create templates in the Documents section first</p>
            </div>
          ) : (
            <div className="template-categories">
              {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                <div key={category} className="template-category">
                  <h4 className="category-title">{categoryLabels[category] || category}</h4>
                  <div className="template-grid">
                    {categoryTemplates.map((template) => (
                      <button
                        key={template.id}
                        className="template-card"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        {template.image_url ? (
                          <img
                            src={template.image_url}
                            alt={template.name}
                            className="template-thumbnail"
                          />
                        ) : (
                          <div className="template-placeholder">
                            <FileText size={32} />
                          </div>
                        )}
                        <span className="template-name">{template.name}</span>
                        <span className="template-fields">
                          {Object.keys(template.fields || {}).length} fields
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Migration Modal */}
      <Modal
        isOpen={showMigrationModal}
        onClose={handleCancelMigration}
        title={showClassificationResults ? "AI Classification Results" : "Import Documents from Folder"}
        size="lg"
      >
        <div className="migration-modal">
          {!showClassificationResults ? (
            // Step 1: Show files and offer AI scan
            <>
              <p className="migration-description">
                Found <strong>{migrationFiles.length}</strong> documents to import for <strong>{customer.name}</strong>
              </p>

              {migrationFiles.length > 0 && !isScanning && (
                <div className="migration-file-list">
                  <h4>Files to import:</h4>
                  <div className="file-list-scroll">
                    {migrationFiles.slice(0, 20).map((file, index) => (
                      <div key={index} className="migration-file-item">
                        <File size={14} />
                        <span className="file-name">{file.name}</span>
                        {file.folder && <span className="file-folder">({file.folder})</span>}
                      </div>
                    ))}
                    {migrationFiles.length > 20 && (
                      <p className="more-files">...and {migrationFiles.length - 20} more files</p>
                    )}
                  </div>
                </div>
              )}

              {(isScanning || isMigrating) && (scanProgress || migrationProgress) && (
                <div className="migration-progress">
                  <Loader2 size={16} className="spin" />
                  <span>{scanProgress || migrationProgress}</span>
                </div>
              )}

              <div className="confirmation-actions">
                <Button
                  variant="outline"
                  onClick={handleCancelMigration}
                  disabled={isMigrating}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAIScan}
                  disabled={isScanning || isMigrating || migrationFiles.length === 0}
                >
                  {isScanning ? 'Scanning...' : '✨ Scan with AI'}
                </Button>
                <Button
                  onClick={handleStartMigration}
                  disabled={isScanning || isMigrating || migrationFiles.length === 0}
                >
                  {isMigrating ? 'Importing...' : 'Import Without AI'}
                </Button>
              </div>
            </>
          ) : (
            // Step 2: Show AI classification results
            <>
              <p className="migration-description">
                AI has classified <strong>{classifiedFiles.length}</strong> documents. Review and adjust if needed:
              </p>

              <div className="classification-results">
                <div className="file-list-scroll">
                  {classifiedFiles.map((item, index) => (
                    <div key={index} className="classified-file-item">
                      <div className="classified-file-info">
                        <File size={14} />
                        <span className="file-name">{item.name}</span>
                        <span className={`confidence ${item.classification.confidence >= 75 ? 'high' : item.classification.confidence >= 50 ? 'medium' : 'low'}`}>
                          {item.classification.confidence}%
                        </span>
                      </div>
                      <div className="classified-file-type">
                        <select
                          value={item.classification.documentType}
                          onChange={(e) => handleUpdateClassification(index, e.target.value)}
                          className="type-select"
                        >
                          <option value="nric_front">NRIC Front</option>
                          <option value="nric_back">NRIC Back</option>
                          <option value="driving_license">Driving License</option>
                          <option value="vsa">VSA</option>
                          <option value="insurance_quote">Insurance Quote</option>
                          <option value="insurance_policy">Insurance Policy</option>
                          <option value="payment_proof">Payment Proof</option>
                          <option value="loan_approval">Loan Approval</option>
                          <option value="delivery_checklist">Delivery Checklist</option>
                          <option value="other">Other</option>
                        </select>
                        <span className="folder-badge">{item.classification.folder}</span>
                      </div>
                      {item.classification.customerName && (
                        <div className="extracted-name">
                          Customer: {item.classification.customerName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isMigrating && migrationProgress && (
                <div className="migration-progress">
                  <Loader2 size={16} className="spin" />
                  <span>{migrationProgress}</span>
                </div>
              )}

              <div className="confirmation-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowClassificationResults(false);
                    setClassifiedFiles([]);
                  }}
                  disabled={isMigrating}
                >
                  Back
                </Button>
                <Button
                  onClick={handleUploadClassified}
                  disabled={isMigrating || classifiedFiles.length === 0}
                >
                  {isMigrating ? 'Uploading...' : `Upload ${classifiedFiles.length} Files`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
