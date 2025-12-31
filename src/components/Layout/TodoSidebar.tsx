import { useEffect, useMemo } from 'react';
import {
  useTodoStore,
  useTodoSidebarOpen,
  useTodoActiveFilter,
  useTodos,
} from '@/stores';
import {
  X,
  Plus,
  Check,
  Clock,
  AlertTriangle,
  Filter,
  Trash2,
} from 'lucide-react';
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
    createTodo,
    toggleTodo,
    deleteTodo,
    setSidebarOpen,
    setActiveFilter,
    subscribeToChanges,
  } = useTodoStore();

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

  const handleAddTodo = async () => {
    const text = prompt('Enter todo:');
    if (text?.trim()) {
      await createTodo({ text: text.trim() });
    }
  };

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
            <Clock size={14} />
            <span>{todayTodos.length} today</span>
          </div>
          {overdueTodos.length > 0 && (
            <div className="todo-stat overdue">
              <AlertTriangle size={14} />
              <span>{overdueTodos.length} overdue</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="todo-filters">
          <Filter size={14} />
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
        <button onClick={handleAddTodo} className="add-todo-button">
          <Plus size={18} />
          <span>Add Task</span>
        </button>

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
                  {todo.completed && <Check size={12} />}
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
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
