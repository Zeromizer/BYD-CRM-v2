import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, DotsThree, Phone, ChatCircle, Envelope } from '@phosphor-icons/react';
import type { Customer } from '@/types';
import { getOverallProgress, getMilestoneById } from '@/constants/milestones';
import './MobileSummaryCard.css';

interface MobileSummaryCardProps {
  customer: Customer;
  onBack?: () => void;
  onMoreActions?: () => void;
}

export function MobileSummaryCard({ customer, onBack, onMoreActions }: MobileSummaryCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const milestone = getMilestoneById(customer.current_milestone);
  const progress = getOverallProgress(customer.checklist);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Quick action handlers
  const handleCall = () => {
    if (customer.phone) {
      window.location.href = `tel:${customer.phone}`;
    }
    setMenuOpen(false);
  };

  const handleMessage = () => {
    if (customer.phone) {
      window.location.href = `sms:${customer.phone}`;
    }
    setMenuOpen(false);
  };

  const handleEmail = () => {
    if (customer.email) {
      window.location.href = `mailto:${customer.email}`;
    }
    setMenuOpen(false);
  };

  const handleMoreActions = () => {
    setMenuOpen(false);
    onMoreActions?.();
  };

  return (
    <div className="mobile-summary-card">
      {/* Header Row */}
      <div className="summary-header">
        {onBack && (
          <button type="button" className="summary-back-btn touch-target" onClick={onBack}>
            <ArrowLeft size={20} className="back-icon" />
          </button>
        )}
        <div className="summary-avatar" style={{ backgroundColor: milestone?.color || '#64748b' }}>
          {getInitials(customer.name)}
        </div>
        <div className="summary-info">
          <h2 className="summary-name">{customer.name}</h2>
          <p className="summary-vehicle">
            {customer.vsa_make_model || 'No vehicle'}{customer.vsa_variant ? ` ${customer.vsa_variant}` : ''}
          </p>
        </div>
        <div className="summary-menu-container" ref={menuRef}>
          <button
            type="button"
            className="summary-more-btn touch-target"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <DotsThree size={24} weight="bold" className="more-icon" />
          </button>
          {menuOpen && (
            <div className="summary-dropdown-menu">
              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handleCall}
                disabled={!customer.phone}
              >
                <Phone size={18} />
                <span>Call</span>
              </button>
              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handleMessage}
                disabled={!customer.phone}
              >
                <ChatCircle size={18} />
                <span>Message</span>
              </button>
              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handleEmail}
                disabled={!customer.email}
              >
                <Envelope size={18} />
                <span>Email</span>
              </button>
              {onMoreActions && (
                <>
                  <div className="dropdown-menu-divider" />
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={handleMoreActions}
                  >
                    <DotsThree size={18} weight="bold" />
                    <span>More Actions</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Row */}
      <div className="summary-progress-row">
        <span
          className="summary-milestone-badge"
          style={{ backgroundColor: milestone?.color || '#64748b' }}
        >
          {milestone?.name || 'Unknown'}
        </span>
        <div className="summary-progress-bar">
          <div
            className="summary-progress-fill"
            style={{
              width: `${progress}%`,
              backgroundColor: milestone?.color || '#64748b',
            }}
          />
        </div>
        <span className="summary-progress-text">{progress}%</span>
      </div>
    </div>
  );
}

export default MobileSummaryCard;
