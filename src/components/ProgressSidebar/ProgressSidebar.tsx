/**
 * ProgressSidebar Component
 * Right-side panel showing customer progress, next steps, milestones, and tasks
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { CheckSquare, Circle, CaretDown, FloppyDisk, Check, Eye, Plus } from '@phosphor-icons/react'
import { MILESTONES, CHECKLISTS } from '@/constants/milestones'
import { useMilestoneChecklist } from '@/hooks'
import { getMilestoneIcon } from '@/utils'
import { useTodoStore } from '@/stores/useTodoStore'
import { InlineTaskForm } from '@/components/common'
import { TaskItem } from './TaskItem'
import type { Customer } from '@/types'
import './ProgressSidebar.css'

interface ProgressSidebarProps {
  customer: Customer
  isMobile?: boolean
}

export function ProgressSidebar({ customer, isMobile }: ProgressSidebarProps) {
  const {
    currentMilestone,
    localChecklist,
    hasChanges,
    isSaving,
    handleChecklistToggle,
    handleSetCurrentMilestone,
    handleSaveChanges,
    handleCancel,
  } = useMilestoneChecklist({ customer, resetExpandedOnCustomerChange: true })

  const { todos, fetchTodos } = useTodoStore()
  const [showAddTaskForm, setShowAddTaskForm] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [showMilestoneDropdown, setShowMilestoneDropdown] = useState(false)
  const milestoneDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch todos on mount
  useEffect(() => {
    void fetchTodos()
  }, [fetchTodos])

  // Close milestone dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        milestoneDropdownRef.current &&
        !milestoneDropdownRef.current.contains(event.target as Node)
      ) {
        setShowMilestoneDropdown(false)
      }
    }
    if (showMilestoneDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMilestoneDropdown])

  // Get current milestone data
  const currentMilestoneData = MILESTONES.find((m) => m.id === currentMilestone)

  // Get next steps (uncompleted items from current milestone)
  const nextSteps = useMemo(() => {
    const items = CHECKLISTS[currentMilestone] ?? []
    return items.filter((item) => !localChecklist[currentMilestone]?.[item.id])
  }, [currentMilestone, localChecklist])

  // Get customer-specific tasks (pending and completed separately)
  const { pendingTasks, completedTasks } = useMemo(() => {
    const customerTodos = todos.filter((todo) => todo.customer_id === customer.id)
    return {
      pendingTasks: customerTodos.filter((todo) => !todo.completed),
      completedTasks: customerTodos.filter((todo) => todo.completed),
    }
  }, [todos, customer.id])

  return (
    <div className={`progress-sidebar ${isMobile ? 'mobile' : ''}`}>
      {/* Save/Cancel Bar */}
      {hasChanges && (
        <div className="sidebar-save-bar">
          <span>Unsaved changes</span>
          <div className="sidebar-save-actions">
            <button onClick={handleCancel} disabled={isSaving}>
              Cancel
            </button>
            <button className="save-btn" onClick={handleSaveChanges} disabled={isSaving}>
              <FloppyDisk size={14} className="save-icon" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Progress Section */}
      <div className="sidebar-section progress-section">
        <div className="section-header">
          <CheckSquare size={14} className="section-icon" />
          <span>PROGRESS</span>
        </div>
        <div className="milestone-dropdown-container" ref={milestoneDropdownRef}>
          {currentMilestoneData && (
            <button
              className={`current-milestone-badge ${showMilestoneDropdown ? 'active' : ''}`}
              style={{
                backgroundColor: currentMilestoneData.color,
                borderColor: currentMilestoneData.color,
              }}
              onClick={() => setShowMilestoneDropdown(!showMilestoneDropdown)}
            >
              {getMilestoneIcon(currentMilestoneData.iconName, 16, 'white')}
              <span>{currentMilestoneData.name}</span>
              <CaretDown
                size={12}
                className={`chevron-icon ${showMilestoneDropdown ? 'rotated' : ''}`}
              />
            </button>
          )}
          {showMilestoneDropdown && (
            <div className="milestone-dropdown-menu">
              {MILESTONES.map((milestone) => (
                <button
                  key={milestone.id}
                  className={`milestone-dropdown-item ${milestone.id === currentMilestone ? 'selected' : ''}`}
                  onClick={() => {
                    handleSetCurrentMilestone(milestone.id)
                    setShowMilestoneDropdown(false)
                  }}
                >
                  <span
                    className="milestone-dropdown-icon"
                    style={{ backgroundColor: milestone.color }}
                  >
                    {getMilestoneIcon(milestone.iconName, 14, 'white')}
                  </span>
                  <span className="milestone-dropdown-label">{milestone.name}</span>
                  {milestone.id === currentMilestone && (
                    <Check size={14} weight="bold" className="milestone-dropdown-check" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Next Steps Section */}
      <div className="sidebar-section next-steps-section">
        <div className="section-header">
          <Circle size={14} className="section-icon" />
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
                <Circle size={14} className="step-checkbox" />
                <span className="step-label">{item.label}</span>
              </label>
            ))
          ) : (
            <div className="all-complete">
              <Check size={14} weight="bold" className="complete-icon" />
              <span>All steps complete!</span>
            </div>
          )}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="sidebar-section tasks-section">
        <div className="section-header">
          <CheckSquare size={14} className="section-icon" />
          <span>TASKS</span>
          <div className="section-header-actions">
            {completedTasks.length > 0 && (
              <button
                className="toggle-completed-btn"
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                title={showCompletedTasks ? 'Hide completed' : 'Show completed'}
              >
                <Eye size={14} className="toggle-icon" />
                <span>{completedTasks.length}</span>
              </button>
            )}
            {!showAddTaskForm && (
              <button
                className="add-task-btn"
                onClick={() => setShowAddTaskForm(true)}
                title="Add task"
              >
                <Plus size={14} className="add-icon" />
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
            pendingTasks.map((task) => <TaskItem key={task.id} task={task} />)
          ) : !showAddTaskForm ? (
            <div className="no-tasks">
              <Check size={14} weight="bold" className="complete-icon" />
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
  )
}
