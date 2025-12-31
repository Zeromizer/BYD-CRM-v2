/**
 * Excel template type definitions
 */

import type { Timestamps } from './common.types';

// Field mapping for a single cell
export interface CellMapping {
  cell: string;       // Cell reference (e.g., "A1", "B2")
  fieldType: string;  // Field type from FIELD_TYPES
}

// Sheet field mappings
export type SheetFieldMappings = Record<string, string>;  // { "A1": "name", "B2": "phone" }

// All sheets mappings
export type ExcelFieldMappings = Record<string, SheetFieldMappings>;  // { "Sheet1": {...}, "Sheet2": {...} }

// Excel template
export interface ExcelTemplate extends Timestamps {
  id: string;
  user_id: string;
  name: string;

  // Storage reference
  file_path: string | null;

  // Field mappings per sheet
  field_mappings: ExcelFieldMappings;

  // Metadata
  sheet_names: string[];
}

export type ExcelTemplateInsert = Omit<ExcelTemplate, 'id' | 'created_at' | 'updated_at'>;
export type ExcelTemplateUpdate = Partial<Omit<ExcelTemplateInsert, 'user_id'>>;
