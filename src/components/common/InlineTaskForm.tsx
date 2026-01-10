/**
 * InlineTaskForm Component
 * Compact inline form for adding tasks with priority, due date, customer, and milestone selection
 */

import { useState, useRef, useEffect, useTransition } from 'react'
import { CaretDown, Check, X, Flag, Calendar, User, Crosshair } from '@phosphor-icons/react'
import { useTodoStore } from '@/stores/useTodoStore'
import { useCustomerStore } from '@/stores'
import { MILESTONES } from '@/constants/milestones'
import type { Priority, MilestoneId, Customer } from '@/types'
import './InlineTaskForm.css'

interface InlineTaskFormProps {
  onClose: () => void
  /** Pre-selected customer (if adding from customer context) */
  customer?: Customer
  /** Pre-selected milestone */
  defaultMilestone?: MilestoneId
  /** Compact mode - fewer fields visible by default */
  compact?: boolean
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string; shortLabel: string }[] = [
  { value: 'low', label: 'Low', shortLabel: 'L', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', shortLabel: 'M', color: '#3b82f6' },
  { value: 'high', label: 'High', shortLabel: 'H', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', shortLabel: '!', color: '#ef4444' },
]

export function InlineTaskForm({
  onClose,
  customer,
  defaultMilestone,
  compact = false,
}: InlineTaskFormProps) {
  const { createTodo } = useTodoStore()
  const { customers } = useCustomerStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(customer?.id ?? null)
  const [milestoneId, setMilestoneId] = useState<MilestoneId | ''>(defaultMilestone ?? '')
  const [showOptions, setShowOptions] = useState(!compact)
  const [error, setError] = useState<string | null>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        if (!text.trim()) {
          onClose()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [text, onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!text.trim()) {
      setError('Please enter a task')
      inputRef.current?.focus()
      return
    }

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

    startTransition(async () => {
      try {
        await createTodo({
          text: text.trim(),
          priority,
          due_date: dueDate ?? null,
          customer_id: selectedCustomerId,
          customer_name: selectedCustomer?.name ?? null,
          milestone_id: milestoneId ?? null,
        })

        // Reset and close
        setText('')
        setPriority('medium')
        setDueDate('')
        if (!customer) setSelectedCustomerId(null)
        setMilestoneId(defaultMilestone ?? '')
        onClose()
      } catch (err) {
        setError('Failed to create task')
        console.error('Failed to create task:', err)
      }
    })
  }

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0]

  // Quick date buttons
  const setQuickDate = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    setDueDate(date.toISOString().split('T')[0])
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="inline-task-form">
      {/* Main Input Row */}
      <div className="task-input-row">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task..."
          className="task-input"
          disabled={isPending}
        />
        <div className="task-input-actions">
          {!showOptions && (
            <button
              type="button"
              className="expand-options-btn"
              onClick={() => setShowOptions(true)}
              title="More options"
            >
              <CaretDown size={12} className="expand-icon" />
            </button>
          )}
          <button
            type="submit"
            className="submit-task-btn"
            disabled={isPending || !text.trim()}
            title="Add task (Enter)"
          >
            <Check size={14} weight="bold" />
          </button>
          <button type="button" className="cancel-task-btn" onClick={onClose} title="Cancel (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Options Row */}
      {showOptions && (
        <div className="task-options-row">
          {/* Priority Selector */}
          <div className="option-group priority-group">
            <Flag size={14} className="option-icon" />
            <div className="priority-pills">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`priority-pill ${priority === option.value ? 'active' : ''}`}
                  onClick={() => setPriority(option.value)}
                  title={option.label}
                  style={
                    {
                      '--pill-color': option.color,
                    } as React.CSSProperties
                  }
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div className="option-group date-group">
            <Calendar size={14} className="option-icon" />
            <div className="date-options">
              <button
                type="button"
                className={`date-quick-btn ${dueDate === today ? 'active' : ''}`}
                onClick={() => setQuickDate(0)}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-quick-btn ${dueDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'active' : ''}`}
                onClick={() => setQuickDate(1)}
              >
                Tmrw
              </button>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={today}
                className="date-input"
              />
              {dueDate && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => setDueDate('')}
                  title="Clear date"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Customer Selector (only if not pre-selected) */}
          {!customer && (
            <div className="option-group customer-group">
              <User size={14} className="option-icon" />
              <select
                value={selectedCustomerId ?? ''}
                onChange={(e) =>
                  setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                }
                className="option-select"
              >
                <option value="">No customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Milestone Selector */}
          <div className="option-group milestone-group">
            <Crosshair size={14} className="option-icon" />
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value as MilestoneId | '')}
              className="option-select"
            >
              <option value="">No milestone</option>
              {MILESTONES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="task-form-error">{error}</div>}
    </form>
  )
}
