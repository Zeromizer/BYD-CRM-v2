import { ArrowLeft, DotsThree, Phone, ChatCircle, Envelope } from '@phosphor-icons/react';
import type { Customer } from '@/types';
import { CHECKLISTS, getOverallProgress, getMilestoneById } from '@/constants/milestones';
import './MobileSummaryCard.css';

interface MobileSummaryCardProps {
  customer: Customer;
  onBack?: () => void;
  onMoreActions?: () => void;
}

export function MobileSummaryCard({ customer, onBack, onMoreActions }: MobileSummaryCardProps) {
  const milestone = getMilestoneById(customer.current_milestone);
  const progress = getOverallProgress(customer.checklist);

  // Get next uncompleted step
  const getNextStep = (): string | null => {
    const currentChecklist = CHECKLISTS[customer.current_milestone];
    const checklistState = customer.checklist?.[customer.current_milestone] || {};

    for (const item of currentChecklist) {
      if (!checklistState[item.id]) {
        return item.label;
      }
    }
    return null;
  };

  // Get next due date from milestone dates
  const getNextDueDate = (): string | null => {
    const dates = customer.milestone_dates;
    if (!dates) return null;

    const milestoneOrder: (keyof typeof dates)[] = ['test_drive', 'close_deal', 'registration', 'delivery', 'nps'];
    const currentIndex = milestoneOrder.indexOf(customer.current_milestone);

    // Check current and future milestones for dates
    for (let i = currentIndex; i < milestoneOrder.length; i++) {
      const date = dates[milestoneOrder[i]];
      if (date) {
        return formatDate(date);
      }
    }
    return null;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const nextStep = getNextStep();
  const nextDueDate = getNextDueDate();

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
  };

  const handleMessage = () => {
    if (customer.phone) {
      window.location.href = `sms:${customer.phone}`;
    }
  };

  const handleEmail = () => {
    if (customer.email) {
      window.location.href = `mailto:${customer.email}`;
    }
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
        {onMoreActions && (
          <button type="button" className="summary-more-btn touch-target" onClick={onMoreActions}>
            <DotsThree size={24} weight="bold" className="more-icon" />
          </button>
        )}
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

      {/* Key Info Row */}
      <div className="summary-key-info">
        {nextDueDate && (
          <div className="key-info-item">
            <span className="key-info-label">Due</span>
            <span className="key-info-value">{nextDueDate}</span>
          </div>
        )}
        {nextStep && (
          <div className="key-info-item next-step">
            <span className="key-info-label">Next</span>
            <span className="key-info-value truncate">{nextStep}</span>
          </div>
        )}
      </div>

      {/* Quick Actions Row */}
      <div className="summary-actions">
        <button
          type="button"
          className="summary-action-btn touch-target"
          onClick={handleCall}
          disabled={!customer.phone}
          title={customer.phone || 'No phone'}
        >
          <Phone size={18} className="action-icon" />
          <span>Call</span>
        </button>
        <button
          type="button"
          className="summary-action-btn touch-target"
          onClick={handleMessage}
          disabled={!customer.phone}
          title={customer.phone || 'No phone'}
        >
          <ChatCircle size={18} className="action-icon" />
          <span>Message</span>
        </button>
        <button
          type="button"
          className="summary-action-btn touch-target"
          onClick={handleEmail}
          disabled={!customer.email}
          title={customer.email || 'No email'}
        >
          <Envelope size={18} className="action-icon" />
          <span>Email</span>
        </button>
      </div>
    </div>
  );
}

export default MobileSummaryCard;
