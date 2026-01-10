/**
 * ExcelPopulateModal Component
 * Modal for generating populated Excel files from templates
 */

import { useState, useEffect, useRef } from 'react'
import { FileXls, UploadSimple, DownloadSimple, X } from '@phosphor-icons/react'
import { Button, Modal } from '@/components/common'
import { useToast } from '@/components/common'
import { useExcelStore } from '@/stores/useExcelStore'
import {
  populateExcelTemplate,
  downloadExcelFile,
  generateFileName,
  getCustomerDataMapping,
} from '@/services/excelService'
import { getFieldLabel } from '@/constants/excelFields'
import type { Customer, Guarantor, ExcelTemplate } from '@/types'
import './ExcelPopulateModal.css'

interface ExcelPopulateModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  guarantors?: Guarantor[]
}

export function ExcelPopulateModal({
  isOpen,
  onClose,
  customer,
  guarantors,
}: ExcelPopulateModalProps) {
  const { templates, fetchTemplates, downloadExcelFile: downloadTemplateFile } = useExcelStore()
  const { success, error: toastError } = useToast()

  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      void fetchTemplates()
      setSelectedTemplateId('')
      setUploadedFile(null)
    }
  }, [isOpen, fetchTemplates])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)
  const hasMasterFile = selectedTemplate?.file_path
  const canGenerate = selectedTemplateId && (hasMasterFile || uploadedFile)

  // Get mapping count
  const getMappingCount = (template: ExcelTemplate): number => {
    let count = 0
    for (const sheetMappings of Object.values(template.field_mappings ?? {})) {
      count += Object.keys(sheetMappings).length
    }
    return count
  }

  // Get preview of mappings with actual values
  const getPreviewMappings = () => {
    if (!selectedTemplate) return []

    const dataMapping = getCustomerDataMapping(customer, guarantors)
    const preview: { cell: string; field: string; value: string }[] = []

    for (const [sheetName, cellMappings] of Object.entries(selectedTemplate.field_mappings ?? {})) {
      for (const [cell, fieldType] of Object.entries(cellMappings)) {
        let fieldLabel: string
        let value: string

        if (fieldType.startsWith('_custom:')) {
          fieldLabel = 'Custom Value'
          value = fieldType.substring(8)
        } else {
          fieldLabel = getFieldLabel(fieldType)
          const rawValue = dataMapping[fieldType]
          value = rawValue instanceof Date ? rawValue.toLocaleDateString() : String(rawValue ?? '')
        }

        preview.push({
          cell: `${sheetName}!${cell}`,
          field: fieldLabel,
          value: value || '(empty)',
        })
      }
    }

    return preview.slice(0, 10) // Show first 10 mappings
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleGenerate = async () => {
    if (!selectedTemplate || !canGenerate) {
      toastError('Please select a template and ensure a file is available')
      return
    }

    setIsGenerating(true)
    try {
      // Get the Excel file (either from storage or uploaded)
      let fileBlob: Blob

      if (uploadedFile) {
        fileBlob = uploadedFile
      } else if (selectedTemplate.file_path) {
        fileBlob = await downloadTemplateFile(selectedTemplate.file_path)
      } else {
        throw new Error('No Excel file available')
      }

      // Populate the template
      const populatedBlob = await populateExcelTemplate(
        selectedTemplate,
        customer,
        guarantors,
        fileBlob
      )

      // Generate filename and download
      const fileName = generateFileName(selectedTemplate.name, customer.name)
      downloadExcelFile(populatedBlob, fileName)

      success('Excel file generated successfully')
      onClose()
    } catch (err) {
      console.error('Error generating Excel file:', err)
      toastError('Failed to generate Excel file')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Excel Document">
      <div className="excel-populate-modal">
        {/* Template Selection */}
        <div className="template-selection">
          <label>Select Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value)
              setUploadedFile(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          >
            <option value="">-- Select a template --</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({getMappingCount(template)} fields)
                {template.file_path ? ' - Has master file' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* No templates message */}
        {templates.length === 0 && (
          <div className="no-templates">
            <FileXls size={32} className="empty-icon" />
            <p>No Excel templates available.</p>
            <small>Create templates in the Excel Templates page first.</small>
          </div>
        )}

        {/* File Upload (if no master file) */}
        {selectedTemplate && !hasMasterFile && (
          <div className="file-upload-section">
            <label>Upload Excel File</label>
            <p className="upload-hint">
              This template has no master file. Upload an Excel file to populate.
            </p>
            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {!uploadedFile ? (
                <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                  <UploadSimple size={24} className="upload-icon" />
                  <span>Click to upload Excel file</span>
                  <small>.xlsx or .xls</small>
                </div>
              ) : (
                <div className="file-selected">
                  <FileXls size={18} className="file-icon" />
                  <span>{uploadedFile.name}</span>
                  <button
                    className="remove-file"
                    onClick={() => {
                      setUploadedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <X size={14} className="remove-icon" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Section */}
        {selectedTemplate && getMappingCount(selectedTemplate) > 0 && (
          <div className="preview-section">
            <label>Data Preview</label>
            <div className="preview-list">
              {getPreviewMappings().map((item, index) => (
                <div key={index} className="preview-item">
                  <span className="preview-cell">{item.cell}</span>
                  <span className="preview-field">{item.field}</span>
                  <span className="preview-value">{item.value}</span>
                </div>
              ))}
              {getMappingCount(selectedTemplate) > 10 && (
                <div className="preview-more">
                  +{getMappingCount(selectedTemplate) - 10} more fields
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div className="customer-info">
          <span className="customer-label">Customer:</span>
          <span className="customer-name">{customer.name}</span>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
            <DownloadSimple size={16} className="btn-icon" />
            {isGenerating ? 'Generating...' : 'Generate & Download'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
