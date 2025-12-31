/**
 * Common type definitions used across the application
 */

// Milestone IDs
export type MilestoneId = 'test_drive' | 'close_deal' | 'registration' | 'delivery' | 'nps';

// Priority levels
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Archive status
export type ArchiveStatus = 'lost' | 'completed' | null;

// Document status
export type DocumentStatus = 'pending' | 'uploaded' | 'approved' | 'rejected' | 'expired' | 'not_applicable';

// Field alignment
export type TextAlign = 'left' | 'center' | 'right';

// PRZ Types for vehicles
export type PrzType = 'P' | 'R' | 'Z' | null;

// Timestamps
export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// User profile settings
export interface UserSettings {
  theme?: 'light' | 'dark';
  notifications?: boolean;
  geminiApiKey?: string;
  [key: string]: unknown;
}
