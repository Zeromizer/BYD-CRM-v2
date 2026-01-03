import { DownloadSimple, ArrowsOut, MicrosoftExcelLogo } from '@phosphor-icons/react';
import './ExcelViewer.css';

interface ExcelViewerProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

export function ExcelViewer({ url, filename, onDownload }: ExcelViewerProps) {
  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Fallback: trigger download via link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="excel-viewer">
      {/* Toolbar */}
      <div className="excel-toolbar">
        <div className="excel-toolbar-left">
          <span className="excel-sheet-info">
            <MicrosoftExcelLogo size={16} weight="fill" style={{ color: '#217346' }} />
            {filename || 'Excel Document'}
          </span>
        </div>

        <div className="excel-toolbar-right">
          <button
            className="excel-toolbar-btn"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ArrowsOut size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="excel-toolbar-btn"
            onClick={handleDownload}
            title="Download"
          >
            <DownloadSimple size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Download prompt */}
      <div className="excel-download-prompt">
        <div className="excel-icon-large">
          <MicrosoftExcelLogo size={64} weight="fill" />
        </div>
        <h3 className="excel-prompt-title">Excel Document</h3>
        <p className="excel-prompt-text">
          Download to view this spreadsheet in Excel or your preferred app
        </p>
        <button className="excel-download-btn" onClick={handleDownload}>
          <DownloadSimple size={18} weight="bold" />
          Download File
        </button>
      </div>

      {/* Filename footer */}
      {filename && (
        <div className="excel-filename-footer">
          {filename}
        </div>
      )}
    </div>
  );
}
