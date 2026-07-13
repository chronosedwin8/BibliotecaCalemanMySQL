import { api } from './api.js';
import type { Tables, InsertDto } from '../types/database.types';

export type Loan = Tables<'loans'>;
export type LoanInsert = InsertDto<'loans'>;

export interface LoanWithRelations extends Loan {
  books?: Tables<'books'> | null;
  profiles?: Tables<'profiles'> | null;
}

export const loansService = {
  async getAll(estado?: string): Promise<LoanWithRelations[]> {
    const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    return api.get<LoanWithRelations[]>(`/loans${qs}`);
  },

  async getByUser(userId: string): Promise<LoanWithRelations[]> {
    return api.get<LoanWithRelations[]>(`/loans/user/${userId}`);
  },

  async getActiveByUser(userId: string): Promise<LoanWithRelations[]> {
    return api.get<LoanWithRelations[]>(`/loans/user/${userId}/active`);
  },

  async create(loan: LoanInsert): Promise<Loan> {
    return api.post<Loan>('/loans', loan);
  },

  async returnBook(loanId: string): Promise<Loan> {
    return api.patch<Loan>(`/loans/${loanId}/return`);
  },

  async renew(loanId: string, newDueDate: string): Promise<Loan> {
    return api.patch<Loan>(`/loans/${loanId}/renew`, { fecha_devolucion_estimada: newDueDate });
  },

  async countActive(): Promise<number> {
    return api.get<number>('/loans/count/active');
  },

  async countOverdue(): Promise<number> {
    return api.get<number>('/loans/count/overdue');
  },
};
