import { useState } from 'react';
import { CustomerList } from '@/components/CustomerList';
import { CustomerDetails } from '@/components/CustomerDetails';
import { CustomerForm, type ScannedImages } from '@/components/CustomerForm';
import { ProgressSidebar } from '@/components/ProgressSidebar';
import { useSelectedCustomer, useCustomerStore } from '@/stores';
import { Modal } from '@/components/common';
import { useToast } from '@/components/common';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { uploadCustomerDocument } from '@/services/customerDocumentService';
import { MobileDashboard } from './MobileDashboard';
import './Dashboard.css';

/**
 * Convert base64 data URL to File object
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Upload scanned ID images to customer's documents folder
 */
async function uploadScannedImages(customerName: string, images: ScannedImages): Promise<void> {
  const uploads: Promise<unknown>[] = [];

  if (images.frontImage) {
    const file = dataUrlToFile(images.frontImage, 'nric_front.jpg');
    uploads.push(uploadCustomerDocument('nric_front', file, customerName));
  }

  if (images.backImage) {
    const file = dataUrlToFile(images.backImage, 'nric_back.jpg');
    uploads.push(uploadCustomerDocument('nric_back', file, customerName));
  }

  if (images.licenseFrontImage) {
    const file = dataUrlToFile(images.licenseFrontImage, 'driving_license_front.jpg');
    uploads.push(uploadCustomerDocument('driving_license_front', file, customerName));
  }

  if (images.licenseBackImage) {
    const file = dataUrlToFile(images.licenseBackImage, 'driving_license_back.jpg');
    uploads.push(uploadCustomerDocument('driving_license_back', file, customerName));
  }

  await Promise.all(uploads);
}

export function Dashboard() {
  const isMobile = useIsMobile();

  // Render mobile dashboard on small screens
  if (isMobile) {
    return <MobileDashboard />;
  }

  return <DesktopDashboard />;
}

function DesktopDashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCustomer = useSelectedCustomer();
  const { createCustomer, selectCustomer, customers } = useCustomerStore();
  const { success, error, warning } = useToast();

  const handleAddCustomer = async (data: Record<string, unknown>, scannedImages?: ScannedImages) => {
    // Prevent double submission
    if (isSubmitting) return;

    // Check for duplicate NRIC
    const nric = data.nric as string | undefined;
    if (nric) {
      const existingCustomer = customers.find(c => c.nric?.toLowerCase() === nric.toLowerCase());
      if (existingCustomer) {
        warning(`A customer with NRIC "${nric}" already exists: ${existingCustomer.name}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const customer = await createCustomer(data);
      selectCustomer(customer.id);
      setShowAddModal(false);
      success('Customer created successfully');

      // Upload scanned images in background after customer is created
      if (scannedImages && customer.name) {
        uploadScannedImages(customer.name, scannedImages)
          .then(() => console.log('Scanned ID images uploaded successfully'))
          .catch((err) => console.error('Failed to upload scanned images:', err));
      }
    } catch (err) {
      error('Failed to create customer');
    } finally {
      setIsSubmitting(false);
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
          isLoading={isSubmitting}
        />
      </Modal>
    </div>
  );
}
