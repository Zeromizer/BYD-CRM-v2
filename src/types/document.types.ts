/**
 * Document template type definitions
 */

import type { TextAlign, Timestamps } from './common.types';

// Document categories
export type DocumentCategory = 'vsa' | 'insurance' | 'delivery' | 'test_drive' | 'finance' | 'other';

// Field configuration for document templates
export interface FieldConfig {
  type: string;           // Field type from FIELD_TYPES
  x: number;              // X position (pixels)
  y: number;              // Y position (pixels)
  width: number;          // Text box width
  height: number;         // Text box height
  fontSize: number;       // Font size (pt)
  fontFamily: string;     // Font family
  textAlign: TextAlign;   // Text alignment
  color: string;          // Text color (hex)
  customValue?: string;   // For custom/static text
}

// Field mappings object
export type FieldMappings = Record<string, FieldConfig>;

// Page structure for multi-page templates
export interface TemplatePage {
  id: string;                    // Unique page identifier (e.g., "page_1")
  page_number: number;           // 1-indexed page number
  image_path: string | null;     // Path in Supabase Storage
  image_url: string | null;      // Cached signed URL
  width: number | null;          // Image width in pixels
  height: number | null;         // Image height in pixels
  fields: FieldMappings;         // Fields mapped on this page
}

// Document template
export interface DocumentTemplate extends Timestamps {
  id: string;
  user_id: string;
  name: string;
  category: DocumentCategory;

  // Storage reference (legacy single-page support)
  image_path: string | null;
  image_url: string | null;  // Cached signed URL

  // Image metadata
  dpi: number;
  width: number | null;
  height: number | null;

  // Field mappings (legacy single-page support)
  fields: FieldMappings;

  // Multi-page support (null for legacy single-page templates)
  pages: TemplatePage[] | null;
}

// Check if template uses multi-page structure
export function isMultiPageTemplate(template: DocumentTemplate): boolean {
  // Handle case where pages might be a JSON string from Supabase
  let pages = template.pages
  if (typeof pages === 'string') {
    try {
      pages = JSON.parse(pages)
    } catch {
      return false
    }
  }
  return Array.isArray(pages) && pages.length > 0
}

// Get all pages (normalizes single/multi-page templates)
export function getTemplatePages(template: DocumentTemplate): TemplatePage[] {
  // Handle case where pages might be a JSON string from Supabase
  let pages = template.pages
  if (typeof pages === 'string') {
    try {
      pages = JSON.parse(pages)
    } catch {
      pages = null
    }
  }

  if (Array.isArray(pages) && pages.length > 0) {
    return pages
  }
  // Convert legacy single-page to page array
  return [{
    id: 'page_1',
    page_number: 1,
    image_path: template.image_path,
    image_url: template.image_url,
    width: template.width,
    height: template.height,
    fields: template.fields || {},
  }]
}

// Get total field count across all pages
export function getTotalFieldCount(template: DocumentTemplate): number {
  const pages = getTemplatePages(template);
  return pages.reduce((total, page) => total + Object.keys(page.fields || {}).length, 0);
}

// Get page count for display
export function getPageCount(template: DocumentTemplate): number {
  if (isMultiPageTemplate(template)) {
    return template.pages!.length;
  }
  return template.image_path ? 1 : 0;
}

export type DocumentTemplateInsert = Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>;
export type DocumentTemplateUpdate = Partial<Omit<DocumentTemplateInsert, 'user_id'>>;

// Upload result
export interface UploadResult {
  path: string;
  url: string | null;
}
