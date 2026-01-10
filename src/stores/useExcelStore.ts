/**
 * Excel Template Store
 * Manages Excel templates with Supabase integration
 *
 * Uses Zustand middleware stack (outer to inner):
 * - devtools: Redux DevTools integration for debugging
 * - subscribeWithSelector: Fine-grained subscriptions for performance
 * - immer: Simplified immutable state updates
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getSupabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  ExcelTemplate,
  ExcelTemplateInsert,
  ExcelTemplateUpdate,
  ExcelFieldMappings,
} from '@/types'
import { parseExcelFile } from '@/services/excelService'

interface ExcelState {
  templates: ExcelTemplate[]
  selectedTemplateId: string | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  _channel: RealtimeChannel | null
}

interface ExcelActions {
  // CRUD
  fetchTemplates: () => Promise<void>
  fetchTemplateById: (id: string) => Promise<ExcelTemplate | null>
  createTemplate: (data: Partial<ExcelTemplateInsert>) => Promise<ExcelTemplate>
  updateTemplate: (id: string, updates: ExcelTemplateUpdate) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  // Selection
  selectTemplate: (id: string | null) => void

  // Field mappings
  updateFieldMappings: (id: string, mappings: ExcelFieldMappings) => Promise<void>

  // Storage
  uploadExcelFile: (
    file: File,
    skipParsing?: boolean
  ) => Promise<{ path: string; sheetNames: string[] }>
  downloadExcelFile: (path: string) => Promise<Blob>
  deleteExcelFile: (path: string) => Promise<void>

  // Realtime
  subscribeToChanges: () => () => void

  // Utility
  clearError: () => void
}

export const useExcelStore = create<ExcelState & ExcelActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        templates: [],
        selectedTemplateId: null,
        isLoading: false,
        isSaving: false,
        error: null,
        _channel: null,

        fetchTemplates: async () => {
          set((state) => {
            state.isLoading = true
            state.error = null
          })
          try {
            const { data, error } = await getSupabase()
              .from('excel_templates')
              .select('*')
              .order('created_at', { ascending: false })

            if (error) throw error

            set((state) => {
              state.templates = data as ExcelTemplate[]
              state.isLoading = false
            })
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.isLoading = false
            })
          }
        },

        fetchTemplateById: async (id) => {
          try {
            const { data, error } = await getSupabase()
              .from('excel_templates')
              .select('*')
              .eq('id', id)
              .single()

            if (error) throw error

            return data as ExcelTemplate
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
            })
            return null
          }
        },

        createTemplate: async (data) => {
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

            const templateData: ExcelTemplateInsert = {
              user_id: user.id,
              name: data.name || 'New Excel Template',
              file_path: data.file_path ?? null,
              field_mappings: data.field_mappings ?? {},
              sheet_names: data.sheet_names ?? [],
            }

            const { data: newTemplate, error } = await supabase
              .from('excel_templates')
              .insert(templateData)
              .select()
              .single()

            if (error) throw error

            set((state) => {
              state.templates.unshift(newTemplate as ExcelTemplate)
              state.isSaving = false
            })

            return newTemplate as ExcelTemplate
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message
              state.isSaving = false
            })
            throw error
          }
        },

        updateTemplate: async (id, updates) => {
          set((state) => {
            state.isSaving = true
            state.error = null
          })
          try {
            const { error } = await getSupabase()
              .from('excel_templates')
              .update(updates)
              .eq('id', id)

            if (error) throw error

            set((state) => {
              const index = state.templates.findIndex((t) => t.id === id)
              if (index !== -1) {
                Object.assign(state.templates[index], updates)
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

        deleteTemplate: async (id) => {
          set((state) => {
            state.isSaving = true
            state.error = null
          })
          try {
            // Get template to find file path
            const template = get().templates.find((t) => t.id === id)

            // Delete from database
            const { error } = await getSupabase().from('excel_templates').delete().eq('id', id)

            if (error) throw error

            // Delete file from storage if exists
            if (template?.file_path) {
              await get().deleteExcelFile(template.file_path)
            }

            set((state) => {
              const index = state.templates.findIndex((t) => t.id === id)
              if (index !== -1) {
                state.templates.splice(index, 1)
              }
              if (state.selectedTemplateId === id) {
                state.selectedTemplateId = null
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

        selectTemplate: (id) => {
          set((state) => {
            state.selectedTemplateId = id
          })
        },

        updateFieldMappings: async (id, mappings) => {
          await get().updateTemplate(id, { field_mappings: mappings })
        },

        uploadExcelFile: async (file, skipParsing = false) => {
          const supabase = getSupabase()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          const fileName = `${Date.now()}_${file.name}`
          const filePath = `${user.id}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('excel-templates')
            .upload(filePath, file)

          if (uploadError) throw uploadError

          // Parse Excel to get sheet names (skip if requested, e.g., during imports)
          let sheetNames: string[] = []
          if (!skipParsing) {
            try {
              sheetNames = await parseExcelFile(file)
            } catch (parseError) {
              console.warn('Could not parse Excel file for sheet names:', parseError)
            }
          }

          return {
            path: filePath,
            sheetNames,
          }
        },

        downloadExcelFile: async (path) => {
          const { data, error } = await getSupabase().storage.from('excel-templates').download(path)

          if (error) throw error
          return data
        },

        deleteExcelFile: async (path) => {
          const { error } = await getSupabase().storage.from('excel-templates').remove([path])

          if (error) {
            console.error('Error deleting Excel file:', error)
          }
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
            .channel('excel_templates_changes')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'excel_templates' },
              (payload) => {
                const { eventType } = payload

                if (eventType === 'INSERT') {
                  set((state) => {
                    state.templates.unshift(payload.new as ExcelTemplate)
                  })
                } else if (eventType === 'UPDATE') {
                  set((state) => {
                    const index = state.templates.findIndex(
                      (t) => t.id === (payload.new as ExcelTemplate).id
                    )
                    if (index !== -1) {
                      state.templates[index] = payload.new as ExcelTemplate
                    }
                  })
                } else if (eventType === 'DELETE') {
                  set((state) => {
                    const index = state.templates.findIndex(
                      (t) => t.id === (payload.old as ExcelTemplate).id
                    )
                    if (index !== -1) {
                      state.templates.splice(index, 1)
                    }
                  })
                }
              }
            )
            .subscribe((status) => {
              console.log('[ExcelStore] Channel status:', status)
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.log('[ExcelStore] Will reconnect in 3s...')
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
    { name: 'ExcelStore' }
  ) // close devtools
) // close create

// Selector hooks
export const useExcelTemplates = () => useExcelStore((state) => state.templates)
export const useSelectedExcelTemplateId = () => useExcelStore((state) => state.selectedTemplateId)
export const useSelectedExcelTemplate = () => {
  const templates = useExcelStore((state) => state.templates)
  const selectedId = useExcelStore((state) => state.selectedTemplateId)
  return templates.find((t) => t.id === selectedId) ?? null
}
export const useExcelLoading = () => useExcelStore((state) => state.isLoading)
export const useExcelSaving = () => useExcelStore((state) => state.isSaving)
export const useExcelError = () => useExcelStore((state) => state.error)
