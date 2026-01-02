/**
 * Authentication Store
 * Manages user authentication state with Supabase
 */

import { create } from 'zustand';
import { getSupabase } from '@/lib/supabase';
import { loadGeminiApiKey, clearGeminiApiKeyCache } from '@/services/geminiService';
import type { Profile, AuthState, SignInCredentials, SignUpCredentials } from '@/types';

interface AuthActions {
  initialize: () => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      const supabase = getSupabase();

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (session?.user) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        }

        // Preload Gemini API key
        loadGeminiApiKey().catch(console.error);

        set({
          user: session.user,
          session,
          profile: profile as Profile | null,
          isInitialized: true,
          isLoading: false,
        });
      } else {
        clearGeminiApiKeyCache();
        set({ isInitialized: true, isLoading: false });
      }

      // Set up auth listener
      // IMPORTANT: onAuthStateChange callback must NOT be async and must NOT call
      // other Supabase methods directly - this causes deadlock! Use setTimeout to
      // dispatch async operations outside the callback.
      // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Dispatch async work outside callback to avoid deadlock
          setTimeout(async () => {
            const { data: profile } = await getSupabase()
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            loadGeminiApiKey().catch(console.error);

            useAuthStore.setState({
              user: session.user,
              session,
              profile: profile as Profile | null,
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          clearGeminiApiKeyCache();
          useAuthStore.setState({ user: null, session: null, profile: null });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          useAuthStore.setState({ session });
        }
      });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  signIn: async ({ email, password }) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Profile will be set by the auth state change listener
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  signUp: async ({ email, password, displayName }) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (error) throw error;

      // Note: Profile is created automatically via database trigger
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      clearGeminiApiKeyCache();
      set({ user: null, session: null, profile: null, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updatePassword: async (newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await getSupabase().auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await getSupabase()
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      set({
        profile: data as Profile,
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

// Selector hooks for specific state slices
export const useUser = () => useAuthStore((state) => state.user);
export const useProfile = () => useAuthStore((state) => state.profile);
export const useSession = () => useAuthStore((state) => state.session);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.session);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthInitialized = () => useAuthStore((state) => state.isInitialized);
