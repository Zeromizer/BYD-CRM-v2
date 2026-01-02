/**
 * Supabase client configuration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

const supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Get the Supabase client instance.
 */
export function getSupabase(): SupabaseClient {
  return supabaseInstance;
}

/**
 * @deprecated Use getSupabase() instead.
 */
export const supabase = supabaseInstance;

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await getSupabase().auth.getUser();
  return user?.id ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session !== null;
}
