/**
 * Authentication type definitions
 */

import type { User, Session } from '@supabase/supabase-js';
import type { UserSettings, Timestamps } from './common.types';

// User profile (extends Supabase auth.users)
export interface Profile extends Timestamps {
  id: string;  // UUID from auth.users
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  settings: UserSettings;
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id' | 'email'>>;

// Auth state
export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

// Auth credentials
export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  displayName: string;
}
