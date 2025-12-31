import { useState, useEffect, useRef } from 'react';
import { Button, Modal } from '@/components/common';
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
  getCustomerDocuments,
  downloadDocument,
  deleteCustomerDocument,
  type CustomerDocument,
} from '@/services/customerDocumentService';
import { PrintManager } from '@/components/Documents/PrintManager';
import type { Customer, DocumentChecklistItem, MilestoneId, DocumentTemplate } from '@/types';

interface DocumentsTabProps {
  customer: Customer;
}

// Document categories and their requirements
const DOCUMENT_CATEGORIES = [
  {
    id: 'identification',
    label: 'Identification',
    documents: [
      { id: 'nric_front', label: 'NRIC Front' },
      { id: 'nric_back', label: 'NRIC Back' },
      { id: 'license_front', label: 'Driving License Front' },
      { id: 'license_back', label: 'Driving License Back' },
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

  const { updateCustomer } = useCustomerStore();
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
      // Load documents for each document type
      const allDocs: UploadedDocuments = {};

      for (const category of DOCUMENT_CATEGORIES) {
        for (const doc of category.documents) {
          try {
            const docs = await getCustomerDocuments(customer.id, doc.id);
            if (docs.length > 0) {
              allDocs[doc.id] = docs;
            }
          } catch (err) {
            // Ignore errors for individual document types (folder might not exist)
          }
        }
      }

      setUploadedDocs(allDocs);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentStatus = (docId: string): boolean => {
    // Check if we have uploaded files
    if (uploadedDocs[docId] && uploadedDocs[docId].length > 0) {
      return true;
    }
    // Fallback to document checklist
    if (!documentChecklist) return false;
    for (const milestone of Object.values(documentChecklist)) {
      if (milestone && typeof milestone === 'object' && docId in milestone) {
        const doc = milestone[docId];
        if (doc && (doc.status === 'approved' || doc.status === 'uploaded')) return true;
      }
    }
    return false;
  };

  const getCategoryProgress = (categoryId: string) => {
    const category = DOCUMENT_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return { completed: 0, total: 0 };

    const completed = category.documents.filter((doc) =>
      getDocumentStatus(doc.id)
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
      const uploadedDoc = await uploadCustomerDocument(customer.id, docId, file);

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
      </div>

      {/* Document List */}
      <div className="documents-content">
        <div className="documents-header">
          <h3>
            {DOCUMENT_CATEGORIES.find((c) => c.id === activeCategory)?.label}
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

        <div className="documents-list">
          {activeDocuments.map((doc) => {
            const isUploaded = getDocumentStatus(doc.id);
            const isUploading = uploadingDocId === doc.id;
            const docs = uploadedDocs[doc.id] || [];

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
    </div>
  );
}
