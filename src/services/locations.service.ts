import { api } from './api.js';
import type { Tables, InsertDto, UpdateDto } from '../types/database.types';

export type Location = Tables<'locations'>;
export type LocationInsert = InsertDto<'locations'>;
export type LocationUpdate = UpdateDto<'locations'>;

export function locationLabel(loc: Location): string {
  return [loc.section, loc.shelf_name, loc.row].filter(Boolean).join(' › ');
}

export const locationsService = {
  async getAll(): Promise<Location[]> {
    return api.get<Location[]>('/locations');
  },

  async getDistinctSections(): Promise<string[]> {
    return api.get<string[]>('/locations/sections');
  },

  async create(loc: { section?: string; shelf_name: string; row?: string; capacity?: number }): Promise<Location> {
    return api.post<Location>('/locations', loc);
  },

  async update(id: number, updates: LocationUpdate): Promise<Location> {
    return api.put<Location>(`/locations/${id}`, updates);
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/locations/${id}`);
  },
};
