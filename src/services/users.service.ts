import { api } from './api.js';
import type { Tables, UpdateDto } from '../types/database.types';

export type UserProfile = Tables<'profiles'>;
export type UserProfileUpdate = UpdateDto<'profiles'>;

export interface UsersFilter {
  search?: string;
  role?: 'admin' | 'teacher' | 'student';
  course?: string;
  estado?: 'activo' | 'inactivo' | 'suspendido';
}

export interface CreateUserData {
  email: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student';
  codigo_identificacion: string;
  telefono?: string;
  section?: string;
  course?: string;
  level?: string;
  password?: string;
}

export interface BulkImportUserResult {
  created: number;
  updated: number;
  errors: { row: number; codigo: string; message: string }[];
}

export const usersService = {
  async getAll(filters?: UsersFilter): Promise<UserProfile[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.role)   params.set('role', filters.role);
    if (filters?.course) params.set('course', filters.course);
    if (filters?.estado) params.set('estado', filters.estado);
    const qs = params.toString();
    return api.get<UserProfile[]>(`/users${qs ? '?' + qs : ''}`);
  },

  async getAllForExport(): Promise<UserProfile[]> {
    return api.get<UserProfile[]>('/users/export');
  },

  async getById(id: string): Promise<UserProfile> {
    return api.get<UserProfile>(`/users/${id}`);
  },

  async create(userData: CreateUserData): Promise<UserProfile> {
    return api.post<UserProfile>('/users', userData);
  },

  async update(id: string, updates: UserProfileUpdate): Promise<UserProfile> {
    return api.put<UserProfile>(`/users/${id}`, updates);
  },

  async toggleEstado(id: string, nuevoEstado: 'activo' | 'inactivo'): Promise<void> {
    await api.patch(`/users/${id}/estado`, { estado: nuevoEstado });
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.upload<{ url: string }>(`/users/${userId}/avatar`, form);
    // El servidor ya actualiza avatar_url en la BD dentro de /avatar
    return res.url;
  },

  async getDistinctCourses(): Promise<string[]> {
    return api.get<string[]>('/users/courses');
  },

  async bulkImport(
    rows: CreateUserData[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<BulkImportUserResult> {
    onProgress?.(0, rows.length);
    const res = await api.post<BulkImportUserResult>('/users/bulk', rows);
    onProgress?.(rows.length, rows.length);
    return res;
  },
};
