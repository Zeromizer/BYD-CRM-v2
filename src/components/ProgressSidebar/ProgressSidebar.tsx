/**
 * ProgressSidebar Component
 * Right-side panel showing customer progress, next steps, milestones, and tasks
 */

import { useState, useMemo, useEffect } from 'react';
import {
  MILESTONES,
  CHECKLISTS,
  getMilestoneProgress,
  isMilestoneComplete,
} from '@/constants/milestones';
import { useMilestoneChecklist } from '@/hooks';
import { getMilestoneIcon, CheckmarkIcon } from '@/utils';
import { useTodoStore } from '@/stores/useTodoStore';
import { InlineTaskForm } from '@/components/common';
import { TaskItem } from './TaskItem';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Circle,
  CheckCircle2,
  ListTodo,
  Save,
  CheckSquare,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Customer, MilestoneId } from '@/types';
import './ProgressSidebar.css';

interface ProgressSidebarProps {
  customer: Customer;
}

export function ProgressSidebar({ customer }: ProgressSidebarProps) {
  const {
    currentMilestone,
    localChecklist,
    hasChanges,
    isSaving,
    handleSetCurrentMilestone,
    handleChecklistToggle,
    handleSaveChanges,
    handleCancel,
  } = useMilestoneChecklist({ customer, resetExpandedOnCustomerChange: true });

  const { todos, fetchTodos } = useTodoStore();
  const [expandedMilestones, setExpandedMilestones] = useState<Set<MilestoneId>>(new Set());
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Get current milestone data
  const currentMilestoneData = MILESTONES.find((m) => m.id === currentMilestone);

  // Get next steps (uncompleted items from current milestone)
  const nextSteps = useMemo(() => {
    const items = CHECKLISTS[currentMilestone] || [];
    return items.filter((item) => !localChecklist[currentMilestone]?.[item.id]);
  }, [currentMilestone, localChecklist]);

  // Get customer-specific tasks (pending and completed separately)
  const { pendingTasks, completedTasks } = useMemo(() => {
    const customerTodos = todos.filter((todo) => todo.customer_id === customer.id);
    return {
      pendingTasks: customerTodos.filter((todo) => !todo.completed),
      completedTasks: customerTodos.filter((todo) => todo.completed),
    };
  }, [todos, customer.id]);

  // Toggle milestone expansion
  const toggleMilestone = (milestoneId: MilestoneId) => {
    setExpandedMilestones((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  return (
    <div className="progress-sidebar">
      {/* Save/Cancel Bar */}
      {hasChanges && (
        <div className="sidebar-save-bar">
          <span>Unsaved changes</span>
          <div className="sidebar-save-actions">
            <button onClick={handleCancel} disabled={isSaving}>Cancel</button>
            <button className="save-btn" onClick={handleSaveChanges} disabled={isSaving}>
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Progress Section */}
      <div className="sidebar-section progress-section">
        <div className="section-header">
          <ListTodo size={16} />
          <span>PROGRESS</span>
        </div>
        {currentMilestoneData && (
          <button
            className="current-milestone-badge"
            style={{
              backgroundColor: currentMilestoneData.color,
              borderColor: currentMilestoneData.color,
            }}
          >
            {getMilestoneIcon(currentMilestoneData.iconName, 16, 'white')}
            <span>{currentMilestoneData.name}</span>
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Next Steps Section */}
      <div className="sidebar-section next-steps-section">
        <div className="section-header">
          <Circle size={14} />
          <span>NEXT STEPS</span>
        </div>
        <div className="next-steps-list">
          {nextSteps.length > 0 ? (
            nextSteps.map((item) => (
              <label key={item.id} className="next-step-item">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleChecklistToggle(currentMilestone, item.id, true)}
                />
                <span className="step-checkbox">
                  <Circle size={16} />
                </span>
                <span className="step-label">{item.label}</span>
              </label>
            ))
          ) : (
            <div className="all-complete">
              <CheckCircle2 size={16} />
              <span>All steps complete!</span>
            </div>
          )}
        </div>
      </div>

      {/* All Milestones Section */}
      <div className="sidebar-section milestones-section">
        <div className="section-header">
          <ListTodo size={14} />
          <span>ALL MILESTONES</span>
        </div>
        <div className="milestones-list">
          {MILESTONES.map((milestone) => {
            const progress = getMilestoneProgress(milestone.id, localChecklist);
            const isComplete = isMilestoneComplete(milestone.id, localChecklist);
            const isCurrent = milestone.id === currentMilestone;
            const isExpanded = expandedMilestones.has(milestone.id);
            const items = CHECKLISTS[milestone.id] || [];

            return (
              <div key={milestone.id} className="milestone-item">
                <div
                  className={`milestone-row ${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''}`}
                  onClick={() => toggleMilestone(milestone.id)}
                >
                  <div className="milestone-icon-wrapper">
                    {isComplete ? (
                      <div
                        className="milestone-icon complete"
                        style={{ backgroundColor: milestone.color }}
                      >
                        <CheckmarkIcon size={12} />
                      </div>
                    ) : (
                      <div
                        className="milestone-icon"
                        style={{ borderColor: milestone.color, color: milestone.color }}
                      >
                        {getMilestoneIcon(milestone.iconName, 14, milestone.color)}
                      </div>
                    )}
                  </div>
                  <span className="milestone-name">{milestone.shortName}</span>
                  <div className="milestone-progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%`, backgroundColor: milestone.color }}
                    />
                  </div>
                  <span className="milestone-percent">{progress}%</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {isExpanded && (
                  <div className="milestone-checklist">
                    {items.map((item) => {
                      const isChecked = localChecklist[milestone.id]?.[item.id] || false;
                      return (
                        <label
                          key={item.id}
                          className={`checklist-row ${isChecked ? 'checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleChecklistToggle(milestone.id, item.id, e.target.checked)}
                          />
                          <span
                            className="row-checkbox"
                            style={{
                              borderColor: isChecked ? milestone.color : undefined,
                              backgroundColor: isChecked ? milestone.color : undefined,
                            }}
                          >
                            {isChecked && <CheckmarkIcon size={10} />}
                          </span>
                          <span className="row-label">{item.label}</span>
                        </label>
                      );
                    })}
                    {!isCurrent && (
                      <button
                        className="set-current-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetCurrentMilestone(milestone.id);
                        }}
                        style={{ color: milestone.color, borderColor: milestone.color }}
                      >
                        Set as Current
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="sidebar-section tasks-section">
        <div className="section-header">
          <CheckSquare size={14} />
          <span>TASKS</span>
          <div className="section-header-actions">
            {completedTasks.length > 0 && (
              <button
                className="toggle-completed-btn"
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                title={showCompletedTasks ? 'Hide completed' : 'Show completed'}
              >
                {showCompletedTasks ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{completedTasks.length}</span>
              </button>
            )}
            {!showAddTaskForm && (
              <button
                className="add-task-btn"
                onClick={() => setShowAddTaskForm(true)}
                title="Add task"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Inline Add Task Form */}
        {showAddTaskForm && (
          <InlineTaskForm
            onClose={() => setShowAddTaskForm(false)}
            customer={customer}
            defaultMilestone={currentMilestone}
            compact
          />
        )}

        <div className="tasks-list">
          {/* Pending Tasks */}
          {pendingTasks.length > 0 ? (
            pendingTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))
          ) : !showAddTaskForm ? (
            <div className="no-tasks">
              <CheckCircle2 size={16} />
              <span>No pending tasks</span>
            </div>
          ) : null}

          {/* Completed Tasks (toggleable) */}
          {showCompletedTasks && completedTasks.length > 0 && (
            <div className="completed-tasks-section">
              <div className="completed-divider">
                <span>Completed ({completedTasks.length})</span>
              </div>
              {completedTasks.map((task) => (
                <TaskItem key={task.id} task={task} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
