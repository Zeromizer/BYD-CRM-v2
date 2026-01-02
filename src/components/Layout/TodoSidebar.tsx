import { useState, useEffect, useMemo } from 'react';
import { X, Clock, Warning, Funnel, Plus, Check, Trash } from '@phosphor-icons/react';
import {
  useTodoStore,
  useTodoSidebarOpen,
  useTodoActiveFilter,
  useTodos,
} from '@/stores';
import { InlineTaskForm } from '@/components/common';
import type { TodoFilter, Priority } from '@/types';
import './Layout.css';

const FILTER_OPTIONS: { value: TodoFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'high_priority', label: 'High Priority' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
};

export function TodoSidebar() {
  const isOpen = useTodoSidebarOpen();
  const activeFilter = useTodoActiveFilter();
  const todos = useTodos();
  const {
    fetchTodos,
    toggleTodo,
    deleteTodo,
    setSidebarOpen,
    setActiveFilter,
    subscribeToChanges,
  } = useTodoStore();
  const [showAddForm, setShowAddForm] = useState(false);

  // Memoize filtered todos to prevent infinite loops
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayTodos = useMemo(
    () => todos.filter((t) => t.due_date === today && !t.completed),
    [todos, today]
  );

  const overdueTodos = useMemo(
    () => todos.filter((t) => t.due_date && t.due_date < today && !t.completed),
    [todos, today]
  );

  const filteredTodos = useMemo(() => {
    switch (activeFilter) {
      case 'today':
        return todayTodos;
      case 'overdue':
        return overdueTodos;
      case 'completed':
        return todos.filter((t) => t.completed);
      case 'high_priority':
        return todos.filter((t) => (t.priority === 'high' || t.priority === 'urgent') && !t.completed);
      default:
        return todos;
    }
  }, [todos, activeFilter, todayTodos, overdueTodos]);

  useEffect(() => {
    fetchTodos();
    const unsubscribe = subscribeToChanges();
    return unsubscribe;
  }, [fetchTodos, subscribeToChanges]);

  if (!isOpen) return null;

  return (
    <>
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      <aside className="todo-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Tasks</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="todo-stats">
          <div className="todo-stat">
            <Clock size={16} className="stat-icon" />
            <span>{todayTodos.length} today</span>
          </div>
          {overdueTodos.length > 0 && (
            <div className="todo-stat overdue">
              <Warning size={16} className="stat-icon" />
              <span>{overdueTodos.length} overdue</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="todo-filters">
          <Funnel size={16} className="filter-icon" />
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`filter-chip ${activeFilter === option.value ? 'active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Add Todo */}
        {showAddForm ? (
          <InlineTaskForm onClose={() => setShowAddForm(false)} />
        ) : (
          <button onClick={() => setShowAddForm(true)} className="add-todo-button">
            <Plus size={16} className="add-icon" />
            <span>Add Task</span>
          </button>
        )}

        {/* Todo List */}
        <div className="todo-list">
          {filteredTodos.length === 0 ? (
            <div className="todo-empty">
              <p>No tasks found</p>
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="todo-checkbox"
                  style={{
                    borderColor: todo.completed ? '#10b981' : PRIORITY_COLORS[todo.priority],
                  }}
                >
                  {todo.completed && <Check size={14} weight="bold" className="check-icon" />}
                </button>
                <div className="todo-content">
                  <p className="todo-text">{todo.text}</p>
                  {todo.customer_name && (
                    <span className="todo-customer">{todo.customer_name}</span>
                  )}
                  {todo.due_date && (
                    <span className="todo-due-date">
                      Due: {new Date(todo.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="todo-delete"
                >
                  <Trash size={16} className="delete-icon" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
