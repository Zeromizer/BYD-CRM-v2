import { useState, useEffect, useRef, memo } from 'react';
import { File, FilePdf, FileXls, FileDoc, FileVideo, Image as ImageIcon } from '@phosphor-icons/react';
import './DocumentThumbnail.css';

// In-memory thumbnail cache to avoid regenerating
const thumbnailCache = new Map<string, string>();

// Lazy load PDF.js only when needed
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
const getPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

interface DocumentThumbnailProps {
  url: string;
  mimeType: string;
  filename?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  onClick?: () => void;
}

function DocumentThumbnailBase({
  url,
  mimeType,
  filename = '',
  size = 'md',
  onClick
}: DocumentThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    // Check cache immediately on mount
    return thumbnailCache.get(url) || null;
  });
  const [loading, setLoading] = useState(!thumbnailCache.has(url));
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isVideo = mimeType?.startsWith('video/');
  const isExcel = mimeType?.includes('spreadsheet') ||
                  mimeType?.includes('excel') ||
                  filename?.match(/\.(xlsx?|xls)$/i);
  const isWord = mimeType?.includes('word') ||
                 mimeType?.includes('document') ||
                 filename?.match(/\.(docx?|doc)$/i);

  // Use IntersectionObserver to detect when thumbnail is visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Generate thumbnail only when visible
  useEffect(() => {
    if (!isVisible || !url || thumbnailUrl) return;

    let cancelled = false;

    const generateThumbnail = async () => {
      // Check cache again (in case another instance cached it)
      const cached = thumbnailCache.get(url);
      if (cached) {
        setThumbnailUrl(cached);
        setLoading(false);
        return;
      }

      try {
        if (isImage) {
          // For images, use the URL directly (browser will cache)
          setThumbnailUrl(url);
          thumbnailCache.set(url, url);
          setLoading(false);
        } else if (isPdf) {
          // Lazy load PDF.js and generate thumbnail
          const pdfjs = await getPdfjs();
          const loadingTask = pdfjs.getDocument(url);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);

          // Smaller render size for thumbnails
          const targetSize = size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : size === 'xl' ? 120 : 200;
          const viewport = page.getViewport({ scale: 1 });
          const scale = (targetSize * 1.5) / Math.min(viewport.width, viewport.height);
          const scaledViewport = page.getViewport({ scale });

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
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              thumbnailCache.set(url, dataUrl);
              setThumbnailUrl(dataUrl);
              setLoading(false);
            }
          }

          // Clean up PDF resources
          pdf.destroy();
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error generating thumbnail:', err);
          setError(true);
          setLoading(false);
        }
      }
    };

    generateThumbnail();

    return () => {
      cancelled = true;
    };
  }, [isVisible, url, mimeType, isImage, isPdf, size, thumbnailUrl]);

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
      ref={containerRef}
      className={`document-thumbnail ${sizeClass} ${onClick ? 'clickable' : ''}`}
      onClick={handleClick}
    >
      {!isVisible ? (
        // Placeholder before visible - show fallback icon immediately
        <div className="thumbnail-fallback">
          {renderFallbackIcon()}
        </div>
      ) : loading ? (
        <div className="thumbnail-loading">
          <div className="thumbnail-spinner" />
        </div>
      ) : thumbnailUrl && !error ? (
        <img
          src={thumbnailUrl}
          alt={filename || 'Document thumbnail'}
          className="thumbnail-image"
          loading="lazy"
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

// Memoize to prevent unnecessary re-renders
export const DocumentThumbnail = memo(DocumentThumbnailBase);
