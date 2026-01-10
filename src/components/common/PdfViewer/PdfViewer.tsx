import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  DownloadSimple,
  ArrowsOut,
  Printer,
} from '@phosphor-icons/react'
import './PdfViewer.css'

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string
  filename?: string
  onDownload?: () => void
}

export function PdfViewer({ url, filename, onDownload }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState<number | null>(null) // null = auto-fit
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerReady, setContainerReady] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionStartRef = useRef({ x: 0, y: 0 })

  // Track if we're zoomed in beyond auto-fit
  const initialScaleRef = useRef<number | null>(null)

  // Load PDF document
  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      try {
        setLoading(true)
        setError(null)

        const loadingTask = pdfjsLib.getDocument(url)
        const pdf = await loadingTask.promise

        if (cancelled) return

        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading PDF:', err)
          setError('Failed to load PDF')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
    }
  }, [url])

  // Wait for container to be ready with proper dimensions
  useEffect(() => {
    const checkContainer = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        setContainerReady(true)
      }
    }

    // Check immediately and after a small delay (for modal animation)
    checkContainer()
    const timer = setTimeout(checkContainer, 100)

    return () => clearTimeout(timer)
  }, [loading])

  // Calculate optimal scale based on container width
  const calculateOptimalScale = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const container = containerRef.current

      if (container) {
        // Use the canvas container for width calculation (minus padding)
        const canvasContainer = container.querySelector('.pdf-canvas-container')
        const containerWidth = canvasContainer
          ? canvasContainer.clientWidth - 16 // Less padding on mobile
          : container.clientWidth - 32
        const optimalScale = containerWidth / viewport.width
        return Math.min(Math.max(optimalScale, 0.5), 2) // Between 0.5x and 2x
      }
      return 1
    },
    []
  )

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerReady) return

    let cancelled = false

    const renderPage = async () => {
      // Cancel any existing render task
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (_e) {
          // Ignore cancel errors
        }
        renderTaskRef.current = null
      }

      try {
        const page = await pdfDoc.getPage(currentPage)

        if (cancelled) return

        // Calculate optimal scale if auto-fit (scale === null)
        let renderScale = scale
        if (scale === null && containerRef.current) {
          renderScale = await calculateOptimalScale(pdfDoc, currentPage)
          initialScaleRef.current = renderScale // Store initial scale
          setScale(renderScale)
          return // Will re-render with new scale
        }
        // Fallback if still null
        renderScale ??= 1

        const viewport = page.getViewport({ scale: renderScale })
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const canvas = canvasRef.current!
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const context = canvas.getContext('2d')!

        // Set canvas dimensions
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        context.scale(outputScale, outputScale)

        const newRenderTask = page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        })

        renderTaskRef.current = newRenderTask
        await newRenderTask.promise
      } catch (err) {
        if ((err as Error)?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Error rendering page:', err)
        }
      }
    }

    void renderPage()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch (_e) {
          // Ignore cancel errors
        }
      }
    }
  }, [pdfDoc, currentPage, scale, calculateOptimalScale, containerReady])

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min((prev ?? 1) * 1.25, 3))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max((prev ?? 1) / 1.25, 0.5))
  }

  const handleOpenExternal = () => {
    window.open(url, '_blank')
  }

  const handlePrint = () => {
    // Open PDF in new window and trigger print
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
      })
    }
  }

  // Check if zoomed in beyond initial scale
  const isZoomedIn = useMemo(() => {
    if (scale === null || initialScaleRef.current === null) return false
    return scale > initialScaleRef.current
  }, [scale])

  // Mouse drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isZoomedIn) return
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      positionStartRef.current = { ...position }
    },
    [isZoomedIn, position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch drag handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isZoomedIn) return
      const touch = e.touches[0]
      setIsDragging(true)
      dragStartRef.current = { x: touch.clientX, y: touch.clientY }
      positionStartRef.current = { ...position }
    },
    [isZoomedIn, position]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return
      const touch = e.touches[0]
      const dx = touch.clientX - dragStartRef.current.x
      const dy = touch.clientY - dragStartRef.current.y
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      })
    },
    [isDragging]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Reset position when page changes or zoom resets
  useEffect(() => {
    setPosition({ x: 0, y: 0 })
  }, [currentPage])

  if (loading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="pdf-spinner" />
        <span>Loading PDF...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <span>{error}</span>
        <button className="pdf-retry-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <button
            className="pdf-toolbar-btn"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            <CaretLeft size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="pdf-page-info">
            {currentPage} / {totalPages}
          </span>
          <button
            className="pdf-toolbar-btn"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            title="Next page"
          >
            <CaretRight size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="pdf-toolbar-right">
          <button className="pdf-toolbar-btn" onClick={handleZoomOut} title="Zoom out">
            <MagnifyingGlassMinus
              size={18}
              weight="bold"
              style={{ color: 'var(--text-secondary)' }}
            />
          </button>
          <span className="pdf-zoom-info">{scale ? Math.round(scale * 100) : 100}%</span>
          <button className="pdf-toolbar-btn" onClick={handleZoomIn} title="Zoom in">
            <MagnifyingGlassPlus
              size={18}
              weight="bold"
              style={{ color: 'var(--text-secondary)' }}
            />
          </button>
          <button className="pdf-toolbar-btn" onClick={handleOpenExternal} title="Open in new tab">
            <ArrowsOut size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button className="pdf-toolbar-btn" onClick={handlePrint} title="Print">
            <Printer size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          {onDownload && (
            <button className="pdf-toolbar-btn" onClick={onDownload} title="Download">
              <DownloadSimple size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas container with scroll */}
      <div
        className={`pdf-canvas-container ${isDragging ? 'dragging' : ''} ${isZoomedIn ? 'zoomable' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="pdf-canvas"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Filename footer */}
      {filename && <div className="pdf-filename-footer">{filename}</div>}
    </div>
  )
}
