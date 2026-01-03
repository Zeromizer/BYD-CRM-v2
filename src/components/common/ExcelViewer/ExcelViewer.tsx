import { useState, useEffect, useCallback, useRef } from 'react';
import { CaretLeft, CaretRight, DownloadSimple, ArrowsOut, Table } from '@phosphor-icons/react';
import './ExcelViewer.css';

// Dynamic import for xlsx-preview
let xlsxPreview: typeof import('xlsx-preview') | null = null;

interface ExcelViewerProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

interface SheetHtml {
  name: string;
  html: string;
}

export function ExcelViewer({ url, filename, onDownload }: ExcelViewerProps) {
  const [sheets, setSheets] = useState<SheetHtml[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadExcel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Dynamically import xlsx-preview
      if (!xlsxPreview) {
        xlsxPreview = await import('xlsx-preview');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch Excel file');
      }

      const blob = await response.blob();

      // Convert to HTML with styles, separating sheets
      const result = await xlsxPreview.xlsx2Html(blob, {
        output: 'string',
        separateSheets: true,
      }) as string[];

      // Get sheet names from the workbook
      // xlsx-preview doesn't expose sheet names directly, so we'll parse from HTML or use generic names
      const sheetData: SheetHtml[] = result.map((html, index) => ({
        name: `Sheet ${index + 1}`,
        html,
      }));

      setSheets(sheetData);
      setCurrentSheetIndex(0);
    } catch (err) {
      console.error('Error loading Excel:', err);
      setError('Failed to load Excel file');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadExcel();
  }, [loadExcel]);

  const handlePrevSheet = () => {
    if (currentSheetIndex > 0) {
      setCurrentSheetIndex(currentSheetIndex - 1);
    }
  };

  const handleNextSheet = () => {
    if (currentSheetIndex < sheets.length - 1) {
      setCurrentSheetIndex(currentSheetIndex + 1);
    }
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  const currentSheet = sheets[currentSheetIndex];

  if (loading) {
    return (
      <div className="excel-viewer-loading">
        <div className="excel-spinner" />
        <span>Loading Excel...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="excel-viewer-error">
        <span>{error}</span>
        <button className="excel-retry-btn" onClick={loadExcel}>
          Retry
        </button>
      </div>
    );
  }

  if (!currentSheet) {
    return (
      <div className="excel-viewer-error">
        <span>No sheets found in this file</span>
      </div>
    );
  }

  return (
    <div className="excel-viewer">
      {/* Toolbar */}
      <div className="excel-toolbar">
        <div className="excel-toolbar-left">
          {sheets.length > 1 && (
            <>
              <button
                className="excel-toolbar-btn"
                onClick={handlePrevSheet}
                disabled={currentSheetIndex <= 0}
                title="Previous sheet"
              >
                <CaretLeft size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="excel-sheet-info">
                <Table size={14} weight="bold" style={{ color: 'var(--text-secondary)' }} />
                {currentSheet.name}
                <span className="excel-sheet-count">
                  ({currentSheetIndex + 1}/{sheets.length})
                </span>
              </span>
              <button
                className="excel-toolbar-btn"
                onClick={handleNextSheet}
                disabled={currentSheetIndex >= sheets.length - 1}
                title="Next sheet"
              >
                <CaretRight size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </>
          )}
          {sheets.length === 1 && (
            <span className="excel-sheet-info">
              <Table size={14} weight="bold" style={{ color: 'var(--text-secondary)' }} />
              {currentSheet.name}
            </span>
          )}
        </div>

        <div className="excel-toolbar-right">
          <button
            className="excel-toolbar-btn"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ArrowsOut size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
          </button>
          {onDownload && (
            <button
              className="excel-toolbar-btn"
              onClick={onDownload}
              title="Download"
            >
              <DownloadSimple size={18} weight="bold" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* HTML Preview container */}
      <div
        ref={containerRef}
        className="excel-html-container"
        dangerouslySetInnerHTML={{ __html: currentSheet.html }}
      />

      {/* Filename footer */}
      {filename && (
        <div className="excel-filename-footer">
          {filename}
        </div>
      )}
    </div>
  );
}
