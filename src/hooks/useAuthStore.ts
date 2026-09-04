import { create } from 'zustand';
import { api, setToken, clearToken } from '../services/api.js';
import type { Tables } from '../types/database.types';

type Profile = Tables<'profiles'>;

interface AuthState {
  user: Profile | null;
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

    // Si la respuesta no trae token+perfil no es nuestra API (p. ej. otro
    // servicio ocupando el puerto). Fallar aquí evita un "login" que parece
    // exitoso pero deja la sesión vacía y rebota al /login.
    if (!res?.token || !res?.profile) {
      throw new Error('Respuesta inesperada del servidor. Verifica que la API de Biblioteca esté corriendo en VITE_API_URL.');
    }

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
