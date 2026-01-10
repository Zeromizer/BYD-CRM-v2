/**
 * Todo Store
 * Manages todos with Supabase integration
 *
 * Uses Zustand middleware stack (outer to inner):
 * - devtools: Redux DevTools integration for debugging
 * - persist: localStorage persistence for UI preferences (sidebar, filter)
 * - subscribeWithSelector: Fine-grained subscriptions for performance
 * - immer: Simplified immutable state updates
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { useShallow } from 'zustand/react/shallow'
import { getSupabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Todo, TodoInsert, TodoUpdate, TodoFilter } from '@/types'

interface TodoState {
  todos: Todo[]
  sidebarOpen: boolean
  activeFilter: TodoFilter
  isLoading: boolean
  isSaving: boolean
  error: string | null
  _channel: RealtimeChannel | null
}

interface TodoActions {
  // CRUD
  fetchTodos: () => Promise<void>
  createTodo: (data: Partial<TodoInsert>) => Promise<Todo>
  updateTodo: (id: number, updates: TodoUpdate) => Promise<void>
  deleteTodo: (id: number) => Promise<void>
  toggleTodo: (id: number) => Promise<void>

  // UI
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveFilter: (filter: TodoFilter) => void

  // Realtime
  subscribeToChanges: () => () => void

  // Utility
  clearError: () => void
}

export const useTodoStore = create<TodoState & TodoActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          todos: [],
          sidebarOpen: false,
          activeFilter: 'all',
          isLoading: false,
          isSaving: false,
          error: null,
          _channel: null,

          fetchTodos: async () => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })
            try {
              const { data, error } = await getSupabase()
                .from('todos')
                .select('*')
                .order('created_at', { ascending: false })

              if (error) throw error

              set((state) => {
                state.todos = data as Todo[]
                state.isLoading = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isLoading = false
              })
            }
          },

          createTodo: async (data) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              const supabase = getSupabase()
              const {
                data: { user },
              } = await supabase.auth.getUser()
              if (!user) throw new Error('Not authenticated')

              const todoData: TodoInsert = {
                user_id: user.id,
                text: data.text ?? '',
                completed: false,
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- fallback on empty string is intentional
                priority: data.priority || 'medium',
                due_date: data.due_date ?? null,
                customer_id: data.customer_id ?? null,
                customer_name: data.customer_name ?? null,
                milestone_id: data.milestone_id ?? null,
                checklist_item_id: data.checklist_item_id ?? null,
              }

              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Supabase returns typed data based on table schema
              const { data: newTodo, error } = await supabase
                .from('todos')
                .insert(todoData)
                .select()
                .single()

              if (error) throw error

              set((state) => {
                state.todos.unshift(newTodo as Todo)
                state.isSaving = false
              })

              return newTodo as Todo
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          updateTodo: async (id, updates) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              const { error } = await getSupabase().from('todos').update(updates).eq('id', id)

              if (error) throw error

              set((state) => {
                const index = state.todos.findIndex((t) => t.id === id)
                if (index !== -1) {
                  Object.assign(state.todos[index], updates)
                }
                state.isSaving = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          deleteTodo: async (id) => {
            set((state) => {
              state.isSaving = true
              state.error = null
            })
            try {
              const { error } = await getSupabase().from('todos').delete().eq('id', id)

              if (error) throw error

              set((state) => {
                const index = state.todos.findIndex((t) => t.id === id)
                if (index !== -1) {
                  state.todos.splice(index, 1)
                }
                state.isSaving = false
              })
            } catch (error) {
              set((state) => {
                state.error = (error as Error).message
                state.isSaving = false
              })
              throw error
            }
          },

          toggleTodo: async (id) => {
            const todo = get().todos.find((t) => t.id === id)
            if (todo) {
              await get().updateTodo(id, { completed: !todo.completed })
            }
          },

          setSidebarOpen: (open) => {
            set((state) => {
              state.sidebarOpen = open
            })
          },

          toggleSidebar: () => {
            set((state) => {
              state.sidebarOpen = !state.sidebarOpen
            })
          },

          setActiveFilter: (filter) => {
            set((state) => {
              state.activeFilter = filter
            })
          },

          subscribeToChanges: () => {
            // Clean up existing channel before creating new one
            const existing = get()._channel
            if (existing) {
              void existing.unsubscribe()
            }

            // Use getSupabase() to get current client instance
            const supabase = getSupabase()
            const channel = supabase
              .channel('todos_changes')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'todos' },
                (payload) => {
                  const { eventType } = payload

                  if (eventType === 'INSERT') {
                    set((state) => {
                      state.todos.unshift(payload.new as Todo)
                    })
                  } else if (eventType === 'UPDATE') {
                    set((state) => {
                      const index = state.todos.findIndex((t) => t.id === (payload.new as Todo).id)
                      if (index !== -1) {
                        state.todos[index] = payload.new as Todo
                      }
                    })
                  } else if (eventType === 'DELETE') {
                    set((state) => {
                      const index = state.todos.findIndex((t) => t.id === (payload.old as Todo).id)
                      if (index !== -1) {
                        state.todos.splice(index, 1)
                      }
                    })
                  }
                }
              )
              .subscribe((status) => {
                console.log('[TodoStore] Channel status:', status)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- Supabase channel status is a string enum
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  console.log('[TodoStore] Will reconnect in 3s...')
                  setTimeout(() => get().subscribeToChanges(), 3000)
                }
              })

            set((state) => {
              state._channel = channel
            })

            return () => {
              void channel.unsubscribe()
              set((state) => {
                state._channel = null
              })
            }
          },

          clearError: () =>
            set((state) => {
              state.error = null
            }),
        }))
      ), // close subscribeWithSelector
      {
        name: 'todo-store',
        partialize: (state) => ({
          // Only persist UI preferences, not data (fetched from Supabase)
          sidebarOpen: state.sidebarOpen,
          activeFilter: state.activeFilter,
        }),
      }
    ), // close persist
    { name: 'TodoStore' }
  ) // close devtools
) // close create

// Selector hooks
export const useTodos = () => useTodoStore((state) => state.todos)
export const useTodoSidebarOpen = () => useTodoStore((state) => state.sidebarOpen)
export const useTodoActiveFilter = () => useTodoStore((state) => state.activeFilter)
export const useTodoLoading = () => useTodoStore((state) => state.isLoading)
export const useTodoSaving = () => useTodoStore((state) => state.isSaving)
export const useTodoError = () => useTodoStore((state) => state.error)

// Helper to get today's date string
const getTodayString = () => new Date().toISOString().split('T')[0]

// Filter functions (pure functions for reuse)
const filterTodayTodos = (todos: Todo[], today: string) =>
  todos.filter((t) => t.due_date === today && !t.completed)

const filterOverdueTodos = (todos: Todo[], today: string) =>
  todos.filter((t) => t.due_date && t.due_date < today && !t.completed)

const filterCompletedTodos = (todos: Todo[]) => todos.filter((t) => t.completed)

const filterHighPriorityTodos = (todos: Todo[]) =>
  todos.filter((t) => (t.priority === 'high' || t.priority === 'urgent') && !t.completed)

// Filtered selectors using useShallow for proper array comparison
export const useFilteredTodos = () => {
  const { todos, activeFilter } = useTodoStore(
    useShallow((state) => ({ todos: state.todos, activeFilter: state.activeFilter }))
  )
  const today = getTodayString()

  switch (activeFilter) {
    case 'today':
      return filterTodayTodos(todos, today)
    case 'overdue':
      return filterOverdueTodos(todos, today)
    case 'completed':
      return filterCompletedTodos(todos)
    case 'high_priority':
      return filterHighPriorityTodos(todos)
    default:
      return todos
  }
}

export const useCustomerTodos = (customerId: number) => {
  const todos = useTodoStore(useShallow((state) => state.todos))
  return todos.filter((t) => t.customer_id === customerId)
}

export const useTodayTodos = () => {
  const todos = useTodoStore(useShallow((state) => state.todos))
  const today = getTodayString()
  return filterTodayTodos(todos, today)
}

export const useOverdueTodos = () => {
  const todos = useTodoStore(useShallow((state) => state.todos))
  const today = getTodayString()
  return filterOverdueTodos(todos, today)
}
