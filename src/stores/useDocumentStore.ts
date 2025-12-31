/**
 * Document Template Store
 * Manages document templates with Supabase integration
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { DocumentTemplate, DocumentTemplateInsert, DocumentTemplateUpdate, FieldMappings, DocumentCategory } from '@/types';

interface DocumentState {
  templates: DocumentTemplate[];
  selectedTemplateId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
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

export const useDocumentStore = create<DocumentState & DocumentActions>((set, get) => ({
  templates: [],
  selectedTemplateId: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
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

      set({ templates: templatesWithUrls as DocumentTemplate[], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchTemplateById: async (id) => {
    try {
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
      set({ error: (error as Error).message });
      return null;
    }
  },

  createTemplate: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      set((state) => ({
        templates: [newTemplate as DocumentTemplate, ...state.templates],
        isSaving: false,
      }));

      return newTemplate as DocumentTemplate;
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  updateTemplate: async (id, updates) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await supabase
        .from('document_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    set({ isSaving: true, error: null });
    try {
      // Get template to find image path
      const template = get().templates.find((t) => t.id === id);

      // Delete from database
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Delete image from storage if exists
      if (template?.image_path) {
        await get().deleteTemplateImage(template.image_path);
      }

      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId,
        isSaving: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  selectTemplate: (id) => {
    set({ selectedTemplateId: id });
  },

  updateFieldMappings: async (id, fields) => {
    await get().updateTemplate(id, { fields });
  },

  uploadTemplateImage: async (file) => {
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data, error } = await supabase.storage
      .from('document-templates')
      .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
  },

  deleteTemplateImage: async (path) => {
    const { error } = await supabase.storage
      .from('document-templates')
      .remove([path]);

    if (error) {
      console.error('Error deleting template image:', error);
    }
  },

  subscribeToChanges: () => {
    const channel = supabase
      .channel('document_templates_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_templates' },
        (payload) => {
          const { eventType } = payload;

          if (eventType === 'INSERT') {
            set((state) => ({
              templates: [payload.new as DocumentTemplate, ...state.templates],
            }));
          } else if (eventType === 'UPDATE') {
            set((state) => ({
              templates: state.templates.map((t) =>
                t.id === (payload.new as DocumentTemplate).id ? (payload.new as DocumentTemplate) : t
              ),
            }));
          } else if (eventType === 'DELETE') {
            set((state) => ({
              templates: state.templates.filter((t) => t.id !== (payload.old as DocumentTemplate).id),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },

  clearError: () => set({ error: null }),
}));

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
