import { useState, useEffect } from 'react';
import { File, FilePdf, FileXls, FileDoc, FileVideo, Image as ImageIcon } from '@phosphor-icons/react';
import * as pdfjsLib from 'pdfjs-dist';
import './DocumentThumbnail.css';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface DocumentThumbnailProps {
  url: string;
  mimeType: string;
  filename?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  onClick?: () => void;
}

export function DocumentThumbnail({
  url,
  mimeType,
  filename = '',
  size = 'md',
  onClick
}: DocumentThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isVideo = mimeType?.startsWith('video/');
  const isExcel = mimeType?.includes('spreadsheet') ||
                  mimeType?.includes('excel') ||
                  filename?.match(/\.(xlsx?|xls)$/i);
  const isWord = mimeType?.includes('word') ||
                 mimeType?.includes('document') ||
                 filename?.match(/\.(docx?|doc)$/i);

  useEffect(() => {
    let cancelled = false;

    const generateThumbnail = async () => {
      if (!url) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        if (isImage) {
          // For images, just use the URL directly
          setThumbnailUrl(url);
          setLoading(false);
        } else if (isPdf) {
          // Generate PDF thumbnail from first page
          const loadingTask = pdfjsLib.getDocument(url);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);

          // Calculate scale to fit thumbnail size (render at 2x for better quality)
          const targetSize = size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : size === 'xl' ? 120 : 200;
          const viewport = page.getViewport({ scale: 1 });
          const scale = (targetSize * 2) / Math.min(viewport.width, viewport.height); // 2x for retina quality
          const scaledViewport = page.getViewport({ scale });

          // Create canvas and render
          const canvas = document.createElement('canvas');
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          const ctx = canvas.getContext('2d');

          if (ctx && !cancelled) {
            await page.render({
              canvasContext: ctx,
              viewport: scaledViewport,
              canvas,
            }).promise;

            if (!cancelled) {
              setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.8));
              setLoading(false);
            }
          }
        } else {
          // For other file types, no thumbnail generation
          setLoading(false);
        }
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      cancelled = true;
    };
  }, [url, mimeType, isImage, isPdf, size]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // Render file type icon as fallback
  const renderFallbackIcon = () => {
    const iconSize = size === 'sm' ? 24 : size === 'md' ? 28 : size === 'lg' ? 32 : size === 'xl' ? 40 : 48;
    const iconProps = { size: iconSize, weight: 'duotone' as const };

    if (isPdf) {
      return <FilePdf {...iconProps} className="thumbnail-icon pdf" />;
    } else if (isExcel) {
      return <FileXls {...iconProps} className="thumbnail-icon excel" />;
    } else if (isWord) {
      return <FileDoc {...iconProps} className="thumbnail-icon word" />;
    } else if (isVideo) {
      return <FileVideo {...iconProps} className="thumbnail-icon video" />;
    } else if (isImage) {
      return <ImageIcon {...iconProps} className="thumbnail-icon image" />;
    } else {
      return <File {...iconProps} className="thumbnail-icon generic" />;
    }
  };

  const sizeClass = `thumbnail-${size}`;

  return (
    <div
      className={`document-thumbnail ${sizeClass} ${onClick ? 'clickable' : ''}`}
      onClick={handleClick}
    >
      {loading ? (
        <div className="thumbnail-loading">
          <div className="thumbnail-spinner" />
        </div>
      ) : thumbnailUrl && !error ? (
        <img
          src={thumbnailUrl}
          alt={filename || 'Document thumbnail'}
          className="thumbnail-image"
          onError={() => setError(true)}
        />
      ) : (
        <div className="thumbnail-fallback">
          {renderFallbackIcon()}
        </div>
      )}
    </div>
  );
}
