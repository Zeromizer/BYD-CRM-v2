import { useState, useEffect, lazy, Suspense, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  User,
  File,
  Car,
  FolderOpen,
  FileXls,
  FileDoc,
  PencilSimple,
  Export,
  Package,
  Trash,
  X,
} from '@phosphor-icons/react'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { Button, Modal } from '@/components/common'
import { CustomerForm } from '@/components/CustomerForm'
import { DetailsTab, ProposalTab, VsaTab, DocumentsTab } from './tabs'
import { MobileSummaryCard } from './MobileSummaryCard'
import { useDocumentStore } from '@/stores/useDocumentStore'
import type { Customer, DocumentTemplate } from '@/types'
import './CustomerDetails.css'

// Lazy load heavy components (jsPDF, xlsx-populate)
const ExcelPopulateModal = lazy(() =>
  import('@/components/Excel').then((m) => ({ default: m.ExcelPopulateModal }))
)
const PrintManager = lazy(() =>
  import('@/components/Documents/PrintManager').then((m) => ({ default: m.PrintManager }))
)

type TabId = 'details' | 'proposal' | 'vsa' | 'documents'

interface Tab {
  id: TabId
  label: string
  icon: ReactElement
}

const TABS: Tab[] = [
  { id: 'details', label: 'Details', icon: <User size={18} /> },
  { id: 'proposal', label: 'Proposal', icon: <File size={18} /> },
  { id: 'vsa', label: 'VSA', icon: <Car size={18} /> },
  { id: 'documents', label: 'Documents', icon: <FolderOpen size={18} /> },
]

interface CustomerDetailsProps {
  customer: Customer
  onClose?: () => void
  isMobile?: boolean
  onBack?: () => void
}

export function CustomerDetails({ customer, onClose, isMobile, onBack }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [showDocTemplateSelect, setShowDocTemplateSelect] = useState(false)
  const [selectedDocTemplate, setSelectedDocTemplate] = useState<DocumentTemplate | null>(null)
  const [showPrintManager, setShowPrintManager] = useState(false)

  const { updateCustomer, deleteCustomer, archiveCustomer, unarchiveCustomer, isSaving } =
    useCustomerStore()

  const { templates, fetchTemplates } = useDocumentStore()

  // Fetch templates on mount
  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  // Reset tab when customer changes
  useEffect(() => {
    setActiveTab('details')
  }, [customer.id])

  const handleEdit = async (data: Record<string, unknown>) => {
    await updateCustomer(customer.id, data)
    setIsEditModalOpen(false)
  }

  const handleDelete = async () => {
    await deleteCustomer(customer.id)
    setIsDeleteModalOpen(false)
    onClose?.()
  }

  const handleArchive = async () => {
    await archiveCustomer(customer.id, 'lost')
  }

  const handleUnarchive = async () => {
    await unarchiveCustomer(customer.id)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return <DetailsTab customer={customer} onUpdate={updateCustomer} />
      case 'proposal':
        return <ProposalTab customer={customer} onUpdate={updateCustomer} />
      case 'vsa':
        return <VsaTab customer={customer} onUpdate={updateCustomer} />
      case 'documents':
        return <DocumentsTab customer={customer} />
      default:
        return null
    }
  }

  return (
    <div className={`customer-details ${isMobile ? 'mobile' : ''}`}>
      {/* Mobile Summary Card */}
      {isMobile && (
        <MobileSummaryCard
          customer={customer}
          onBack={onBack}
          onMoreActions={() => setShowMobileActions(true)}
        />
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="customer-details-header">
          <div className="customer-details-info">
            <h2 className="customer-details-name">{customer.name}</h2>
            {customer.archive_status && (
              <span className={`archive-badge ${customer.archive_status}`}>
                {customer.archive_status === 'lost' ? 'Lost' : 'Completed'}
              </span>
            )}
          </div>

          <div className="customer-details-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExcelModalOpen(true)}
              title="Generate Excel"
            >
              <FileXls size={18} className="action-icon" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDocTemplateSelect(true)}
              title="Generate Document"
            >
              <FileDoc size={18} className="action-icon" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit customer"
            >
              <PencilSimple size={18} className="action-icon" />
            </Button>

            {customer.archive_status ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnarchive}
                title="Unarchive customer"
              >
                <Export size={18} className="action-icon" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleArchive} title="Archive customer">
                <Package size={18} className="action-icon" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              title="Delete customer"
              className="danger"
            >
              <Trash size={18} className="action-icon" />
            </Button>

            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} title="Close">
                <X size={18} className="action-icon" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="customer-details-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {isMobile ? null : tab.label}
            {isMobile && <span className="tab-label-mobile">{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="customer-details-content">{renderTabContent()}</div>

      {/* Mobile Action Sheet - rendered via portal to escape swipe container overflow */}
      {isMobile &&
        showMobileActions &&
        createPortal(
          <>
            <div className="mobile-action-overlay" onClick={() => setShowMobileActions(false)} />
            <div className="mobile-action-sheet">
              <div className="mobile-action-sheet-header">
                <span>Actions</span>
                <button
                  type="button"
                  className="mobile-action-close"
                  onClick={() => setShowMobileActions(false)}
                >
                  <X size={20} className="close-icon" />
                </button>
              </div>
              <button
                className="mobile-action-item"
                onClick={() => {
                  setShowMobileActions(false)
                  setIsExcelModalOpen(true)
                }}
              >
                <FileXls size={18} className="action-icon" />
                <span>Generate Excel</span>
              </button>
              <button
                className="mobile-action-item"
                onClick={() => {
                  setShowMobileActions(false)
                  setShowDocTemplateSelect(true)
                }}
              >
                <FileDoc size={18} className="action-icon" />
                <span>Generate Document</span>
              </button>
              <button
                className="mobile-action-item"
                onClick={() => {
                  setShowMobileActions(false)
                  setIsEditModalOpen(true)
                }}
              >
                <PencilSimple size={18} className="action-icon" />
                <span>Edit Customer</span>
              </button>
              {customer.archive_status ? (
                <button
                  className="mobile-action-item"
                  onClick={() => {
                    setShowMobileActions(false)
                    void handleUnarchive()
                  }}
                >
                  <Export size={18} className="action-icon" />
                  <span>Unarchive</span>
                </button>
              ) : (
                <button
                  className="mobile-action-item"
                  onClick={() => {
                    setShowMobileActions(false)
                    void handleArchive()
                  }}
                >
                  <Package size={18} className="action-icon" />
                  <span>Archive</span>
                </button>
              )}
              <button
                className="mobile-action-item danger"
                onClick={() => {
                  setShowMobileActions(false)
                  setIsDeleteModalOpen(true)
                }}
              >
                <Trash size={18} className="action-icon" />
                <span>Delete</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer"
        size="lg"
      >
        <CustomerForm
          initialData={customer as unknown as Record<string, unknown>}
          onSubmit={handleEdit}
          onCancel={() => setIsEditModalOpen(false)}
          isLoading={isSaving}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Customer"
        size="sm"
      >
        <div className="delete-confirmation">
          <p>
            Are you sure you want to delete <strong>{customer.name}</strong>? This action cannot be
            undone.
          </p>
          <div className="delete-confirmation-actions">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isSaving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Excel Populate Modal - Lazy loaded */}
      {isExcelModalOpen && (
        <Suspense fallback={<div className="modal-loading">Loading...</div>}>
          <ExcelPopulateModal
            isOpen={isExcelModalOpen}
            onClose={() => setIsExcelModalOpen(false)}
            customer={customer}
            guarantors={customer.guarantors}
          />
        </Suspense>
      )}

      {/* Document Template Selection Modal */}
      <Modal
        isOpen={showDocTemplateSelect}
        onClose={() => setShowDocTemplateSelect(false)}
        title="Select Document Template"
        size="lg"
      >
        <div className="template-select-modal">
          <p className="template-select-description">
            Select a template to generate a document for <strong>{customer.name}</strong>
          </p>

          {templates.length === 0 ? (
            <div className="no-templates">
              <File size={32} className="empty-icon" />
              <p>No document templates available</p>
              <p className="hint">Create templates in the Documents section first</p>
            </div>
          ) : (
            <div className="template-categories">
              {Object.entries(
                templates.reduce(
                  (acc, template) => {
                    const category = template.category || 'other'
                    if (!acc[category]) acc[category] = []
                    acc[category].push(template)
                    return acc
                  },
                  {} as Record<string, DocumentTemplate[]>
                )
              ).map(([category, categoryTemplates]) => {
                const categoryLabels: Record<string, string> = {
                  vsa: 'Vehicle Sales Agreement',
                  insurance: 'Insurance',
                  delivery: 'Delivery',
                  test_drive: 'Test Drive',
                  finance: 'Finance',
                  other: 'Other',
                }
                return (
                  <div key={category} className="template-category">
                    <h4 className="category-title">{categoryLabels[category] || category}</h4>
                    <div className="template-grid">
                      {categoryTemplates.map((template) => (
                        <button
                          key={template.id}
                          className="template-card"
                          onClick={() => {
                            setSelectedDocTemplate(template)
                            setShowDocTemplateSelect(false)
                            setShowPrintManager(true)
                          }}
                        >
                          {template.image_url ? (
                            <img
                              src={template.image_url}
                              alt={template.name}
                              className="template-thumbnail"
                            />
                          ) : (
                            <div className="template-placeholder">
                              <File size={24} className="placeholder-icon" />
                            </div>
                          )}
                          <span className="template-name">{template.name}</span>
                          <span className="template-fields">
                            {Object.keys(template.fields ?? {}).length} fields
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Print Manager - Lazy loaded */}
      {showPrintManager && selectedDocTemplate && (
        <Modal
          isOpen={showPrintManager}
          onClose={() => {
            setShowPrintManager(false)
            setSelectedDocTemplate(null)
          }}
          title=""
          size="full"
        >
          <Suspense fallback={<div className="modal-loading">Loading...</div>}>
            <PrintManager
              template={selectedDocTemplate}
              customer={customer}
              onClose={() => {
                setShowPrintManager(false)
                setSelectedDocTemplate(null)
              }}
            />
          </Suspense>
        </Modal>
      )}
    </div>
  )
}
