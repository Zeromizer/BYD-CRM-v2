/**
 * Excel Template Store
 * Manages Excel templates with Supabase integration
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { ExcelTemplate, ExcelTemplateInsert, ExcelTemplateUpdate, ExcelFieldMappings } from '@/types';

interface ExcelState {
  templates: ExcelTemplate[];
  selectedTemplateId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface ExcelActions {
  // CRUD
  fetchTemplates: () => Promise<void>;
  fetchTemplateById: (id: string) => Promise<ExcelTemplate | null>;
  createTemplate: (data: Partial<ExcelTemplateInsert>) => Promise<ExcelTemplate>;
  updateTemplate: (id: string, updates: ExcelTemplateUpdate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Selection
  selectTemplate: (id: string | null) => void;

  // Field mappings
  updateFieldMappings: (id: string, mappings: ExcelFieldMappings) => Promise<void>;

  // Storage
  uploadExcelFile: (file: File) => Promise<{ path: string; sheetNames: string[] }>;
  downloadExcelFile: (path: string) => Promise<Blob>;
  deleteExcelFile: (path: string) => Promise<void>;

  // Realtime
  subscribeToChanges: () => () => void;

  // Utility
  clearError: () => void;
}

export const useExcelStore = create<ExcelState & ExcelActions>((set, get) => ({
  templates: [],
  selectedTemplateId: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('excel_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ templates: data as ExcelTemplate[], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchTemplateById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('excel_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return data as ExcelTemplate;
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

      const templateData: ExcelTemplateInsert = {
        user_id: user.id,
        name: data.name || 'New Excel Template',
        file_path: data.file_path || null,
        field_mappings: data.field_mappings || {},
        sheet_names: data.sheet_names || [],
      };

      const { data: newTemplate, error } = await supabase
        .from('excel_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        templates: [newTemplate as ExcelTemplate, ...state.templates],
        isSaving: false,
      }));

      return newTemplate as ExcelTemplate;
    } catch (error) {
      set({ error: (error as Error).message, isSaving: false });
      throw error;
    }
  },

  updateTemplate: async (id, updates) => {
    set({ isSaving: true, error: null });
    try {
      const { error } = await supabase
        .from('excel_templates')
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
      // Get template to find file path
      const template = get().templates.find((t) => t.id === id);

      // Delete from database
      const { error } = await supabase
        .from('excel_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Delete file from storage if exists
      if (template?.file_path) {
        await get().deleteExcelFile(template.file_path);
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

  updateFieldMappings: async (id, mappings) => {
    await get().updateTemplate(id, { field_mappings: mappings });
  },

  uploadExcelFile: async (file) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('excel-templates')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // TODO: Parse Excel to get sheet names using xlsx-populate
    // For now, return empty array - will be populated when editing
    const sheetNames: string[] = [];

    return {
      path: filePath,
      sheetNames,
    };
  },

  downloadExcelFile: async (path) => {
    const { data, error } = await supabase.storage
      .from('excel-templates')
      .download(path);

    if (error) throw error;
    return data;
  },

  deleteExcelFile: async (path) => {
    const { error } = await supabase.storage
      .from('excel-templates')
      .remove([path]);

    if (error) {
      console.error('Error deleting Excel file:', error);
    }
  },

  subscribeToChanges: () => {
    const channel = supabase
      .channel('excel_templates_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'excel_templates' },
        (payload) => {
          const { eventType } = payload;

          if (eventType === 'INSERT') {
            set((state) => ({
              templates: [payload.new as ExcelTemplate, ...state.templates],
            }));
          } else if (eventType === 'UPDATE') {
            set((state) => ({
              templates: state.templates.map((t) =>
                t.id === (payload.new as ExcelTemplate).id ? (payload.new as ExcelTemplate) : t
              ),
            }));
          } else if (eventType === 'DELETE') {
            set((state) => ({
              templates: state.templates.filter((t) => t.id !== (payload.old as ExcelTemplate).id),
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
export const useExcelTemplates = () => useExcelStore((state) => state.templates);
export const useSelectedExcelTemplateId = () => useExcelStore((state) => state.selectedTemplateId);
export const useSelectedExcelTemplate = () => {
  const templates = useExcelStore((state) => state.templates);
  const selectedId = useExcelStore((state) => state.selectedTemplateId);
  return templates.find((t) => t.id === selectedId) || null;
};
export const useExcelLoading = () => useExcelStore((state) => state.isLoading);
export const useExcelSaving = () => useExcelStore((state) => state.isSaving);
export const useExcelError = () => useExcelStore((state) => state.error);
