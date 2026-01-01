import { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { Button, Modal } from '@/components/common';
import { CustomerForm } from '@/components/CustomerForm';
import { DetailsTab, ProposalTab, VsaTab, DocumentsTab } from './tabs';
import {
  User,
  FileText,
  Car,
  FolderOpen,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { ExcelPopulateModal } from '@/components/Excel';
import type { Customer } from '@/types';
import './CustomerDetails.css';

type TabId = 'details' | 'proposal' | 'vsa' | 'documents';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof User;
}

const TABS: Tab[] = [
  { id: 'details', label: 'Details', icon: User },
  { id: 'proposal', label: 'Proposal', icon: FileText },
  { id: 'vsa', label: 'VSA', icon: Car },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
];

interface CustomerDetailsProps {
  customer: Customer;
  onClose?: () => void;
}

export function CustomerDetails({ customer, onClose }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const {
    updateCustomer,
    deleteCustomer,
    archiveCustomer,
    unarchiveCustomer,
    isSaving,
  } = useCustomerStore();

  // Reset tab when customer changes
  useEffect(() => {
    setActiveTab('details');
  }, [customer.id]);

  const handleEdit = async (data: Record<string, unknown>) => {
    await updateCustomer(customer.id, data);
    setIsEditModalOpen(false);
  };

  const handleDelete = async () => {
    await deleteCustomer(customer.id);
    setIsDeleteModalOpen(false);
    onClose?.();
  };

  const handleArchive = async () => {
    await archiveCustomer(customer.id, 'lost');
  };

  const handleUnarchive = async () => {
    await unarchiveCustomer(customer.id);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return <DetailsTab customer={customer} onUpdate={updateCustomer} />;
      case 'proposal':
        return <ProposalTab customer={customer} onUpdate={updateCustomer} />;
      case 'vsa':
        return <VsaTab customer={customer} onUpdate={updateCustomer} />;
      case 'documents':
        return <DocumentsTab customer={customer} />;
      default:
        return null;
    }
  };

  return (
    <div className="customer-details">
      {/* Header */}
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
            <FileSpreadsheet size={16} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            title="Edit customer"
          >
            <Edit size={16} />
          </Button>

          {customer.archive_status ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnarchive}
              title="Unarchive customer"
            >
              <ArchiveRestore size={16} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              title="Archive customer"
            >
              <Archive size={16} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            title="Delete customer"
            className="danger"
          >
            <Trash2 size={16} />
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} title="Close">
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="customer-details-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="customer-details-content">{renderTabContent()}</div>

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
            Are you sure you want to delete <strong>{customer.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="delete-confirmation-actions">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isSaving}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Excel Populate Modal */}
      <ExcelPopulateModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        customer={customer}
        guarantors={customer.guarantors}
      />
    </div>
  );
}
