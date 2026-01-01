import { useState } from 'react';
import { CustomerList } from '@/components/CustomerList';
import { CustomerDetails } from '@/components/CustomerDetails';
import { CustomerForm } from '@/components/CustomerForm';
import { ProgressSidebar } from '@/components/ProgressSidebar';
import { useSelectedCustomer, useCustomerStore } from '@/stores';
import { Modal } from '@/components/common';
import { useToast } from '@/components/common';
import './Dashboard.css';

export function Dashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const selectedCustomer = useSelectedCustomer();
  const { createCustomer, selectCustomer } = useCustomerStore();
  const { success, error } = useToast();

  const handleAddCustomer = async (data: Record<string, unknown>) => {
    try {
      const customer = await createCustomer(data);
      selectCustomer(customer.id);
      setShowAddModal(false);
      success('Customer created successfully');
    } catch (err) {
      error('Failed to create customer');
    }
  };

  return (
    <div className={`dashboard ${selectedCustomer ? 'has-customer' : ''}`}>
      <div className="dashboard-sidebar">
        <CustomerList onAddCustomer={() => setShowAddModal(true)} />
      </div>

      <div className="dashboard-main">
        {selectedCustomer ? (
          <CustomerDetails customer={selectedCustomer} />
        ) : (
          <div className="no-selection">
            <div className="no-selection-content">
              <h3>No Customer Selected</h3>
              <p>Select a customer from the list or add a new one to get started.</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Sidebar - only shown when customer selected */}
      {selectedCustomer && (
        <ProgressSidebar customer={selectedCustomer} />
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Customer"
        size="lg"
      >
        <CustomerForm
          onSubmit={handleAddCustomer}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
    </div>
  );
}
