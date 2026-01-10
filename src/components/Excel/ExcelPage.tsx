/**
 * ExcelPage Component
 * Main page for managing Excel templates with field mappings
 */

import { useState, useEffect, useRef } from 'react'
import {
  DownloadSimple,
  Plus,
  MagnifyingGlass,
  FileXls,
  DotsThreeVertical,
  Gear,
  UploadSimple,
  Trash,
  X,
} from '@phosphor-icons/react'
import { Button, Modal } from '@/components/common'
import { useToast } from '@/components/common'
import { useExcelStore } from '@/stores/useExcelStore'
import { parseExcelFile } from '@/services/excelService'
import { importTemplatesFromFile } from '@/services/templateImportService'
import { getFieldTypesByCategory, getFieldLabel, CATEGORY_ORDER } from '@/constants/excelFields'
import type { ExcelTemplate, ExcelFieldMappings } from '@/types'
import './ExcelPage.css'

export function ExcelPage() {
  const {
    templates,
    isLoading,
    isSaving,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    uploadExcelFile,
    downloadExcelFile,
    subscribeToChanges,
    clearError,
  } = useExcelStore()

  const { success, error: toastError } = useToast()

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ExcelTemplate | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  // Create template form state
  const [newTemplateName, setNewTemplateName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Field mapping state
  const [tempMappings, setTempMappings] = useState<ExcelFieldMappings>({})
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [selectedFieldType, setSelectedFieldType] = useState('name')
  const [cellRef, setCellRef] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [fieldSearch, setFieldSearch] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)

  // Upload master file state
  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const masterFileInputRef = useRef<HTMLInputElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchTemplates()
    const unsubscribe = subscribeToChanges()
    return () => unsubscribe()
  }, [fetchTemplates, subscribeToChanges])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Close if clicking outside any template-actions container
      if (!target.closest('.template-actions')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter templates
  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get field types grouped by category
  const fieldTypesByCategory = getFieldTypesByCategory()

  // Filter fields by search
  const getFilteredFields = () => {
    if (!fieldSearch) return fieldTypesByCategory

    const filtered: Record<string, { key: string; label: string }[]> = {}
    const searchLower = fieldSearch.toLowerCase()

    for (const [category, fields] of Object.entries(fieldTypesByCategory)) {
      const matchingFields = fields.filter(
        (f) =>
          f.label.toLowerCase().includes(searchLower) || f.key.toLowerCase().includes(searchLower)
      )
      if (matchingFields.length > 0) {
        filtered[category] = matchingFields
      }
    }

    return filtered
  }

  // Count total mappings for a template
  const getMappingCount = (template: ExcelTemplate): number => {
    let count = 0
    for (const sheetMappings of Object.values(template.field_mappings ?? {})) {
      count += Object.keys(sheetMappings).length
    }
    return count
  }

  // Handle file selection for new template
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // Handle master file selection
  const handleMasterFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMasterFile(file)
    }
  }

  // Create new template
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toastError('Please enter a template name')
      return
    }

    setIsCreating(true)
    try {
      let filePath: string | null = null
      let sheetNames: string[] = []

      if (selectedFile) {
        const result = await uploadExcelFile(selectedFile)
        filePath = result.path
        sheetNames = result.sheetNames
      }

      await createTemplate({
        name: newTemplateName.trim(),
        file_path: filePath,
        sheet_names: sheetNames,
        field_mappings: {},
      })

      success('Template created successfully')
      setShowCreateModal(false)
      resetCreateForm()
    } catch (err) {
      console.error('Error creating template:', err)
      toastError('Failed to create template')
    } finally {
      setIsCreating(false)
    }
  }

  const resetCreateForm = () => {
    setNewTemplateName('')
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    try {
      await deleteTemplate(selectedTemplate.id)
      success('Template deleted successfully')
      setShowDeleteModal(false)
      setSelectedTemplate(null)
    } catch (err) {
      console.error('Error deleting template:', err)
      toastError('Failed to delete template')
    }
  }

  // Open mapping modal
  const openMappingModal = async (template: ExcelTemplate) => {
    setSelectedTemplate(template)
    setTempMappings(template.field_mappings ?? {})
    setAvailableSheets(template.sheet_names ?? [])
    setSelectedSheet(template.sheet_names?.[0] ?? '')
    setCellRef('')
    setCustomValue('')
    setSelectedFieldType('name')
    setFieldSearch('')
    setShowMappingModal(true)

    // If template has a file but no sheets, try to parse it
    if (template.file_path && (!template.sheet_names || template.sheet_names.length === 0)) {
      setLoadingSheets(true)
      try {
        const blob = await downloadExcelFile(template.file_path)
        const sheets = await parseExcelFile(blob)
        setAvailableSheets(sheets)
        setSelectedSheet(sheets[0] ?? '')
        // Update template with sheet names
        await updateTemplate(template.id, { sheet_names: sheets })
      } catch (err) {
        console.error('Error parsing Excel file:', err)
      } finally {
        setLoadingSheets(false)
      }
    }
  }

  // Add field mapping
  const handleAddMapping = () => {
    if (!selectedSheet) {
      toastError('Please select a sheet')
      return
    }
    if (!cellRef.trim()) {
      toastError('Please enter a cell reference (e.g., A1)')
      return
    }

    // Validate cell reference format
    const cellRefUpper = cellRef.trim().toUpperCase()
    if (!/^[A-Z]+[0-9]+$/.test(cellRefUpper)) {
      toastError('Invalid cell reference format. Use format like A1, B2, etc.')
      return
    }

    // Check for custom value
    let fieldValue = selectedFieldType
    if (selectedFieldType === '_custom') {
      if (!customValue.trim()) {
        toastError('Please enter a custom value')
        return
      }
      fieldValue = `_custom:${customValue.trim()}`
    }

    // Add to temp mappings
    setTempMappings((prev) => ({
      ...prev,
      [selectedSheet]: {
        ...prev[selectedSheet],
        [cellRefUpper]: fieldValue,
      },
    }))

    // Reset inputs
    setCellRef('')
    setCustomValue('')
  }

  // Remove field mapping
  const handleRemoveMapping = (sheetName: string, cell: string) => {
    setTempMappings((prev) => {
      const updated = { ...prev }
      if (updated[sheetName]) {
        const { [cell]: _, ...rest } = updated[sheetName]
        if (Object.keys(rest).length === 0) {
          delete updated[sheetName]
        } else {
          updated[sheetName] = rest
        }
      }
      return updated
    })
  }

  // Save field mappings
  const handleSaveMappings = async () => {
    if (!selectedTemplate) return

    try {
      await updateTemplate(selectedTemplate.id, { field_mappings: tempMappings })
      success('Mappings saved successfully')
      setShowMappingModal(false)
    } catch (err) {
      console.error('Error saving mappings:', err)
      toastError('Failed to save mappings')
    }
  }

  // Open upload master modal
  const openUploadModal = (template: ExcelTemplate) => {
    setSelectedTemplate(template)
    setMasterFile(null)
    if (masterFileInputRef.current) {
      masterFileInputRef.current.value = ''
    }
    setShowUploadModal(true)
  }

  // Upload/replace master file
  const handleUploadMaster = async () => {
    if (!selectedTemplate || !masterFile) return

    setIsUploading(true)
    try {
      const result = await uploadExcelFile(masterFile)
      await updateTemplate(selectedTemplate.id, {
        file_path: result.path,
        sheet_names: result.sheetNames,
      })
      success('Master file uploaded successfully')
      setShowUploadModal(false)
    } catch (err) {
      console.error('Error uploading master file:', err)
      toastError('Failed to upload master file')
    } finally {
      setIsUploading(false)
    }
  }

  // Get display value for a field mapping
  const getFieldDisplayValue = (fieldValue: string): string => {
    if (fieldValue.startsWith('_custom:')) {
      return `Custom: "${fieldValue.substring(8)}"`
    }
    return getFieldLabel(fieldValue)
  }

  // Handle import file selection
  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json') && !file.name.endsWith('.zip')) {
        toastError('Please select a JSON or ZIP file')
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
      const result = await importTemplatesFromFile(importFile)

      if (!result.success) {
        toastError(result.errors.join(', '))
        setIsImporting(false)
        return
      }

      // Import each template
      let imported = 0
      for (const template of result.templates) {
        setImportProgress(
          `Importing "${template.name}" (${imported + 1}/${result.templates.length})...`
        )

        try {
          let filePath: string | null = null
          const sheetNames = template.sheet_names

          // Upload master file if available (skip parsing since we already have sheet names from mappings)
          if (template.masterFileBlob && template.masterFileName) {
            setImportProgress(`Uploading master file for "${template.name}"...`)
            const file = new File([template.masterFileBlob], template.masterFileName, {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const uploadResult = await uploadExcelFile(file, true) // skipParsing = true
            filePath = uploadResult.path
            // Keep sheet names from the converted template (derived from field mappings)
          }

          // Create template
          await createTemplate({
            name: template.name,
            file_path: filePath,
            sheet_names: sheetNames,
            field_mappings: template.field_mappings,
          })

          imported++
        } catch (err) {
          console.error(`Error importing template "${template.name}":`, err)
          result.errors.push(`Failed to import "${template.name}"`)
        }
      }

      success(`Imported ${imported} template${imported !== 1 ? 's' : ''} successfully`)
      setShowImportModal(false)
      setImportFile(null)
      if (importFileInputRef.current) {
        importFileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error during import:', err)
      toastError('Failed to import templates')
    } finally {
      setIsImporting(false)
      setImportProgress('')
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
    <div className="excel-page">
      {/* Header */}
      <div className="ep-header">
        <h2>Excel Templates</h2>
        <div className="ep-header-actions">
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <DownloadSimple size={16} className="btn-icon" />
            Import
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="btn-icon" />
            New Template
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="ep-error">
          <span>{error}</span>
          <button onClick={clearError}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="ep-filters">
        <div className="ep-search">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="ep-loading">
          <div className="loading-spinner" />
          <span>Loading templates...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTemplates.length === 0 && (
        <div className="ep-empty">
          <FileXls size={48} className="empty-icon" />
          <h3>No Excel Templates</h3>
          <p>Create your first Excel template to start mapping customer data to cells.</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="btn-icon" />
            Create Template
          </Button>
        </div>
      )}

      {/* Template Grid */}
      {!isLoading && filteredTemplates.length > 0 && (
        <div className="ep-grid">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="excel-card"
              onClick={() => openMappingModal(template)}
              style={{ cursor: 'pointer' }}
            >
              <div className="excel-card-icon">
                <FileXls size={32} className="card-icon" />
              </div>
              <div className="excel-card-info">
                <div className="excel-card-header">
                  <h4 className="excel-card-name">{template.name}</h4>
                  <div className="template-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="action-trigger"
                      onClick={() =>
                        setOpenDropdownId(openDropdownId === template.id ? null : template.id)
                      }
                      title="More options"
                    >
                      <DotsThreeVertical size={18} />
                    </button>
                    {openDropdownId === template.id && (
                      <div className="action-dropdown">
                        <button onClick={() => openMappingModal(template)}>
                          <Gear size={14} className="menu-icon" />
                          Edit Mappings
                        </button>
                        <button onClick={() => openUploadModal(template)}>
                          <UploadSimple size={14} className="menu-icon" />
                          {template.file_path ? 'Replace File' : 'Upload File'}
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setSelectedTemplate(template)
                            setShowDeleteModal(true)
                            setOpenDropdownId(null)
                          }}
                        >
                          <Trash size={14} className="menu-icon" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="excel-card-meta">
                  <span className="mapping-count">
                    {getMappingCount(template)} field{getMappingCount(template) !== 1 ? 's' : ''}{' '}
                    mapped
                  </span>
                  {template.file_path && <span className="has-file">Master file attached</span>}
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
          setShowCreateModal(false)
          resetCreateForm()
        }}
        title="Create Excel Template"
      >
        <div className="create-template-form">
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              placeholder="Enter template name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Master Excel File (Optional)</label>
            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {!selectedFile ? (
                <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                  <UploadSimple size={24} className="upload-icon" />
                  <span>Click to upload Excel file</span>
                  <small>.xlsx or .xls</small>
                </div>
              ) : (
                <div className="file-selected">
                  <FileXls size={18} className="file-icon" />
                  <span>{selectedFile.name}</span>
                  <button
                    className="remove-file"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <X size={14} className="remove-icon" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                resetCreateForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isCreating || isSaving}>
              {isCreating ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Template"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete "{selectedTemplate?.name}"?</p>
          <p className="warning">This action cannot be undone.</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTemplate} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Master File Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={selectedTemplate?.file_path ? 'Replace Master File' : 'Upload Master File'}
      >
        <div className="create-template-form">
          <div className="form-group">
            <label>Excel File</label>
            <div className="file-upload-area">
              <input
                ref={masterFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleMasterFileSelect}
                style={{ display: 'none' }}
              />
              {!masterFile ? (
                <div
                  className="upload-placeholder"
                  onClick={() => masterFileInputRef.current?.click()}
                >
                  <UploadSimple size={24} className="upload-icon" />
                  <span>Click to upload Excel file</span>
                  <small>.xlsx or .xls</small>
                </div>
              ) : (
                <div className="file-selected">
                  <FileXls size={18} className="file-icon" />
                  <span>{masterFile.name}</span>
                  <button
                    className="remove-file"
                    onClick={() => {
                      setMasterFile(null)
                      if (masterFileInputRef.current) masterFileInputRef.current.value = ''
                    }}
                  >
                    <X size={14} className="remove-icon" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadMaster} disabled={!masterFile || isUploading}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Field Mapping Modal */}
      <Modal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        title={`Edit Mappings: ${selectedTemplate?.name ?? ''}`}
        size="lg"
      >
        <div className="mapping-modal">
          {/* Add Mapping Section */}
          <div className="mapping-add-section">
            <h4>Add Field Mapping</h4>

            {loadingSheets ? (
              <div className="loading-sheets">Loading sheets...</div>
            ) : availableSheets.length === 0 ? (
              <div className="no-sheets-warning">
                <p>No sheets available. Please upload a master Excel file first.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowMappingModal(false)
                    if (selectedTemplate) openUploadModal(selectedTemplate)
                  }}
                >
                  <UploadSimple size={16} className="btn-icon" />
                  Upload File
                </Button>
              </div>
            ) : (
              <>
                <div className="mapping-inputs">
                  <div className="mapping-input-group">
                    <label>Sheet</label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                    >
                      {availableSheets.map((sheet) => (
                        <option key={sheet} value={sheet}>
                          {sheet}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mapping-input-group">
                    <label>Cell Reference</label>
                    <input
                      type="text"
                      placeholder="e.g., A1, B5"
                      value={cellRef}
                      onChange={(e) => setCellRef(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="field-selector">
                  <label>Field Type</label>
                  <div className="field-search">
                    <MagnifyingGlass size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search fields..."
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                    />
                  </div>

                  <div className="field-list">
                    {CATEGORY_ORDER.map((category) => {
                      const fields = getFilteredFields()[category]
                      if (!fields || fields.length === 0) return null

                      return (
                        <div key={category} className="field-category">
                          <div className="category-label">{category}</div>
                          {fields.map((field) => (
                            <button
                              key={field.key}
                              className={`field-option ${selectedFieldType === field.key ? 'selected' : ''}`}
                              onClick={() => setSelectedFieldType(field.key)}
                            >
                              {field.label}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedFieldType === '_custom' && (
                  <div className="custom-value-input">
                    <label>Custom Value</label>
                    <input
                      type="text"
                      placeholder="Enter fixed text value"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                    />
                  </div>
                )}

                <Button onClick={handleAddMapping}>
                  <Plus size={16} className="btn-icon" />
                  Add Mapping
                </Button>
              </>
            )}
          </div>

          {/* Current Mappings Section */}
          <div className="mapping-list-section">
            <h4>Current Mappings</h4>
            {Object.keys(tempMappings).length === 0 ? (
              <div className="no-mappings">No mappings configured yet.</div>
            ) : (
              <div className="mapping-list">
                {Object.entries(tempMappings).map(([sheetName, cellMappings]) => (
                  <div key={sheetName} className="sheet-mappings">
                    <div className="sheet-name">{sheetName}</div>
                    {Object.entries(cellMappings).map(([cell, fieldValue]) => (
                      <div key={cell} className="mapping-item">
                        <span className="mapping-cell">{cell}</span>
                        <span className="mapping-arrow">→</span>
                        <span className="mapping-field">{getFieldDisplayValue(fieldValue)}</span>
                        <button
                          className="mapping-remove"
                          onClick={() => handleRemoveMapping(sheetName, cell)}
                        >
                          <X size={14} className="remove-icon" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mapping-actions">
            <Button variant="secondary" onClick={() => setShowMappingModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMappings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false)
          resetImportModal()
        }}
        title="Import Templates from Old CRM"
      >
        <div className="import-modal">
          <div className="import-description">
            <p>
              Import Excel templates exported from your old BYD-CRM. Supports both JSON and ZIP
              files (with master files).
            </p>
          </div>

          {/* File Upload */}
          <div className="form-group">
            <label>Select Export File</label>
            <div className="file-upload-area">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleImportFileSelect}
                style={{ display: 'none' }}
                disabled={isImporting}
              />
              {!importFile ? (
                <div
                  className="upload-placeholder"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  <UploadSimple size={24} className="upload-icon" />
                  <span>Click to select file</span>
                  <small>.json or .zip from old CRM export</small>
                </div>
              ) : (
                <div className="file-selected">
                  <FileXls size={18} className="file-icon" />
                  <span>{importFile.name}</span>
                  {!isImporting && (
                    <button
                      className="remove-file"
                      onClick={() => {
                        setImportFile(null)
                        if (importFileInputRef.current) importFileInputRef.current.value = ''
                      }}
                    >
                      <X size={14} className="remove-icon" />
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
          <div className="form-actions">
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
              {isImporting ? 'Importing...' : 'Import Templates'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
