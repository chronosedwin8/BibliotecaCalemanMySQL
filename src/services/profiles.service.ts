import { api } from './api.js';
import type { Tables } from '../types/database.types';

export type Profile = Tables<'profiles'>;

export const profilesService = {
  async getAll(): Promise<Profile[]> {
    return api.get<Profile[]>('/users/export');
  },

  async search(term: string): Promise<Profile[]> {
    return api.get<Profile[]>(`/users/search?term=${encodeURIComponent(term)}`);
  },

  async getById(id: string): Promise<Profile> {
    return api.get<Profile>(`/users/${id}`);
  },
};
