/**
 * DocumentManager Component
 * Manages document templates with CRUD operations and category filtering
 */

import { useState, useEffect, useRef } from 'react';
import { CircleNotch, Cloud, Plus, MagnifyingGlass, File, Image, DotsThreeVertical, PencilSimple, Printer, Copy, Trash, UploadSimple, X } from '@phosphor-icons/react';
import { Button, Modal } from '@/components/common';
import { useToast } from '@/components/common';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { supabase } from '@/lib/supabase';
import type { DocumentTemplate, DocumentCategory } from '@/types';
import './DocumentManager.css';

interface DocumentManagerProps {
  onEditTemplate?: (template: DocumentTemplate) => void;
  onPrintTemplate?: (template: DocumentTemplate) => void;
}

const CATEGORIES: { id: DocumentCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'vsa', label: 'VSA' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'test_drive', label: 'Test Drive' },
  { id: 'finance', label: 'Finance' },
  { id: 'other', label: 'Other' },
];

export function DocumentManager({ onEditTemplate, onPrintTemplate }: DocumentManagerProps) {
  const {
    templates,
    isLoading,
    isSaving,
    error,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    uploadTemplateImage,
    subscribeToChanges,
    clearError,
  } = useDocumentStore();

  const { success, error: toastError } = useToast();

  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSyncResultModal, setShowSyncResultModal] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    processed: number;
    pending: number;
    failed: number;
    message: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<DocumentCategory>('other');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
    const unsubscribe = subscribeToChanges();
    return () => unsubscribe();
  }, [fetchTemplates, subscribeToChanges]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      let imagePath: string | null = null;
      let imageUrl: string | null = null;

      if (selectedFile) {
        const result = await uploadTemplateImage(selectedFile);
        imagePath = result.path;
        imageUrl = result.url;
      }

      const newTemplate = await createTemplate({
        name: newTemplateName.trim(),
        category: newTemplateCategory,
        image_path: imagePath,
        image_url: imageUrl,
      });

      setShowCreateModal(false);
      resetCreateForm();

      // Open editor for new template
      if (onEditTemplate && newTemplate) {
        onEditTemplate(newTemplate);
      }
    } catch (err) {
      console.error('Error creating template:', err);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      await deleteTemplate(selectedTemplate.id);
      setShowDeleteModal(false);
      setSelectedTemplate(null);
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      await createTemplate({
        name: `${template.name} (Copy)`,
        category: template.category,
        image_path: template.image_path,
        image_url: template.image_url,
        dpi: template.dpi,
        width: template.width,
        height: template.height,
        fields: { ...template.fields },
      });
      setOpenDropdownId(null);
    } catch (err) {
      console.error('Error duplicating template:', err);
    }
  };

  const resetCreateForm = () => {
    setNewTemplateName('');
    setNewTemplateCategory('other');
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFieldCount = (template: DocumentTemplate): number => {
    return Object.keys(template.fields || {}).length;
  };

  const getCategoryColor = (category: DocumentCategory): string => {
    const colors: Record<DocumentCategory, string> = {
      vsa: '#0891b2',
      insurance: '#059669',
      delivery: '#6366f1',
      test_drive: '#64748b',
      finance: '#d97706',
      other: '#8b5cf6',
    };
    return colors[category] || '#64748b';
  };

  const handleSyncOneDrive = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-onedrive');

      if (error) {
        throw new Error(error.message || 'Sync failed');
      }

      if (data.success) {
        setSyncResult({
          processed: data.processed || 0,
          pending: data.pending || 0,
          failed: data.failed || 0,
          message: data.message || 'Sync completed',
        });
        setShowSyncResultModal(true);

        if (data.processed > 0) {
          success(`${data.processed} document(s) synced successfully`);
        } else if (data.pending > 0) {
          success(`${data.pending} document(s) need review`);
        } else {
          success('No new documents to sync');
        }
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to sync OneDrive');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="document-manager">
      {/* Header */}
      <div className="dm-header">
        <h2>Document Templates</h2>
        <div className="dm-header-actions">
          <Button
            variant="outline"
            onClick={handleSyncOneDrive}
            isLoading={isSyncing}
            leftIcon={isSyncing ? <CircleNotch size={16} className="spinning" /> : <Cloud size={16} />}
          >
            {isSyncing ? 'Syncing...' : 'Sync OneDrive'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus size={16} />}>
            New Template
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="dm-error">
          <span>{error}</span>
          <button onClick={clearError}><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="dm-filters">
        <div className="dm-search">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="dm-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="dm-loading">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="dm-empty">
          <File size={48} className="empty-icon" />
          <h3>No templates found</h3>
          <p>
            {searchQuery || activeCategory !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first document template'}
          </p>
          {!searchQuery && activeCategory === 'all' && (
            <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus size={16} />}>
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div className="dm-grid">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="template-card">
              {/* Template Preview */}
              <div className="template-preview" onClick={() => onEditTemplate?.(template)}>
                {template.image_url ? (
                  <img src={template.image_url} alt={template.name} />
                ) : (
                  <div className="template-preview-placeholder">
                    <Image size={32} className="placeholder-icon" />
                    <span>No image</span>
                  </div>
                )}
              </div>

              {/* Template Info */}
              <div className="template-info">
                <div className="template-header">
                  <h4 className="template-name" title={template.name}>
                    {template.name}
                  </h4>
                  <div className="template-actions" ref={openDropdownId === template.id ? dropdownRef : null}>
                    <button
                      className="action-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === template.id ? null : template.id);
                      }}
                    >
                      <DotsThreeVertical size={18} className="more-icon" />
                    </button>
                    {openDropdownId === template.id && (
                      <div className="action-dropdown">
                        <button onClick={() => { onEditTemplate?.(template); setOpenDropdownId(null); }}>
                          <PencilSimple size={14} className="menu-icon" /> Edit Fields
                        </button>
                        <button onClick={() => { onPrintTemplate?.(template); setOpenDropdownId(null); }}>
                          <Printer size={14} className="menu-icon" /> Print Preview
                        </button>
                        <button onClick={() => handleDuplicateTemplate(template)}>
                          <Copy size={14} className="menu-icon" /> Duplicate
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowDeleteModal(true);
                            setOpenDropdownId(null);
                          }}
                        >
                          <Trash size={14} className="menu-icon" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="template-meta">
                  <span
                    className="category-badge"
                    style={{ backgroundColor: getCategoryColor(template.category) }}
                  >
                    {template.category}
                  </span>
                  <span className="field-count">{getFieldCount(template)} fields</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        title="Create New Template"
        size="md"
      >
        <div className="create-template-form">
          <div className="form-group">
            <label htmlFor="template-name">Template Name</label>
            <input
              id="template-name"
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g., VSA Form Page 1"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="template-category">Category</label>
            <select
              id="template-category"
              value={newTemplateCategory}
              onChange={(e) => setNewTemplateCategory(e.target.value as DocumentCategory)}
            >
              {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Template Image (optional)</label>
            <div className="file-upload-area">
              {previewUrl ? (
                <div className="file-preview">
                  <img src={previewUrl} alt="Preview" />
                  <button
                    className="remove-file"
                    onClick={() => {
                      setSelectedFile(null);
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                  <UploadSimple size={24} className="upload-icon" />
                  <span>Click to upload image</span>
                  <small>PNG, JPG up to 10MB</small>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                hidden
              />
            </div>
          </div>

          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              isLoading={isSaving}
              disabled={!newTemplateName.trim()}
            >
              Create Template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTemplate(null);
        }}
        title="Delete Template"
        size="sm"
      >
        <div className="delete-confirmation">
          <p>
            Are you sure you want to delete <strong>{selectedTemplate?.name}</strong>?
          </p>
          <p className="warning">This action cannot be undone.</p>
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTemplate} isLoading={isSaving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sync Result Modal */}
      <Modal
        isOpen={showSyncResultModal}
        onClose={() => setShowSyncResultModal(false)}
        title="OneDrive Sync Complete"
        size="sm"
      >
        <div className="sync-result">
          {syncResult && (
            <>
              <div className="sync-stats">
                <div className="sync-stat success">
                  <span className="stat-value">{syncResult.processed}</span>
                  <span className="stat-label">Processed</span>
                </div>
                <div className="sync-stat warning">
                  <span className="stat-value">{syncResult.pending}</span>
                  <span className="stat-label">Pending Review</span>
                </div>
                <div className="sync-stat danger">
                  <span className="stat-value">{syncResult.failed}</span>
                  <span className="stat-label">Failed</span>
                </div>
              </div>
              <p className="sync-message">{syncResult.message}</p>
              {syncResult.pending > 0 && (
                <p className="sync-note">
                  Documents pending review can be found in the customer-documents storage bucket under "pending-review".
                </p>
              )}
            </>
          )}
          <div className="form-actions">
            <Button onClick={() => setShowSyncResultModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
