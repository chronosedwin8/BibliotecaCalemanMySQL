import { create } from 'zustand';
import { api, setToken, clearToken } from '../services/api.js';
import type { Tables } from '../types/database.types';

type Profile = Tables<'profiles'>;

interface AuthState {
  user: Profile | null;       // unified: no longer a separate Supabase User object
  profile: Profile | null;
  loading: boolean;
  setUser: (user: Profile | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:    null,
  profile: null,
  loading: true,

  setUser:    (user)    => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    try {
      const profile = await api.get<Profile>(`/users/${userId}`);
      set({ profile, user: profile, loading: false });
    } catch {
      set({ profile: null, user: null, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    const res = await api.post<{ token: string; profile: Profile }>('/auth/login', { email, password });
    setToken(res.token);
    set({ user: res.profile, profile: res.profile, loading: false });
  },

  signOut: async () => {
    clearToken();
    set({ user: null, profile: null });
  },

  initialize: () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ loading: false });
      return () => {};
    }

    // Validate token by fetching current user
    api.get<Profile>('/auth/me')
      .then(profile => set({ user: profile, profile, loading: false }))
      .catch(() => {
        clearToken();
        set({ user: null, profile: null, loading: false });
      });

    return () => {};
  },
}));
