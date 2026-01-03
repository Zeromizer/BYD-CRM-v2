import { useState, useEffect } from 'react';
import { CustomerList } from '@/components/CustomerList';
import { CustomerDetails } from '@/components/CustomerDetails';
import { CustomerForm } from '@/components/CustomerForm';
import { ProgressSidebar } from '@/components/ProgressSidebar';
import { useSelectedCustomer, useCustomerStore } from '@/stores';
import { Modal } from '@/components/common';
import { useToast } from '@/components/common';
import { PanelIndicator } from '@/components/common/PanelIndicator';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import './MobileDashboard.css';

const PANELS = [
  { id: 'customers', label: 'Customers' },
  { id: 'details', label: 'Details' },
  { id: 'progress', label: 'Progress' },
];

export function MobileDashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const selectedCustomer = useSelectedCustomer();
  const { createCustomer, selectCustomer } = useCustomerStore();
  const { success, error } = useToast();

  const {
    activePanel,
    setActivePanel,
    containerRef,
    getTransformStyle,
    showIndicator,
  } = useSwipeNavigation({
    panelCount: selectedCustomer ? 3 : 1, // Only allow swiping to other panels when customer selected
  });

  // Auto-navigate to details when customer is selected
  useEffect(() => {
    if (selectedCustomer && activePanel === 0) {
      setActivePanel(1);
    }
  }, [selectedCustomer?.id]);

  // Reset to customers panel when customer is deselected
  useEffect(() => {
    if (!selectedCustomer && activePanel !== 0) {
      setActivePanel(0);
    }
  }, [selectedCustomer]);

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

  const handleBackToList = () => {
    setActivePanel(0);
  };

  // Determine which panels to show based on customer selection
  const panelsToShow = selectedCustomer ? PANELS : [PANELS[0]];
  const panelCount = selectedCustomer ? 3 : 1;

  return (
    <div className="mobile-dashboard">
      <div
        className={`mobile-panels-container panels-${panelCount}`}
        ref={containerRef}
        style={getTransformStyle()}
      >
        {/* Panel 0: Customer List */}
        <div className="mobile-panel">
          <CustomerList
            onAddCustomer={() => setShowAddModal(true)}
            isMobile
          />
        </div>

        {/* Panel 1: Customer Details - Always render for smooth transitions */}
        <div className="mobile-panel" style={{ visibility: selectedCustomer ? 'visible' : 'hidden' }}>
          {selectedCustomer && (
            <CustomerDetails
              customer={selectedCustomer}
              isMobile
              onBack={handleBackToList}
            />
          )}
        </div>

        {/* Panel 2: Progress Sidebar - Always render for smooth transitions */}
        <div className="mobile-panel" style={{ visibility: selectedCustomer ? 'visible' : 'hidden' }}>
          {selectedCustomer && (
            <ProgressSidebar
              customer={selectedCustomer}
              isMobile
            />
          )}
        </div>
      </div>

      {/* Panel Navigation Indicator - shows on swipe, fades away */}
      <PanelIndicator
        panels={panelsToShow}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        visible={showIndicator}
      />

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

export default MobileDashboard;
