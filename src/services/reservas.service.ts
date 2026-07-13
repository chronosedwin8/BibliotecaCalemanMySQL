import { api } from './api.js';
import type { Tables } from '../types/database.types';

export type Reserva = Tables<'reservas'>;

export interface ReservaWithRelations extends Reserva {
  books?: {
    id: string;
    titulo: string;
    autor: string;
    isbn: string | null;
    imagen_portada_url: string | null;
    cantidad_total: number;
    cantidad_disponible: number;
    codigo_barras: string | null;
  } | null;
  profiles?: {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    codigo_identificacion: string | null;
    course: string | null;
    level: string | null;
  } | null;
}

export const reservasService = {
  async getAll(estado?: string): Promise<ReservaWithRelations[]> {
    const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    return api.get<ReservaWithRelations[]>(`/reservas${qs}`);
  },

  async create(libro_id: string, usuario_id: string): Promise<ReservaWithRelations> {
    return api.post<ReservaWithRelations>('/reservas', { libro_id, usuario_id });
  },

  async cancel(reservaId: string): Promise<void> {
    await api.patch(`/reservas/${reservaId}/cancel`);
  },

  async confirm(reservaId: string, dias = 7): Promise<{ ok: boolean; loan_id: string }> {
    return api.patch<{ ok: boolean; loan_id: string }>(`/reservas/${reservaId}/confirm`, { dias });
  },
};
