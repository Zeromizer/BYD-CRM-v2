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
  TemplatePage,
} from '@/types';
import { isMultiPageTemplate, getTemplatePages } from '@/types';

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
  createTemplate: (data: Partial<DocumentTemplateInsert> & { pages?: TemplatePage[] }) => Promise<DocumentTemplate>;
  updateTemplate: (id: string, updates: DocumentTemplateUpdate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Selection
  selectTemplate: (id: string | null) => void;

  // Field mappings
  updateFieldMappings: (id: string, fields: FieldMappings) => Promise<void>;

  // Storage
  uploadTemplateImage: (file: File) => Promise<{ path: string; url: string }>;
  uploadTemplateImages: (files: File[]) => Promise<Array<{ path: string; url: string }>>;
  getSignedUrl: (path: string) => Promise<string>;
  deleteTemplateImage: (path: string) => Promise<void>;

  // Multi-page management
  addPageToTemplate: (templateId: string, file: File, position?: number) => Promise<TemplatePage>;
  removePageFromTemplate: (templateId: string, pageId: string) => Promise<void>;
  reorderTemplatePages: (templateId: string, pageIds: string[]) => Promise<void>;
  updatePageFields: (templateId: string, pageId: string, fields: FieldMappings) => Promise<void>;

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

          // Refresh signed URLs for templates with image_path or pages
          const templatesWithUrls = await Promise.all(
            (data || []).map(async (template) => {
              // Handle multi-page templates
              if (template.pages && Array.isArray(template.pages) && template.pages.length > 0) {
                try {
                  const refreshedPages = await Promise.all(
                    template.pages.map(async (page: TemplatePage) => {
                      if (page.image_path) {
                        const { data: urlData, error: urlError } = await supabase.storage
                          .from('document-templates')
                          .createSignedUrl(page.image_path, 3600);
                        if (urlError) {
                          console.error('Error creating signed URL for page:', page.image_path, urlError);
                        }
                        return { ...page, image_url: urlData?.signedUrl || page.image_url };
                      }
                      return page;
                    })
                  );
                  return { ...template, pages: refreshedPages };
                } catch (err) {
                  console.error('Error refreshing page URLs for template:', template.name, err);
                  return template;
                }
              }
              // Handle legacy single-page templates
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

          // Build template data - supports both legacy single-page and multi-page
          const templateData: DocumentTemplateInsert & { pages?: TemplatePage[] | null } = {
            user_id: user.id,
            name: data.name || 'New Template',
            category: data.category || 'other',
            dpi: data.dpi || 300,
            // For multi-page templates, pages contains all data
            // For legacy, use the flat fields
            image_path: data.pages ? null : (data.image_path || null),
            image_url: data.pages ? null : (data.image_url || null),
            width: data.pages ? null : (data.width || null),
            height: data.pages ? null : (data.height || null),
            fields: data.pages ? {} : (data.fields || {}),
            pages: data.pages || null,
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
          // Get template to find image paths
          const template = get().templates.find((t) => t.id === id);

          // Delete from database
          const { error } = await getSupabase().from('document_templates').delete().eq('id', id);

          if (error) throw error;

          // Delete images from storage
          if (template) {
            // Handle multi-page templates
            if (isMultiPageTemplate(template)) {
              await Promise.all(
                template.pages!.map(async (page) => {
                  if (page.image_path) {
                    await get().deleteTemplateImage(page.image_path);
                  }
                })
              );
            }
            // Handle legacy single-page templates
            else if (template.image_path) {
              await get().deleteTemplateImage(template.image_path);
            }
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

      // Upload multiple images at once (for multi-page templates)
      uploadTemplateImages: async (files) => {
        const results = await Promise.all(
          files.map((file) => get().uploadTemplateImage(file))
        );
        return results;
      },

      // Add a page to an existing template
      addPageToTemplate: async (templateId, file, position) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) throw new Error('Template not found');

        // Upload the image
        const { path, url } = await get().uploadTemplateImage(file);

        // Create new page object
        const newPage: TemplatePage = {
          id: `page_${Date.now()}`,
          page_number: position || (getTemplatePages(template).length + 1),
          image_path: path,
          image_url: url,
          width: null,
          height: null,
          fields: {},
        };

        // Get existing pages
        const existingPages = getTemplatePages(template);
        const updatedPages = [...existingPages];

        // Insert at position or append
        if (position !== undefined && position <= updatedPages.length) {
          updatedPages.splice(position - 1, 0, newPage);
          // Renumber pages
          updatedPages.forEach((p, i) => {
            p.page_number = i + 1;
          });
        } else {
          updatedPages.push(newPage);
        }

        // Update template
        await get().updateTemplate(templateId, { pages: updatedPages });

        return newPage;
      },

      // Remove a page from a template
      removePageFromTemplate: async (templateId, pageId) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) throw new Error('Template not found');

        const pages = getTemplatePages(template);
        const pageToRemove = pages.find((p) => p.id === pageId);

        if (!pageToRemove) throw new Error('Page not found');

        // Cannot remove the last page
        if (pages.length <= 1) {
          throw new Error('Cannot remove the last page');
        }

        // Delete image from storage
        if (pageToRemove.image_path) {
          await get().deleteTemplateImage(pageToRemove.image_path);
        }

        // Remove page and renumber
        const updatedPages = pages
          .filter((p) => p.id !== pageId)
          .map((p, i) => ({ ...p, page_number: i + 1 }));

        // Update template
        await get().updateTemplate(templateId, { pages: updatedPages });
      },

      // Reorder pages in a template
      reorderTemplatePages: async (templateId, pageIds) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) throw new Error('Template not found');

        const pages = getTemplatePages(template);

        // Reorder pages based on pageIds order
        const reorderedPages = pageIds
          .map((id, index) => {
            const page = pages.find((p) => p.id === id);
            if (!page) return null;
            return { ...page, page_number: index + 1 };
          })
          .filter((p): p is TemplatePage => p !== null);

        if (reorderedPages.length !== pages.length) {
          throw new Error('Invalid page IDs');
        }

        // Update template
        await get().updateTemplate(templateId, { pages: reorderedPages });
      },

      // Update fields for a specific page
      updatePageFields: async (templateId, pageId, fields) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) throw new Error('Template not found');

        const pages = getTemplatePages(template);
        const pageIndex = pages.findIndex((p) => p.id === pageId);

        if (pageIndex === -1) throw new Error('Page not found');

        // Update the page's fields
        const updatedPages = pages.map((p, i) =>
          i === pageIndex ? { ...p, fields } : p
        );

        // Update template
        await get().updateTemplate(templateId, { pages: updatedPages });
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
