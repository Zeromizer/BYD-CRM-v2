import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus, DownloadSimple, ArrowsOut } from '@phosphor-icons/react';
import './PdfViewer.css';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

export function PdfViewer({ url, filename, onDownload }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderTask, setRenderTask] = useState<pdfjsLib.RenderTask | null>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading PDF:', err);
          setError('Failed to load PDF');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Calculate optimal scale based on container width
  const calculateOptimalScale = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const container = containerRef.current;

    if (container) {
      const containerWidth = container.clientWidth - 32; // Account for padding
      const optimalScale = containerWidth / viewport.width;
      return Math.min(optimalScale, 2); // Cap at 2x scale
    }
    return 1;
  }, []);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      // Cancel any existing render task
      if (renderTask) {
        renderTask.cancel();
      }

      try {
        const page = await pdfDoc.getPage(currentPage);

        if (cancelled) return;

        // Calculate optimal scale on first load
        let renderScale = scale;
        if (scale === 1 && containerRef.current) {
          renderScale = await calculateOptimalScale(pdfDoc, currentPage);
          setScale(renderScale);
        }

        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        // Set canvas dimensions
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.scale(outputScale, outputScale);

        const newRenderTask = page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        });

        setRenderTask(newRenderTask);
        await newRenderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale, calculateOptimalScale, renderTask]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.25, 0.5));
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="pdf-spinner" />
        <span>Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <span>{error}</span>
        <button className="pdf-retry-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
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
            <CaretLeft size={18} />
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
            <CaretRight size={18} />
          </button>
        </div>

        <div className="pdf-toolbar-right">
          <button
            className="pdf-toolbar-btn"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <MagnifyingGlassMinus size={18} />
          </button>
          <span className="pdf-zoom-info">{Math.round(scale * 100)}%</span>
          <button
            className="pdf-toolbar-btn"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <MagnifyingGlassPlus size={18} />
          </button>
          <button
            className="pdf-toolbar-btn"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ArrowsOut size={18} />
          </button>
          {onDownload && (
            <button
              className="pdf-toolbar-btn"
              onClick={onDownload}
              title="Download"
            >
              <DownloadSimple size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas container with scroll */}
      <div className="pdf-canvas-container">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>

      {/* Filename footer */}
      {filename && (
        <div className="pdf-filename-footer">
          {filename}
        </div>
      )}
    </div>
  );
}
