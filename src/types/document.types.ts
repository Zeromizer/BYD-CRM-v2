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

// Document template
export interface DocumentTemplate extends Timestamps {
  id: string;
  user_id: string;
  name: string;
  category: DocumentCategory;

  // Storage reference
  image_path: string | null;
  image_url: string | null;  // Cached signed URL

  // Image metadata
  dpi: number;
  width: number | null;
  height: number | null;

  // Field mappings
  fields: FieldMappings;
}

export type DocumentTemplateInsert = Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>;
export type DocumentTemplateUpdate = Partial<Omit<DocumentTemplateInsert, 'user_id'>>;

// Upload result
export interface UploadResult {
  path: string;
  url: string | null;
}
