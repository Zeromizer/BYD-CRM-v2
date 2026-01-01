import { useEffect } from 'react';
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
import {
  Calendar,
  Clock,
  ListTodo,
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Save,
  X,
} from 'lucide-react';
import type { Customer, DocumentChecklistItem } from '@/types';

/**
 * MilestoneTracker - Status Checklist Component
 *
 * ARCHITECTURE:
 * - This component manages the customer's Status Checklist (the source of truth)
 * - Uses local state for editing, saved on explicit "Save" action
 * - "Create Tasks from Checklist" creates todos linked to checklist items
 * - Todos linked to this checklist will automatically reflect completion status
 */

interface MilestoneTrackerProps {
  customer: Customer;
}

export function MilestoneTracker({ customer }: MilestoneTrackerProps) {
  const {
    expandedMilestone,
    currentMilestone,
    localChecklist,
    localMilestoneDates,
    hasChanges,
    isSaving,
    isCreatingTodos,
    setExpandedMilestone,
    handleMilestoneClick,
    handleSetCurrentMilestone,
    handleChecklistToggle,
    handleMilestoneDateChange,
    handleCreateTodosFromChecklist,
    handleSaveChanges,
    handleCancel,
  } = useMilestoneChecklist({ customer });

  // Auto-expand current milestone on first render
  useEffect(() => {
    if (!expandedMilestone) {
      setExpandedMilestone(currentMilestone);
    }
  }, [currentMilestone, expandedMilestone, setExpandedMilestone]);

  return (
    <div className="milestone-tracker-full">
      {/* Save/Cancel Actions Bar */}
      {hasChanges && (
        <div className="milestone-actions-bar">
          <span className="unsaved-indicator">You have unsaved changes</span>
          <div className="milestone-actions-buttons">
            <button className="btn btn-secondary" onClick={handleCancel} disabled={isSaving}>
              <X size={14} />
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveChanges} disabled={isSaving}>
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Current Stage Selector */}
      <div className="current-stage-selector">
        <label>Current Stage:</label>
        <div className="stage-buttons">
          {MILESTONES.map((milestone) => {
            const isCurrent = milestone.id === currentMilestone;
            const isComplete = isMilestoneComplete(milestone.id, localChecklist);

            return (
              <button
                key={milestone.id}
                className={`stage-button ${isCurrent ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                style={{
                  '--stage-color': milestone.color,
                  borderColor: isCurrent ? milestone.color : 'var(--color-border-light)',
                  background: isCurrent ? milestone.color : 'transparent',
                  color: isCurrent ? 'white' : milestone.color,
                } as React.CSSProperties}
                onClick={() => handleSetCurrentMilestone(milestone.id)}
              >
                {getMilestoneIcon(milestone.iconName, 16, isCurrent ? 'white' : milestone.color)}
                <span className="stage-name-full">{milestone.name}</span>
                <span className="stage-name-short">{isCurrent ? milestone.name : milestone.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Checklists */}
      <div className="milestone-checklists">
        {MILESTONES.map((milestone) => {
          const isExpanded = expandedMilestone === milestone.id;
          const items = CHECKLISTS[milestone.id] || [];
          const progress = getMilestoneProgress(milestone.id, localChecklist);
          const isComplete = isMilestoneComplete(milestone.id, localChecklist);
          const isCurrent = milestone.id === currentMilestone;

          return (
            <div
              key={milestone.id}
              className={`checklist-section ${isExpanded ? 'expanded' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <button
                className="checklist-header"
                onClick={() => handleMilestoneClick(milestone.id)}
                style={{ '--milestone-color': milestone.color } as React.CSSProperties}
              >
                <div className="checklist-header-left">
                  <div
                    className={`checklist-indicator ${isComplete ? 'complete' : ''}`}
                    style={{
                      background: isComplete ? milestone.color : 'transparent',
                      borderColor: milestone.color,
                    }}
                  >
                    {isComplete ? (
                      <CheckmarkIcon />
                    ) : (
                      getMilestoneIcon(milestone.iconName, 14, milestone.color)
                    )}
                  </div>
                  <span className="checklist-title" style={{ color: isCurrent ? milestone.color : undefined }}>
                    {milestone.name}
                  </span>
                  {isCurrent && (
                    <span className="current-badge" style={{ background: milestone.color }}>
                      Current
                    </span>
                  )}
                </div>
                <div className="checklist-header-right">
                  <div className="checklist-progress-bar">
                    <div
                      className="checklist-progress-fill"
                      style={{ width: `${progress}%`, background: milestone.color }}
                    />
                  </div>
                  <span className="checklist-progress-text">{progress}%</span>
                  <ChevronDown
                    className={`chevron ${isExpanded ? 'expanded' : ''}`}
                    size={20}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="checklist-items">
                  {/* Milestone Date Input */}
                  <div className="milestone-date-section">
                    <div className="milestone-date-input-row">
                      <label className="milestone-date-label">
                        <Calendar size={14} />
                        Target Date:
                      </label>
                      <input
                        type="date"
                        className="milestone-date-input"
                        value={localMilestoneDates[milestone.id] || ''}
                        onChange={(e) => handleMilestoneDateChange(milestone.id, e.target.value)}
                      />
                      {(() => {
                        const days = getDaysUntilMilestone(localMilestoneDates[milestone.id]);
                        const urgency = getMilestoneUrgency(localMilestoneDates[milestone.id]);
                        if (days === null) return null;
                        return (
                          <span className={`days-remaining ${urgency}`}>
                            <Clock size={12} />
                            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      className="create-todos-btn"
                      onClick={() => handleCreateTodosFromChecklist(milestone.id)}
                      disabled={isCreatingTodos}
                      style={{ '--milestone-color': milestone.color } as React.CSSProperties}
                    >
                      <ListTodo size={14} />
                      {isCreatingTodos ? 'Creating...' : 'Create Tasks from Checklist'}
                    </button>
                  </div>

                  {/* Checklist Items */}
                  {items.map((item) => {
                    const isChecked = localChecklist[milestone.id]?.[item.id] || false;

                    return (
                      <label key={item.id} className={`checklist-item ${isChecked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleChecklistToggle(milestone.id, item.id, e.target.checked)}
                        />
                        <span
                          className="custom-checkbox"
                          style={{
                            borderColor: isChecked ? milestone.color : '#cbd5e1',
                            background: isChecked ? milestone.color : 'transparent',
                          }}
                        >
                          {isChecked && <CheckmarkIcon />}
                        </span>
                        <span className="checklist-item-label">{item.label}</span>
                      </label>
                    );
                  })}

                  {/* Document Status Section */}
                  {REQUIRED_DOCUMENTS[milestone.id]?.length > 0 && (
                    <div className="milestone-documents-section">
                      <div className="milestone-documents-header">
                        <FileText size={14} />
                        <span>Required Documents</span>
                      </div>
                      <div className="milestone-documents-list">
                        {REQUIRED_DOCUMENTS[milestone.id].map((doc) => {
                          const docState = customer?.document_checklist?.[milestone.id]?.[doc.id] as DocumentChecklistItem | undefined;
                          const status = docState?.status || DOCUMENT_STATUS.PENDING;
                          const uploadedFiles = docState?.uploadedFiles || [];

                          const getStatusIcon = () => {
                            switch (status) {
                              case DOCUMENT_STATUS.UPLOADED:
                                return <Upload size={12} className="doc-status-icon uploaded" />;
                              case DOCUMENT_STATUS.APPROVED:
                                return <CheckCircle size={12} className="doc-status-icon approved" />;
                              case DOCUMENT_STATUS.REJECTED:
                                return <XCircle size={12} className="doc-status-icon rejected" />;
                              case DOCUMENT_STATUS.EXPIRED:
                                return <AlertCircle size={12} className="doc-status-icon expired" />;
                              default:
                                return <Clock size={12} className="doc-status-icon pending" />;
                            }
                          };

                          return (
                            <div key={doc.id} className={`milestone-doc-item ${status}`}>
                              <div className="milestone-doc-info">
                                {getStatusIcon()}
                                <span className="milestone-doc-name">
                                  {doc.name}
                                  {doc.required && <span className="doc-required">*</span>}
                                </span>
                              </div>
                              {uploadedFiles.length > 0 && (
                                <span className="milestone-doc-count">
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
