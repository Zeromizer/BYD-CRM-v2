import { useState, useEffect, useTransition } from 'react'
import { CustomerList } from '@/components/CustomerList'
import { CustomerDetails } from '@/components/CustomerDetails'
import { CustomerForm, type ScannedImages } from '@/components/CustomerForm'
import { ProgressSidebar } from '@/components/ProgressSidebar'
import { useSelectedCustomer, useCustomerStore } from '@/stores'
import { Modal } from '@/components/common'
import { useToast } from '@/components/common'
import { PanelIndicator } from '@/components/common/PanelIndicator'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { uploadCustomerDocument } from '@/services/customerDocumentService'
import './MobileDashboard.css'

/**
 * Convert base64 data URL to File object
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',')
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const mime = /:(.*?);/.exec(arr[0])?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

/**
 * Upload scanned ID images to customer's documents folder
 */
async function uploadScannedImages(customerName: string, images: ScannedImages): Promise<void> {
  const uploads: Promise<unknown>[] = []

  if (images.frontImage) {
    const file = dataUrlToFile(images.frontImage, 'nric_front.jpg')
    uploads.push(uploadCustomerDocument('nric_front', file, customerName))
  }

  if (images.backImage) {
    const file = dataUrlToFile(images.backImage, 'nric_back.jpg')
    uploads.push(uploadCustomerDocument('nric_back', file, customerName))
  }

  if (images.licenseFrontImage) {
    const file = dataUrlToFile(images.licenseFrontImage, 'driving_license_front.jpg')
    uploads.push(uploadCustomerDocument('driving_license_front', file, customerName))
  }

  if (images.licenseBackImage) {
    const file = dataUrlToFile(images.licenseBackImage, 'driving_license_back.jpg')
    uploads.push(uploadCustomerDocument('driving_license_back', file, customerName))
  }

  await Promise.all(uploads)
}

const PANELS = [
  { id: 'customers', label: 'Customers' },
  { id: 'details', label: 'Details' },
  { id: 'progress', label: 'Progress' },
]

export function MobileDashboard() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const selectedCustomer = useSelectedCustomer()
  const { createCustomer, selectCustomer, customers } = useCustomerStore()
  const { success, error, warning } = useToast()

  const { activePanel, setActivePanel, containerRef, getTransformStyle, showIndicator } =
    useSwipeNavigation({
      panelCount: selectedCustomer ? 3 : 1, // Only allow swiping to other panels when customer selected
    })

  // Auto-navigate to details when customer is selected
  useEffect(() => {
    if (selectedCustomer && activePanel === 0) {
      setActivePanel(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id])

  // Reset to customers panel when customer is deselected
  useEffect(() => {
    if (!selectedCustomer && activePanel !== 0) {
      setActivePanel(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer])

  const handleAddCustomer = (data: Record<string, unknown>, scannedImages?: ScannedImages) => {
    // Prevent double submission
    if (isPending) return

    // Check for duplicate NRIC
    const nric = data.nric as string | undefined
    if (nric) {
      const existingCustomer = customers.find((c) => c.nric?.toLowerCase() === nric.toLowerCase())
      if (existingCustomer) {
        warning(`A customer with NRIC "${nric}" already exists: ${existingCustomer.name}`)
        return
      }
    }

    // Use startTransition for non-blocking async operation
    startTransition(async () => {
      try {
        const customer = await createCustomer(data)
        selectCustomer(customer.id)
        setShowAddModal(false)
        success('Customer created successfully')

        // Upload scanned images in background after customer is created
        if (scannedImages && customer.name) {
          uploadScannedImages(customer.name, scannedImages)
            .then(() => console.log('Scanned ID images uploaded successfully'))
            .catch((err) => console.error('Failed to upload scanned images:', err))
        }
      } catch (_err) {
        error('Failed to create customer')
      }
    })
  }

  const handleBackToList = () => {
    setActivePanel(0)
  }

  // Determine which panels to show based on customer selection
  const panelsToShow = selectedCustomer ? PANELS : [PANELS[0]]
  const panelCount = selectedCustomer ? 3 : 1

  return (
    <div className="mobile-dashboard">
      <div
        className={`mobile-panels-container panels-${panelCount}`}
        ref={containerRef}
        style={getTransformStyle()}
      >
        {/* Panel 0: Customer List */}
        <div className="mobile-panel">
          <CustomerList onAddCustomer={() => setShowAddModal(true)} isMobile />
        </div>

        {/* Panel 1: Customer Details - Always render for smooth transitions */}
        <div
          className="mobile-panel"
          style={{ visibility: selectedCustomer ? 'visible' : 'hidden' }}
        >
          {selectedCustomer && (
            <CustomerDetails customer={selectedCustomer} isMobile onBack={handleBackToList} />
          )}
        </div>

        {/* Panel 2: Progress Sidebar - Always render for smooth transitions */}
        <div
          className="mobile-panel"
          style={{ visibility: selectedCustomer ? 'visible' : 'hidden' }}
        >
          {selectedCustomer && <ProgressSidebar customer={selectedCustomer} isMobile />}
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
          isLoading={isPending}
        />
      </Modal>
    </div>
  )
}

export default MobileDashboard
