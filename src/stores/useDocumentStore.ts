/**
 * Document Template Store
 * Manages document templates with Supabase integration
 *
 * Uses Zustand middleware stack (outer to inner):
 * - devtools: Redux DevTools integration for debugging
 * - subscribeWithSelector: Fine-grained subscriptions for performance
 * - immer: Simplified immutable state updates
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { getSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  DocumentTemplate,
  DocumentTemplateInsert,
  DocumentTemplateUpdate,
  FieldMappings,
  DocumentCategory,
} from '@/types';

interface DocumentState {
  templates: DocumentTemplate[];
  selectedTemplateId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  _channel: RealtimeChannel | null;
}

interface DocumentActions {
  // CRUD
  fetchTemplates: () => Promise<void>;
  fetchTemplateById: (id: string) => Promise<DocumentTemplate | null>;
  createTemplate: (data: Partial<DocumentTemplateInsert>) => Promise<DocumentTemplate>;
  updateTemplate: (id: string, updates: DocumentTemplateUpdate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Selection
  selectTemplate: (id: string | null) => void;

  // Field mappings
  updateFieldMappings: (id: string, fields: FieldMappings) => Promise<void>;

  // Storage
  uploadTemplateImage: (file: File) => Promise<{ path: string; url: string }>;
  getSignedUrl: (path: string) => Promise<string>;
  deleteTemplateImage: (path: string) => Promise<void>;

  // Realtime
  subscribeToChanges: () => () => void;

  // Utility
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState & DocumentActions>()(
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
          state.isLoading = true;
          state.error = null;
        });
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from('document_templates')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          // Refresh signed URLs for templates with image_path
          const templatesWithUrls = await Promise.all(
            (data || []).map(async (template) => {
              if (template.image_path) {
                try {
                  const { data: urlData } = await supabase.storage
                    .from('document-templates')
                    .createSignedUrl(template.image_path, 3600);
                  return { ...template, image_url: urlData?.signedUrl || template.image_url };
                } catch {
                  return template;
                }
              }
              return template;
            })
          );

          set((state) => {
            state.templates = templatesWithUrls as DocumentTemplate[];
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = (error as Error).message;
            state.isLoading = false;
          });
        }
      },

      fetchTemplateById: async (id) => {
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from('document_templates')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;

          // Refresh signed URL if template has image_path
          if (data?.image_path) {
            try {
              const { data: urlData } = await supabase.storage
                .from('document-templates')
                .createSignedUrl(data.image_path, 3600);
              if (urlData?.signedUrl) {
                data.image_url = urlData.signedUrl;
              }
            } catch {
              // Keep existing URL if refresh fails
            }
          }

          return data as DocumentTemplate;
        } catch (error) {
          set((state) => {
            state.error = (error as Error).message;
          });
          return null;
        }
      },

      createTemplate: async (data) => {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });
        try {
          const supabase = getSupabase();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const templateData: DocumentTemplateInsert = {
            user_id: user.id,
            name: data.name || 'New Template',
            category: data.category || 'other',
            image_path: data.image_path || null,
            image_url: data.image_url || null,
            dpi: data.dpi || 300,
            width: data.width || null,
            height: data.height || null,
            fields: data.fields || {},
          };

          const { data: newTemplate, error } = await supabase
            .from('document_templates')
            .insert(templateData)
            .select()
            .single();

          if (error) throw error;

          set((state) => {
            state.templates.unshift(newTemplate as DocumentTemplate);
            state.isSaving = false;
          });

          return newTemplate as DocumentTemplate;
        } catch (error) {
          set((state) => {
            state.error = (error as Error).message;
            state.isSaving = false;
          });
          throw error;
        }
      },

      updateTemplate: async (id, updates) => {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });
        try {
          const { error } = await getSupabase()
            .from('document_templates')
            .update(updates)
            .eq('id', id);

          if (error) throw error;

          set((state) => {
            const index = state.templates.findIndex((t) => t.id === id);
            if (index !== -1) {
              Object.assign(state.templates[index], updates);
            }
            state.isSaving = false;
          });
        } catch (error) {
          set((state) => {
            state.error = (error as Error).message;
            state.isSaving = false;
          });
          throw error;
        }
      },

      deleteTemplate: async (id) => {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });
        try {
          // Get template to find image path
          const template = get().templates.find((t) => t.id === id);

          // Delete from database
          const { error } = await getSupabase().from('document_templates').delete().eq('id', id);

          if (error) throw error;

          // Delete image from storage if exists
          if (template?.image_path) {
            await get().deleteTemplateImage(template.image_path);
          }

          set((state) => {
            const index = state.templates.findIndex((t) => t.id === id);
            if (index !== -1) {
              state.templates.splice(index, 1);
            }
            if (state.selectedTemplateId === id) {
              state.selectedTemplateId = null;
            }
            state.isSaving = false;
          });
        } catch (error) {
          set((state) => {
            state.error = (error as Error).message;
            state.isSaving = false;
          });
          throw error;
        }
      },

      selectTemplate: (id) => {
        set((state) => {
          state.selectedTemplateId = id;
        });
      },

      updateFieldMappings: async (id, fields) => {
        await get().updateTemplate(id, { fields });
      },

      uploadTemplateImage: async (file) => {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('document-templates')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get signed URL
        const { data: urlData } = await supabase.storage
          .from('document-templates')
          .createSignedUrl(filePath, 3600); // 1 hour

        return {
          path: filePath,
          url: urlData?.signedUrl || '',
        };
      },

      getSignedUrl: async (path) => {
        const { data, error } = await getSupabase()
          .storage.from('document-templates')
          .createSignedUrl(path, 3600);

        if (error) throw error;
        return data.signedUrl;
      },

      deleteTemplateImage: async (path) => {
        const { error } = await getSupabase().storage.from('document-templates').remove([path]);

        if (error) {
          console.error('Error deleting template image:', error);
        }
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
          .channel('document_templates_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'document_templates' },
            (payload) => {
              const { eventType } = payload;

              if (eventType === 'INSERT') {
                set((state) => {
                  state.templates.unshift(payload.new as DocumentTemplate);
                });
              } else if (eventType === 'UPDATE') {
                set((state) => {
                  const index = state.templates.findIndex(
                    (t) => t.id === (payload.new as DocumentTemplate).id
                  );
                  if (index !== -1) {
                    state.templates[index] = payload.new as DocumentTemplate;
                  }
                });
              } else if (eventType === 'DELETE') {
                set((state) => {
                  const index = state.templates.findIndex(
                    (t) => t.id === (payload.old as DocumentTemplate).id
                  );
                  if (index !== -1) {
                    state.templates.splice(index, 1);
                  }
                });
              }
            }
          )
          .subscribe((status) => {
            console.log('[DocumentStore] Channel status:', status);
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('[DocumentStore] Will reconnect in 3s...');
              setTimeout(() => get().subscribeToChanges(), 3000);
            }
          });

        set((state) => {
          state._channel = channel;
        });

        return () => {
          channel.unsubscribe();
          set((state) => {
            state._channel = null;
          });
        };
      },

      clearError: () =>
        set((state) => {
          state.error = null;
        }),
    }))
    ), // close subscribeWithSelector
    { name: 'DocumentStore' }
  ) // close devtools
); // close create

// Selector hooks
export const useDocumentTemplates = () => useDocumentStore((state) => state.templates);
export const useSelectedTemplateId = () => useDocumentStore((state) => state.selectedTemplateId);
export const useSelectedTemplate = () => {
  const templates = useDocumentStore((state) => state.templates);
  const selectedId = useDocumentStore((state) => state.selectedTemplateId);
  return templates.find((t) => t.id === selectedId) || null;
};
export const useDocumentLoading = () => useDocumentStore((state) => state.isLoading);
export const useDocumentSaving = () => useDocumentStore((state) => state.isSaving);
export const useDocumentError = () => useDocumentStore((state) => state.error);

// Filtered selectors
export const useTemplatesByCategory = (category: DocumentCategory) =>
  useDocumentStore((state) => state.templates.filter((t) => t.category === category));
