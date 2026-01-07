/**
 * Authentication Store
 * Manages user authentication state with Supabase
 *
 * Uses Zustand middleware stack:
 * - devtools: Redux DevTools integration for debugging
 * - persist: localStorage persistence for session recovery
 * - immer: Simplified immutable state updates
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
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

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        user: null,
        session: null,
        profile: null,
        isLoading: false,
        isInitialized: false,
        error: null,

        initialize: async () => {
          try {
            set((state) => {
              state.isLoading = true;
              state.error = null;
            });

            const supabase = getSupabase();

            // Get current session
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.getSession();

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

              set((state) => {
                state.user = session.user;
                state.session = session;
                state.profile = profile as Profile | null;
                state.isInitialized = true;
                state.isLoading = false;
              });
            } else {
              clearGeminiApiKeyCache();
              set((state) => {
                state.isInitialized = true;
                state.isLoading = false;
              });
            }

            // Set up auth listener
            // IMPORTANT: onAuthStateChange callback must NOT be async and must NOT call
            // other Supabase methods directly - this causes deadlock! Use setTimeout to
            // dispatch async operations outside the callback.
            // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
            supabase.auth.onAuthStateChange((event, session) => {
              if (event === 'SIGNED_IN' && session?.user) {
                // Dispatch async work outside callback to avoid deadlock
                setTimeout(() => {
                  void (async () => {
                    const { data: profile } = await getSupabase()
                      .from('profiles')
                      .select('*')
                      .eq('id', session.user.id)
                      .single();

                    loadGeminiApiKey().catch(console.error);

                    useAuthStore.setState((state) => {
                      state.user = session.user;
                      state.session = session;
                      state.profile = profile as Profile | null;
                    });
                  })();
                }, 0);
              } else if (event === 'SIGNED_OUT') {
                clearGeminiApiKeyCache();
                useAuthStore.setState((state) => {
                  state.user = null;
                  state.session = null;
                  state.profile = null;
                });
              } else if (event === 'TOKEN_REFRESHED' && session) {
                useAuthStore.setState((state) => {
                  state.session = session;
                });
              }
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
              state.isInitialized = true;
            });
          }
        },

        signIn: async ({ email, password }) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const { error } = await getSupabase().auth.signInWithPassword({
              email,
              password,
            });

            if (error) throw error;

            // Profile will be set by the auth state change listener
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        signUp: async ({ email, password, displayName }) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
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
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        signOut: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const { error } = await getSupabase().auth.signOut();
            if (error) throw error;
            clearGeminiApiKeyCache();
            set((state) => {
              state.user = null;
              state.session = null;
              state.profile = null;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        resetPassword: async (email) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        updatePassword: async (newPassword) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const { error } = await getSupabase().auth.updateUser({
              password: newPassword,
            });
            if (error) throw error;
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        updateProfile: async (updates) => {
          const { user } = get();
          if (!user) throw new Error('Not authenticated');

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const { data, error } = await getSupabase()
              .from('profiles')
              .update(updates)
              .eq('id', user.id)
              .select()
              .single();

            if (error) throw error;

            set((state) => {
              state.profile = data as Profile;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = (error as Error).message;
              state.isLoading = false;
            });
            throw error;
          }
        },

        clearError: () =>
          set((state) => {
            state.error = null;
          }),
      })),
      {
        name: 'auth-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states or errors
          // Session is managed by Supabase auth, so we persist user/profile for faster hydration
          user: state.user,
          profile: state.profile,
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// Selector hooks for specific state slices
export const useUser = () => useAuthStore((state) => state.user);
export const useProfile = () => useAuthStore((state) => state.profile);
export const useSession = () => useAuthStore((state) => state.session);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.session);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthInitialized = () => useAuthStore((state) => state.isInitialized);
