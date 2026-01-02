/**
 * TaskItem Component
 * Individual task item with complete, edit, and delete actions
 */

import { useState, useRef, useEffect } from 'react';
import { Check, Circle, Flag, Calendar, DotsThree, Trash } from '@phosphor-icons/react';
import { useTodoStore } from '@/stores/useTodoStore';
import type { Todo, Priority } from '@/types';

interface TaskItemProps {
  task: Todo;
  compact?: boolean;
}

const priorityColors: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export function TaskItem({ task, compact = false }: TaskItemProps) {
  const { toggleTodo, deleteTodo } = useTodoStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleToggle = async () => {
    try {
      await toggleTodo(task.id);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTodo(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      setIsDeleting(false);
    }
  };

  // Format due date
  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, className: 'overdue' };
    if (diffDays === 0) return { text: 'Today', className: 'today' };
    if (diffDays === 1) return { text: 'Tomorrow', className: 'soon' };
    if (diffDays <= 7) return { text: `${diffDays}d`, className: 'upcoming' };
    return { text: dueDate.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }), className: 'future' };
  };

  const dueInfo = formatDueDate(task.due_date);

  return (
    <div className={`task-item ${task.completed ? 'completed' : ''} ${isDeleting ? 'deleting' : ''}`}>
      <button
        className="task-check-btn"
        onClick={handleToggle}
        title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {task.completed ? (
          <Check size={14} weight="bold" className="check-icon completed" />
        ) : (
          <Circle size={14} className="check-icon" />
        )}
      </button>

      <div className="task-content">
        <span className={`task-text ${task.completed ? 'completed' : ''}`}>
          {task.text}
        </span>
        {!compact && (
          <div className="task-meta">
            {task.priority && task.priority !== 'medium' && (
              <span title={`${task.priority} priority`}>
                <Flag
                  size={12}
                  weight="fill"
                  className="task-priority"
                  style={{ color: priorityColors[task.priority] }}
                />
              </span>
            )}
            {dueInfo && (
              <span className={`task-due ${dueInfo.className}`}>
                <Calendar size={12} className="calendar-icon" />
                {dueInfo.text}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="task-actions" ref={menuRef}>
        <button
          className="task-menu-btn"
          onClick={() => setShowMenu(!showMenu)}
          title="More actions"
        >
          <DotsThree size={18} weight="bold" className="menu-icon" />
        </button>

        {showMenu && (
          <div className="task-menu">
            <button
              className="task-menu-item"
              onClick={handleToggle}
            >
              {task.completed ? (
                <>
                  <Circle size={14} className="menu-item-icon" />
                  <span>Mark incomplete</span>
                </>
              ) : (
                <>
                  <Check size={14} className="menu-item-icon" />
                  <span>Mark complete</span>
                </>
              )}
            </button>
            <button
              className="task-menu-item delete"
              onClick={handleDelete}
            >
              <Trash size={14} className="menu-item-icon" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
