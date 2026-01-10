/**
 * Sales Pack Upload Modal
 *
 * Multi-step modal for uploading and processing a "sales pack" PDF
 * containing multiple document types (VSA, NRIC, PDPA, etc.)
 *
 * Steps:
 * 1. Select PDF file
 * 2. Analyze - Extract text and classify pages with Vision+Claude
 * 3. Review - User reviews/edits suggested document splits
 * 4. Upload - Split PDF and upload to customer folders
 * 5. Complete - Success message
 */

import { useState, useRef, useCallback } from 'react'
import {
  CircleNotch,
  UploadSimple,
  Warning,
  CheckCircle,
  FilePdf,
  CaretDown,
  Trash,
  Plus,
} from '@phosphor-icons/react'
import { Modal, Button, useToast } from '@/components/common'
import {
  analyzeSalesPack,
  splitPdf,
  generateSplitFilename,
  getAvailableDocumentTypes,
  getDocumentTypeInfo,
  type SalesPackAnalysisResult,
  type SplitDocument,
} from '@/services/salesPackService'
import { uploadCustomerDocument, clearDocumentListCache } from '@/services/customerDocumentService'
import type { Customer } from '@/types'
import './SalesPackUploadModal.css'

interface SalesPackUploadModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  onUploadComplete: () => void
}

type UploadStage = 'select' | 'analyzing' | 'review' | 'uploading' | 'complete'

export function SalesPackUploadModal({
  isOpen,
  onClose,
  customer,
  onUploadComplete,
}: SalesPackUploadModalProps) {
  const [stage, setStage] = useState<UploadStage>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<SalesPackAnalysisResult | null>(null)
  const [editedSplits, setEditedSplits] = useState<SplitDocument[]>([])
  const [progress, setProgress] = useState({ stage: '', current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { success: toastSuccess, error: toastError } = useToast()

  const documentTypes = getAvailableDocumentTypes()

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStage('select')
    setSelectedFile(null)
    setAnalysis(null)
    setEditedSplits([])
    setProgress({ stage: '', current: 0, total: 0 })
    setError(null)
    setUploadResults({ success: 0, failed: 0 })
    onClose()
  }, [onClose])

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.includes('pdf')) {
      setError('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    setStage('analyzing')
    setError(null)

    try {
      const result = await analyzeSalesPack(file, (stageName, current, total) => {
        setProgress({ stage: stageName, current, total })
      })

      setAnalysis(result)
      setEditedSplits(result.suggestedSplits)
      setStage('review')
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(`Analysis failed: ${(err as Error).message}`)
      setStage('select')
    }
  }

  // Handle document type change
  const handleChangeDocumentType = (splitId: string, newType: string) => {
    setEditedSplits((prev) =>
      prev.map((split) =>
        split.id === splitId
          ? {
              ...split,
              documentType: newType,
              documentTypeName: getDocumentTypeInfo(newType).name,
            }
          : split
      )
    )
  }

  // Handle removing a split
  const handleRemoveSplit = (splitId: string) => {
    setEditedSplits((prev) => prev.filter((split) => split.id !== splitId))
  }

  // Handle merging adjacent splits
  const handleMergeSplits = (splitId: string, direction: 'prev' | 'next') => {
    setEditedSplits((prev) => {
      const index = prev.findIndex((s) => s.id === splitId)
      if (index === -1) return prev

      const targetIndex = direction === 'prev' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev

      const current = prev[index]
      const target = prev[targetIndex]

      // Merge pages
      const mergedPages =
        direction === 'prev'
          ? [...target.pages, ...current.pages].sort((a, b) => a - b)
          : [...current.pages, ...target.pages].sort((a, b) => a - b)

      // Create merged split (keep target's document type)
      const merged: SplitDocument = {
        ...target,
        pages: mergedPages,
        confidence: Math.round((target.confidence + current.confidence) / 2),
      }

      // Remove both and insert merged
      const newSplits = prev.filter((_, i) => i !== index && i !== targetIndex)
      const insertIndex = Math.min(index, targetIndex)
      newSplits.splice(insertIndex, 0, merged)

      return newSplits
    })
  }

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || editedSplits.length === 0) return

    setStage('uploading')
    setUploadResults({ success: 0, failed: 0 })

    try {
      // Get page texts from analysis for blank page detection
      const pageTexts = analysis?.pageClassifications.map((p) => p.rawText) ?? []

      // Split the PDF (automatically removes blank pages)
      const splitDocs = await splitPdf(selectedFile, editedSplits, pageTexts)

      let successCount = 0
      let failedCount = 0

      // Upload each split document
      for (let i = 0; i < splitDocs.length; i++) {
        const split = splitDocs[i]
        setProgress({
          stage: `Uploading ${split.documentTypeName}`,
          current: i + 1,
          total: splitDocs.length,
        })

        try {
          const filename = generateSplitFilename(
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- fallback on empty string is intentional
            customer.name || analysis?.customerName || 'UNKNOWN',
            split.documentType
          )

          // pdfBlob should exist after splitting, skip if missing
          if (!split.pdfBlob) {
            console.error(`Missing PDF blob for ${split.documentTypeName}`)
            failedCount++
            continue
          }
          const file = new File([split.pdfBlob], filename, { type: 'application/pdf' })
          await uploadCustomerDocument(split.documentType, file, customer.name)
          successCount++
        } catch (err) {
          console.error(`Failed to upload ${split.documentTypeName}:`, err)
          failedCount++
        }

        setUploadResults({ success: successCount, failed: failedCount })
      }

      // Clear cache to refresh document list
      clearDocumentListCache(customer.name)

      setStage('complete')

      if (failedCount === 0) {
        toastSuccess(`Successfully uploaded ${successCount} documents from sales pack`)
      } else {
        toastError(`Uploaded ${successCount} documents, ${failedCount} failed`)
      }
    } catch (err) {
      console.error('Upload failed:', err)
      setError(`Upload failed: ${(err as Error).message}`)
      setStage('review')
    }
  }

  // Handle completion
  const handleComplete = () => {
    onUploadComplete()
    handleClose()
  }

  // Render select stage
  const renderSelectStage = () => (
    <div className="sales-pack-select">
      <div className="sales-pack-dropzone" onClick={() => fileInputRef.current?.click()}>
        <FilePdf size={48} weight="thin" />
        <p className="dropzone-title">Upload Sales Pack PDF</p>
        <p className="dropzone-subtitle">
          Upload a multi-page PDF containing VSA, NRIC, PDPA, and other documents
        </p>
        <Button variant="primary" leftIcon={<UploadSimple size={16} />}>
          Select PDF File
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      {error && (
        <div className="sales-pack-error">
          <Warning size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )

  // Render analyzing stage
  const renderAnalyzingStage = () => (
    <div className="sales-pack-analyzing">
      <CircleNotch size={48} className="spin" />
      <p className="analyzing-title">Analyzing Sales Pack</p>
      <p className="analyzing-subtitle">{progress.stage}</p>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
          }}
        />
      </div>
      <p className="progress-text">
        {progress.current} / {progress.total} pages
      </p>
    </div>
  )

  // Render review stage
  const renderReviewStage = () => (
    <div className="sales-pack-review">
      <div className="review-header">
        <div className="review-summary">
          <p>
            Found <strong>{editedSplits.length} documents</strong> in{' '}
            <strong>{analysis?.totalPages} pages</strong>
          </p>
          {analysis?.customerName && (
            <p className="customer-name">
              Customer: <strong>{analysis.customerName}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="review-splits">
        {editedSplits.map((split, index) => (
          <div key={split.id} className="split-card">
            <div className="split-thumbnail">
              {split.thumbnailDataUrl ? (
                <img src={split.thumbnailDataUrl} alt={`Page ${split.pages[0]}`} />
              ) : (
                <FilePdf size={40} />
              )}
            </div>
            <div className="split-info">
              <div className="split-type-select">
                <select
                  value={split.documentType}
                  onChange={(e) => handleChangeDocumentType(split.id, e.target.value)}
                  aria-label="Document type"
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <CaretDown size={14} className="select-arrow" />
              </div>
              <div className="split-pages">
                {split.pages.length === 1
                  ? `Page ${split.pages[0]}`
                  : `Pages ${split.pages[0]}-${split.pages[split.pages.length - 1]}`}
              </div>
              <div className={`split-confidence ${split.confidence < 70 ? 'low' : ''}`}>
                {split.confidence}% confident
                {split.confidence < 70 && <Warning size={12} />}
              </div>
            </div>
            <div className="split-actions">
              {index > 0 && (
                <button
                  className="merge-btn"
                  onClick={() => handleMergeSplits(split.id, 'prev')}
                  title="Merge with previous document"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                className="remove-btn"
                onClick={() => handleRemoveSplit(split.id)}
                title="Remove this document"
              >
                <Trash size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="sales-pack-error">
          <Warning size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="review-actions">
        <Button variant="secondary" onClick={() => setStage('select')}>
          Start Over
        </Button>
        <Button variant="primary" onClick={handleUpload} disabled={editedSplits.length === 0}>
          Upload {editedSplits.length} Documents
        </Button>
      </div>
    </div>
  )

  // Render uploading stage
  const renderUploadingStage = () => (
    <div className="sales-pack-uploading">
      <CircleNotch size={48} className="spin" />
      <p className="uploading-title">Uploading Documents</p>
      <p className="uploading-subtitle">{progress.stage}</p>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
          }}
        />
      </div>
      <p className="progress-text">
        {progress.current} / {progress.total} documents
      </p>
      {uploadResults.success > 0 && (
        <p className="upload-results">
          <CheckCircle size={14} className="success-icon" />
          {uploadResults.success} uploaded
          {uploadResults.failed > 0 && (
            <>
              <Warning size={14} className="error-icon" />
              {uploadResults.failed} failed
            </>
          )}
        </p>
      )}
    </div>
  )

  // Render complete stage
  const renderCompleteStage = () => (
    <div className="sales-pack-complete">
      <CheckCircle size={64} weight="fill" className="complete-icon" />
      <p className="complete-title">Upload Complete!</p>
      <p className="complete-subtitle">
        Successfully uploaded {uploadResults.success} documents
        {uploadResults.failed > 0 && `, ${uploadResults.failed} failed`}
      </p>
      <Button variant="primary" onClick={handleComplete}>
        Done
      </Button>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Sales Pack" size="lg">
      <div className="sales-pack-modal">
        {stage === 'select' && renderSelectStage()}
        {stage === 'analyzing' && renderAnalyzingStage()}
        {stage === 'review' && renderReviewStage()}
        {stage === 'uploading' && renderUploadingStage()}
        {stage === 'complete' && renderCompleteStage()}
      </div>
    </Modal>
  )
}
