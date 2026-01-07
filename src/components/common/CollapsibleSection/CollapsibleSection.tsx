import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultExpanded?: boolean;
  persistKey?: string; // localStorage key to persist expanded state
  badge?: string | number; // Shows count badge
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = false,
  persistKey,
  badge,
  children,
  className = '',
}: CollapsibleSectionProps) {
  // Initialize state from localStorage if persistKey is provided
  const [isExpanded, setIsExpanded] = useState(() => {
    if (persistKey) {
      const stored = localStorage.getItem(`collapsible-${persistKey}`);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return defaultExpanded;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    isExpanded ? undefined : 0
  );

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(`collapsible-${persistKey}`, String(isExpanded));
    }
  }, [isExpanded, persistKey]);

  // Calculate content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      if (isExpanded) {
        const height = contentRef.current.scrollHeight;
        setContentHeight(height);
        // After animation, remove fixed height to allow content to resize
        const timer = setTimeout(() => {
          setContentHeight(undefined);
        }, 200);
        return () => clearTimeout(timer);
      } else {
        // First set the current height, then animate to 0
        setContentHeight(contentRef.current.scrollHeight);
        requestAnimationFrame(() => {
          setContentHeight(0);
        });
      }
    }
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className={`collapsible-section ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}
    >
      <button
        type="button"
        className="collapsible-section-header"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
      >
        <div className="collapsible-section-title">
          {icon && <span className="collapsible-section-icon">{icon}</span>}
          <span className="collapsible-section-title-text">{title}</span>
          {badge !== undefined && badge !== null && badge !== '' && badge !== 0 && (
            <span className="collapsible-section-badge">{badge}</span>
          )}
        </div>
        <CaretDown
          size={16}
          weight="bold"
          className={`collapsible-section-caret ${isExpanded ? 'rotated' : ''}`}
        />
      </button>
      <div
        ref={contentRef}
        className="collapsible-section-content"
        style={{
          height: contentHeight !== undefined ? `${contentHeight}px` : 'auto',
        }}
        aria-hidden={!isExpanded}
      >
        <div className="collapsible-section-content-inner">{children}</div>
      </div>
    </div>
  );
}
