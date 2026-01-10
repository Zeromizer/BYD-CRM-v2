import { useState, useEffect, useMemo, useRef } from 'react'
import {
  UploadSimple,
  DownloadSimple,
  Plus,
  MagnifyingGlass,
  Package,
  File,
  X,
} from '@phosphor-icons/react'
import {
  useCustomerStore,
  useCustomers,
  useSelectedCustomerId,
  useHasMoreCustomers,
  useIsLoadingMoreCustomers,
} from '@/stores'
import { MILESTONES, getOverallProgress } from '@/constants'
import { Modal, Button, useToast } from '@/components/common'
import {
  importCustomersFromFile,
  exportCustomersToJSON,
  downloadJSON,
} from '@/services/customerImportService'
import type { Customer, MilestoneId, Guarantor } from '@/types'
import './CustomerList.css'

interface CustomerListProps {
  onAddCustomer: () => void
  isMobile?: boolean
}

type FilterTab = 'active' | 'archived'
type SortOption = 'recent' | 'name' | 'milestone'

export function CustomerList({ onAddCustomer, isMobile }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('active')
  const [sortBy] = useState<SortOption>('recent')
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneId | 'all'>('all')

  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const customers = useCustomers()
  const selectedCustomerId = useSelectedCustomerId()
  const hasMore = useHasMoreCustomers()
  const isLoadingMore = useIsLoadingMoreCustomers()
  const {
    selectCustomer,
    fetchCustomers,
    fetchMoreCustomers,
    subscribeToChanges,
    createCustomer,
    saveGuarantors,
  } = useCustomerStore()
  const { success, error: toastError } = useToast()

  // Ref for infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchCustomers()
    const unsubscribe = subscribeToChanges()
    return unsubscribe
  }, [fetchCustomers, subscribeToChanges])

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          void fetchMoreCustomers()
        }
      },
      { rootMargin: '100px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, fetchMoreCustomers])

  const filteredCustomers = useMemo(() => {
    let result = customers

    // Filter by archive status
    if (filterTab === 'active') {
      result = result.filter((c) => !c.archive_status)
    } else {
      result = result.filter((c) => c.archive_status)
    }

    // Filter by milestone
    if (milestoneFilter !== 'all') {
      result = result.filter((c) => c.current_milestone === milestoneFilter)
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.vsa_no?.toLowerCase().includes(query)
      )
      /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'milestone':
        result = [...result].sort((a, b) => {
          const milestoneOrder = MILESTONES.map((m) => m.id)
          return (
            milestoneOrder.indexOf(a.current_milestone) -
            milestoneOrder.indexOf(b.current_milestone)
          )
        })
        break
      case 'recent':
      default:
        result = [...result].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }

    return result
  }, [customers, filterTab, milestoneFilter, searchQuery, sortBy])

  // Handle import file selection
  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json')) {
        toastError('Please select a JSON file')
        return
      }
      setImportFile(file)
    }
  }

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      toastError('Please select a file to import')
      return
    }

    setIsImporting(true)
    setImportProgress('Reading file...')

    try {
      const result = await importCustomersFromFile(importFile)

      if (!result.success) {
        toastError(result.errors.join(', '))
        setIsImporting(false)
        return
      }

      // Import each customer
      let imported = 0
      let failed = 0
      for (const { customer, guarantors } of result.customers) {
        setImportProgress(
          `Importing "${customer.name}" (${imported + failed + 1}/${result.customers.length})...`
        )

        try {
          // Create the customer
          const newCustomer = await createCustomer(customer)

          // Save guarantors if any
          if (guarantors.length > 0) {
            const guarantorsWithCustomerId = guarantors.map((g) => ({
              ...g,
              customer_id: newCustomer.id,
            }))
            await saveGuarantors(newCustomer.id, guarantorsWithCustomerId)
          }

          imported++

          // Small delay to avoid overwhelming the database
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (err) {
          console.error(`Failed to import "${customer.name}":`, err)
          failed++
        }
      }

      if (failed > 0) {
        success(`Imported ${imported} customer${imported !== 1 ? 's' : ''} (${failed} failed)`)
      } else {
        success(`Imported ${imported} customer${imported !== 1 ? 's' : ''} successfully`)
      }
      setShowImportModal(false)
      setImportFile(null)
      if (importFileInputRef.current) {
        importFileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error during import:', err)
      toastError('Failed to import customers')
    } finally {
      setIsImporting(false)
      setImportProgress('')
    }
  }

  // Handle export
  const handleExport = () => {
    try {
      // For now, export without guarantors (would need to fetch them)
      const guarantorsMap: Record<number, Guarantor[]> = {}
      const json = exportCustomersToJSON(customers, guarantorsMap)
      const filename = `byd-crm-customers-${new Date().toISOString().split('T')[0]}.json`
      downloadJSON(json, filename)
      success(`Exported ${customers.length} customers`)
    } catch (err) {
      console.error('Error exporting customers:', err)
      toastError('Failed to export customers')
    }
  }

  // Reset import modal
  const resetImportModal = () => {
    setImportFile(null)
    setImportProgress('')
    if (importFileInputRef.current) {
      importFileInputRef.current.value = ''
    }
  }

  return (
    <div className={`customer-list ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <div className="list-header">
        <h2 className="list-title">Customers</h2>
        <div className="list-header-actions">
          {isMobile ? (
            /* Mobile: Show filter tabs in header */
            <div className="mobile-filter-tabs">
              <button
                onClick={() => setFilterTab('active')}
                className={`mobile-filter-tab ${filterTab === 'active' ? 'active' : ''}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterTab('archived')}
                className={`mobile-filter-tab ${filterTab === 'archived' ? 'active' : ''}`}
              >
                <Package size={14} />
                Archived
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="import-export-btn"
                title="Import from Old CRM"
              >
                <UploadSimple size={18} />
              </button>
              <button onClick={handleExport} className="import-export-btn" title="Export Customers">
                <DownloadSimple size={18} />
              </button>
              <button onClick={onAddCustomer} className="add-customer-btn">
                <Plus size={16} />
                <span>Add</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <MagnifyingGlass size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {isMobile && (
          <button className="mobile-add-btn" onClick={onAddCustomer} aria-label="Add Customer">
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Tabs - Desktop only */}
      {!isMobile && (
        <div className="filter-tabs">
          <button
            onClick={() => setFilterTab('active')}
            className={`filter-tab ${filterTab === 'active' ? 'active' : ''}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterTab('archived')}
            className={`filter-tab ${filterTab === 'archived' ? 'active' : ''}`}
          >
            <Package size={16} />
            Archived
          </button>
        </div>
      )}

      {/* Milestone Filter */}
      <div className="milestone-filters">
        <button
          onClick={() => setMilestoneFilter('all')}
          className={`milestone-chip ${milestoneFilter === 'all' ? 'active' : ''}`}
        >
          All
        </button>
        {MILESTONES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMilestoneFilter(m.id)}
            className={`milestone-chip ${milestoneFilter === m.id ? 'active' : ''}`}
            style={
              {
                '--milestone-color': m.color,
              } as React.CSSProperties
            }
          >
            {m.shortName}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="list-content">
        {filteredCustomers.length === 0 ? (
          <div className="list-empty">
            <p>No customers found</p>
          </div>
        ) : (
          <>
            {filteredCustomers.map((customer, index) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                isSelected={customer.id === selectedCustomerId}
                onSelect={() => selectCustomer(customer.id)}
                index={index}
              />
            ))}
            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="load-more-sentinel">
              {isLoadingMore && (
                <div className="loading-more">
                  <div className="loading-spinner-small" />
                  <span>Loading more...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false)
          resetImportModal()
        }}
        title="Import Customers from Old CRM"
      >
        <div className="import-modal">
          <div className="import-description">
            <p>
              Import customer data exported from your old BYD-CRM. Select the JSON file containing
              your customer data.
            </p>
          </div>

          {/* File Upload */}
          <div className="import-form-group">
            <label>Select Export File</label>
            <div className="import-file-upload-area">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFileSelect}
                style={{ display: 'none' }}
                disabled={isImporting}
              />
              {!importFile ? (
                <div
                  className="import-upload-placeholder"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  <File size={24} />
                  <span>Click to select file</span>
                  <small>.json from old CRM export</small>
                </div>
              ) : (
                <div className="import-file-selected">
                  <File size={18} color="#10b981" />
                  <span>{importFile.name}</span>
                  {!isImporting && (
                    <button
                      className="import-remove-file"
                      onClick={() => {
                        setImportFile(null)
                        if (importFileInputRef.current) importFileInputRef.current.value = ''
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          {isImporting && importProgress && (
            <div className="import-progress">
              <div className="loading-spinner" />
              <span>{importProgress}</span>
            </div>
          )}

          {/* Actions */}
          <div className="import-form-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false)
                resetImportModal()
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? 'Importing...' : 'Import Customers'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

interface CustomerCardProps {
  customer: Customer
  isSelected: boolean
  onSelect: () => void
  index: number
}

function CustomerCard({ customer, isSelected, onSelect, index }: CustomerCardProps) {
  const milestone = MILESTONES.find((m) => m.id === customer.current_milestone)
  const progress = getOverallProgress(customer.checklist)

  return (
    <div
      className={`customer-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{ '--stagger-delay': `${Math.min(index, 12) * 80}ms` } as React.CSSProperties}
    >
      <div className="card-header">
        <div className="customer-avatar">{customer.name[0]?.toUpperCase()}</div>
        <div className="customer-info">
          <h3 className="customer-name">{customer.name}</h3>
          {customer.vsa_no && <span className="customer-vsa">VSA: {customer.vsa_no}</span>}
        </div>
      </div>

      <div className="card-footer">
        {milestone && (
          <span
            className="milestone-badge"
            style={{ backgroundColor: `${milestone.color}20`, color: milestone.color }}
          >
            {milestone.shortName}
          </span>
        )}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              backgroundColor: milestone?.color || '#64748b',
            }}
          />
        </div>
        <span className="progress-text">{progress}%</span>
      </div>
    </div>
  )
}
