import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { CaretLeft, CaretRight, DownloadSimple, ArrowsOut, Table } from '@phosphor-icons/react';
import './ExcelViewer.css';

interface ExcelViewerProps {
  url: string;
  filename?: string;
  onDownload?: () => void;
}

interface SheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
  colCount: number;
}

// Convert column index to Excel letter (0 = A, 1 = B, ..., 26 = AA, etc.)
function getColumnLetter(index: number): string {
  let letter = '';
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
}

export function ExcelViewer({ url, filename, onDownload }: ExcelViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExcel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch Excel file');
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const loadedSheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];

        // Get all rows as-is, no header assumption
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
          worksheet,
          { header: 1, defval: null, blankrows: false }
        );

        // Find max column count across all rows
        const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

        return {
          name: sheetName,
          rows,
          colCount,
        };
      });

      setSheets(loadedSheets);
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
          <span className="excel-row-count">
            {currentSheet.rows.length} rows
          </span>
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

      {/* Table container */}
      <div className="excel-table-container">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="excel-row-number"></th>
              {Array.from({ length: currentSheet.colCount }, (_, i) => (
                <th key={i} className="excel-col-header">{getColumnLetter(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentSheet.rows.length === 0 ? (
              <tr>
                <td colSpan={currentSheet.colCount + 1} className="excel-empty">
                  No data in this sheet
                </td>
              </tr>
            ) : (
              currentSheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="excel-row-number">{rowIndex + 1}</td>
                  {Array.from({ length: currentSheet.colCount }, (_, colIndex) => (
                    <td key={colIndex}>
                      {row[colIndex] !== null && row[colIndex] !== undefined
                        ? String(row[colIndex])
                        : ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
