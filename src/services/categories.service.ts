import { api } from './api.js';
import type { Tables } from '../types/database.types';

export type Category = Tables<'categories'>;

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    return api.get<Category[]>('/categories');
  },
};
