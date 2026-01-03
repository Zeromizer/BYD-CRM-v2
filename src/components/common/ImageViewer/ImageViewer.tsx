import { useState, useRef, useCallback } from 'react';
import { MagnifyingGlassMinus, MagnifyingGlassPlus, DownloadSimple, ArrowsOut, Printer, ArrowCounterClockwise } from '@phosphor-icons/react';
import './ImageViewer.css';

interface ImageViewerProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

export function ImageViewer({ url, filename, onDownload }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.25, 4));
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.25, 0.25);
    setScale(newScale);
    // Reset position if zooming back to fit
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleResetZoom = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename || 'Print Image'}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
              img { max-width: 100%; max-height: 100vh; }
              @media print { body { margin: 0; } img { max-width: 100%; } }
            </style>
          </head>
          <body>
            <img src="${url}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return; // Only allow drag when zoomed in
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale <= 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    positionStartRef.current = { ...position };
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="image-viewer">
      {/* Toolbar */}
      <div className="image-toolbar">
        <div className="image-toolbar-left">
          <button
            className="image-toolbar-btn"
            onClick={handleRotate}
            title="Rotate 90°"
          >
            <ArrowCounterClockwise size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="image-toolbar-btn"
            onClick={handleResetZoom}
            title="Reset"
          >
            <span className="toolbar-text">Reset</span>
          </button>
        </div>

        <div className="image-toolbar-right">
          <button
            className="image-toolbar-btn"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <MagnifyingGlassMinus size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="image-zoom-info">{Math.round(scale * 100)}%</span>
          <button
            className="image-toolbar-btn"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <MagnifyingGlassPlus size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="image-toolbar-btn"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ArrowsOut size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="image-toolbar-btn"
            onClick={handlePrint}
            title="Print"
          >
            <Printer size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          {onDownload && (
            <button
              className="image-toolbar-btn"
              onClick={onDownload}
              title="Download"
            >
              <DownloadSimple size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Image container with zoom and pan */}
      <div
        ref={containerRef}
        className={`image-canvas-container ${isDragging ? 'dragging' : ''} ${scale > 1 ? 'zoomable' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={url}
          alt={filename || 'Preview'}
          className="preview-image"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Filename footer */}
      {filename && (
        <div className="image-filename-footer">
          {filename}
        </div>
      )}
    </div>
  );
}
