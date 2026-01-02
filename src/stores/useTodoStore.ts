/**
 * Todo Store
 * Manages todos with Supabase integration
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Todo, TodoInsert, TodoUpdate, TodoFilter } from '@/types';

interface TodoState {
  todos: Todo[];
  sidebarOpen: boolean;
  activeFilter: TodoFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  _channel: RealtimeChannel | null;
}

interface TodoActions {
  // CRUD
  fetchTodos: () => Promise<void>;
  createTodo: (data: Partial<TodoInsert>) => Promise<Todo>;
  updateTodo: (id: number, updates: TodoUpdate) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;

  // UI
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActiveFilter: (filter: TodoFilter) => void;

  // Realtime
  subscribeToChanges: () => () => void;

  // Utility
  clearError: () => void;
}

export const useTodoStore = create<TodoState & TodoActions>((set, get) => ({
  todos: [],
  sidebarOpen: false,
  activeFilter: 'all',
  isLoading: false,
  isSaving: false,
  error: null,
  _channel: null,

  fetchTodos: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await getSupabase()
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ todos: data as Todo[], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTodo: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const todoData: TodoInsert = {
        user_id: user.id,
        text: data.text || '',
        completed: false,
        priority: data.priority || 'medium',
        due_date: data.due_date || null,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name || null,
        milestone_id: data.milestone_id || null,
        checklist_item_id: data.checklist_item_id || null,
      };

      const { data: newTodo, error } = await supabase
        .from('todos')
        .insert(todoData)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        todos: [newTodo as Todo, ...state.todos],
        isSaving: false,
      }));

      return newTodo as Todo;
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  updateTodo: async (id, updates) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await getSupabase()
        .from('todos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        todos: state.todos.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  deleteTodo: async (id) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await getSupabase()
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        todos: state.todos.filter((t) => t.id !== id),
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (todo) {
      await get().updateTodo(id, { completed: !todo.completed });
    }
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setActiveFilter: (filter) => {
    set({ activeFilter: filter });
  },

  subscribeToChanges: () => {
    // Clean up existing channel before creating new one
    const existing = get()._channel;
    if (existing) {
      existing.unsubscribe();
    }

    // Use getSupabase() to get current client instance
    const supabase = getSupabase();
    const channel = supabase
      .channel('todos_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          const { eventType } = payload;

          if (eventType === 'INSERT') {
            set((state) => ({
              todos: [payload.new as Todo, ...state.todos],
            }));
          } else if (eventType === 'UPDATE') {
            set((state) => ({
              todos: state.todos.map((t) =>
                t.id === (payload.new as Todo).id ? (payload.new as Todo) : t
              ),
            }));
          } else if (eventType === 'DELETE') {
            set((state) => ({
              todos: state.todos.filter((t) => t.id !== (payload.old as Todo).id),
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('[TodoStore] Channel status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[TodoStore] Will reconnect in 3s...');
          setTimeout(() => get().subscribeToChanges(), 3000);
        }
      });

    set({ _channel: channel });

    return () => {
      channel.unsubscribe();
      set({ _channel: null });
    };
  },

  clearError: () => set({ error: null }),
}));

// Selector hooks
export const useTodos = () => useTodoStore((state) => state.todos);
export const useTodoSidebarOpen = () => useTodoStore((state) => state.sidebarOpen);
export const useTodoActiveFilter = () => useTodoStore((state) => state.activeFilter);
export const useTodoLoading = () => useTodoStore((state) => state.isLoading);
export const useTodoSaving = () => useTodoStore((state) => state.isSaving);
export const useTodoError = () => useTodoStore((state) => state.error);

// Helper to get today's date string
const getTodayString = () => new Date().toISOString().split('T')[0];

// Filter functions (pure functions for reuse)
const filterTodayTodos = (todos: Todo[], today: string) =>
  todos.filter((t) => t.due_date === today && !t.completed);

const filterOverdueTodos = (todos: Todo[], today: string) =>
  todos.filter((t) => t.due_date && t.due_date < today && !t.completed);

const filterCompletedTodos = (todos: Todo[]) =>
  todos.filter((t) => t.completed);

const filterHighPriorityTodos = (todos: Todo[]) =>
  todos.filter((t) => (t.priority === 'high' || t.priority === 'urgent') && !t.completed);

// Filtered selectors using useShallow for proper array comparison
export const useFilteredTodos = () => {
  const { todos, activeFilter } = useTodoStore(
    useShallow((state) => ({ todos: state.todos, activeFilter: state.activeFilter }))
  );
  const today = getTodayString();

  switch (activeFilter) {
    case 'today':
      return filterTodayTodos(todos, today);
    case 'overdue':
      return filterOverdueTodos(todos, today);
    case 'completed':
      return filterCompletedTodos(todos);
    case 'high_priority':
      return filterHighPriorityTodos(todos);
    default:
      return todos;
  }
};

export const useCustomerTodos = (customerId: number) => {
  const todos = useTodoStore(useShallow((state) => state.todos));
  return todos.filter((t) => t.customer_id === customerId);
};

export const useTodayTodos = () => {
  const todos = useTodoStore(useShallow((state) => state.todos));
  const today = getTodayString();
  return filterTodayTodos(todos, today);
};

export const useOverdueTodos = () => {
  const todos = useTodoStore(useShallow((state) => state.todos));
  const today = getTodayString();
  return filterOverdueTodos(todos, today);
};
