/**
 * Constants exports
 */

export * from './milestones';
export * from './fieldTypes';
// Note: excelFields.ts has overlapping exports with fieldTypes.ts (FIELD_TYPES, FieldType, getFieldTypesByCategory)
// Import directly from '@/constants/excelFields' when using Excel-specific constants
export {
  CURRENCY_FIELDS,
  PERCENTAGE_FIELDS,
  getFieldLabel,
  CATEGORY_ORDER,
} from './excelFields';
export * from './documentRequirements';
export * from './vehicleData';
