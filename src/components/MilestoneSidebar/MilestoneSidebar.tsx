import { Check, X, FloppyDisk, Calendar, Clock, CheckSquare, ArrowRight, File, UploadSimple, Warning } from '@phosphor-icons/react';
import {
  MILESTONES,
  CHECKLISTS,
  getMilestoneProgress,
  isMilestoneComplete,
  getDaysUntilMilestone,
  getMilestoneUrgency,
} from '@/constants/milestones';
import { REQUIRED_DOCUMENTS, DOCUMENT_STATUS } from '@/constants/documentRequirements';
import { useMilestoneChecklist } from '@/hooks';
import { getMilestoneIcon, CheckmarkIcon } from '@/utils';
import type { Customer, DocumentChecklistItem } from '@/types';
import './MilestoneSidebar.css';

interface MilestoneSidebarProps {
  customer: Customer;
}

// SVG Progress Ring Component
function ProgressRing({ progress, color, size = 52 }: { progress: number; color: string; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg className="progress-ring" width={size} height={size}>
      <circle
        className="progress-ring-bg"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="progress-ring-progress"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset,
          stroke: color,
        }}
      />
    </svg>
  );
}

export function MilestoneSidebar({ customer }: MilestoneSidebarProps) {
  const {
    expandedMilestone,
    currentMilestone,
    localChecklist,
    localMilestoneDates,
    hasChanges,
    isSaving,
    isCreatingTodos,
    handleMilestoneClick,
    handleSetCurrentMilestone,
    handleChecklistToggle,
    handleMilestoneDateChange,
    handleCreateTodosFromChecklist,
    handleSaveChanges,
    handleCancel,
    handleClosePanel,
  } = useMilestoneChecklist({ customer, resetExpandedOnCustomerChange: true });

  // Get expanded milestone data
  const expandedMilestoneData = expandedMilestone
    ? MILESTONES.find((m) => m.id === expandedMilestone)
    : null;

  return (
    <div className="milestone-sidebar">
      {/* Vertical Icon Bar */}
      <div className="milestone-icons">
        {MILESTONES.map((milestone) => {
          const progress = getMilestoneProgress(milestone.id, localChecklist);
          const isComplete = isMilestoneComplete(milestone.id, localChecklist);
          const isCurrent = milestone.id === currentMilestone;
          const isExpanded = milestone.id === expandedMilestone;

          return (
            <button
              key={milestone.id}
              className={`milestone-icon-btn ${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => handleMilestoneClick(milestone.id)}
              title={`${milestone.name} (${progress}%)`}
              style={{ '--milestone-color': milestone.color } as React.CSSProperties}
            >
              <ProgressRing progress={progress} color={milestone.color} />
              <div className="icon-inner">
                {isComplete ? (
                  <Check size={18} weight="bold" color="white" />
                ) : (
                  getMilestoneIcon(milestone.iconName, 18, isCurrent ? milestone.color : 'var(--text-muted)')
                )}
              </div>
              {isCurrent && <div className="current-dot" style={{ background: milestone.color }} />}
            </button>
          );
        })}
      </div>

      {/* Slide-out Panel */}
      {expandedMilestone && expandedMilestoneData && (
        <>
          <div className="milestone-panel-backdrop" onClick={handleClosePanel} />
          <div
            className="milestone-panel"
            style={{ '--panel-color': expandedMilestoneData.color } as React.CSSProperties}
          >
            {/* Panel Header */}
            <div className="panel-header">
              <div className="panel-header-left">
                <div
                  className="panel-icon"
                  style={{ background: expandedMilestoneData.color }}
                >
                  {getMilestoneIcon(expandedMilestoneData.iconName, 18, 'white')}
                </div>
                <div className="panel-title-area">
                  <h3 className="panel-title">{expandedMilestoneData.name}</h3>
                  {currentMilestone === expandedMilestone && (
                    <span className="panel-current-badge" style={{ background: expandedMilestoneData.color }}>
                      Current
                    </span>
                  )}
                </div>
              </div>
              <button className="panel-close-btn" onClick={handleClosePanel}>
                <X size={18} className="close-icon" />
              </button>
            </div>

            {/* Set as Current Button */}
            {currentMilestone !== expandedMilestone && (
              <button
                className="set-current-btn"
                onClick={() => handleSetCurrentMilestone(expandedMilestone)}
                style={{ borderColor: expandedMilestoneData.color, color: expandedMilestoneData.color }}
              >
                <ArrowRight size={14} className="chevron-icon" />
                Set as Current Stage
              </button>
            )}

            {/* Save/Cancel Bar */}
            {hasChanges && (
              <div className="panel-actions-bar">
                <span className="unsaved-text">Unsaved changes</span>
                <div className="panel-actions-btns">
                  <button className="btn-cancel" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </button>
                  <button className="btn-save" onClick={handleSaveChanges} disabled={isSaving}>
                    <FloppyDisk size={14} className="save-icon" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Date Section */}
            <div className="panel-date-section">
              <label className="date-label">
                <Calendar size={14} className="calendar-icon" />
                Target Date
              </label>
              <div className="date-input-row">
                <input
                  type="date"
                  className="date-input"
                  value={localMilestoneDates[expandedMilestone] || ''}
                  onChange={(e) => handleMilestoneDateChange(expandedMilestone, e.target.value)}
                />
                {(() => {
                  const days = getDaysUntilMilestone(localMilestoneDates[expandedMilestone]);
                  const urgency = getMilestoneUrgency(localMilestoneDates[expandedMilestone]);
                  if (days === null) return null;
                  return (
                    <span className={`days-badge ${urgency}`}>
                      <Clock size={12} className="clock-icon" />
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Create Tasks Button */}
            <button
              type="button"
              className="create-tasks-btn"
              onClick={() => handleCreateTodosFromChecklist(expandedMilestone)}
              disabled={isCreatingTodos}
              style={{ borderColor: expandedMilestoneData.color, color: expandedMilestoneData.color }}
            >
              <CheckSquare size={14} className="list-icon" />
              {isCreatingTodos ? 'Creating...' : 'Create Tasks from Checklist'}
            </button>

            {/* Checklist Items */}
            <div className="panel-checklist">
              <h4 className="checklist-heading">Checklist</h4>
              {(CHECKLISTS[expandedMilestone] || []).map((item) => {
                const isChecked = localChecklist[expandedMilestone]?.[item.id] || false;

                return (
                  <label key={item.id} className={`checklist-item ${isChecked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleChecklistToggle(expandedMilestone, item.id, e.target.checked)}
                    />
                    <span
                      className="custom-checkbox"
                      style={{
                        borderColor: isChecked ? expandedMilestoneData.color : '#cbd5e1',
                        background: isChecked ? expandedMilestoneData.color : 'transparent',
                      }}
                    >
                      {isChecked && <CheckmarkIcon />}
                    </span>
                    <span className="item-label">{item.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Documents Section */}
            {REQUIRED_DOCUMENTS[expandedMilestone]?.length > 0 && (
              <div className="panel-documents">
                <h4 className="documents-heading">
                  <File size={14} className="doc-heading-icon" />
                  Required Documents
                </h4>
                <div className="documents-list">
                  {REQUIRED_DOCUMENTS[expandedMilestone].map((doc) => {
                    const docState = customer?.document_checklist?.[expandedMilestone]?.[doc.id] as DocumentChecklistItem | undefined;
                    const status = docState?.status || DOCUMENT_STATUS.PENDING;
                    const uploadedFiles = docState?.uploadedFiles || [];

                    const getStatusIcon = () => {
                      switch (status) {
                        case DOCUMENT_STATUS.UPLOADED:
                          return <UploadSimple size={14} className="doc-icon uploaded" />;
                        case DOCUMENT_STATUS.APPROVED:
                          return <Check size={14} weight="bold" className="doc-icon approved" />;
                        case DOCUMENT_STATUS.REJECTED:
                          return <X size={14} weight="bold" className="doc-icon rejected" />;
                        case DOCUMENT_STATUS.EXPIRED:
                          return <Warning size={14} className="doc-icon expired" />;
                        default:
                          return <Clock size={14} className="doc-icon pending" />;
                      }
                    };

                    return (
                      <div key={doc.id} className={`doc-item ${status}`}>
                        <div className="doc-info">
                          {getStatusIcon()}
                          <span className="doc-name">
                            {doc.name}
                            {doc.required && <span className="required-mark">*</span>}
                          </span>
                        </div>
                        {uploadedFiles.length > 0 && (
                          <span className="doc-count">
                            {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
