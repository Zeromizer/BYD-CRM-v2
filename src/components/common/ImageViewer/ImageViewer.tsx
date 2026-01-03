import { useState } from 'react';
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

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.25, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.25, 0.25));
  };

  const handleResetZoom = () => {
    setScale(1);
    setRotation(0);
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
      <div className="image-canvas-container">
        <img
          src={url}
          alt={filename || 'Preview'}
          className="preview-image"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
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
