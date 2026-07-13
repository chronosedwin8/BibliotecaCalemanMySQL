import { api } from './api.js';

export const multasService = {
  async getPendingTotal(): Promise<number> {
    return api.get<number>('/multas/pending-total');
  },

  async getPendingByUser(userId: string): Promise<number> {
    return api.get<number>(`/multas/user/${userId}/pending`);
  },
};
