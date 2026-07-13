import { api } from './api.js';

export type CatalogType = 'niveles' | 'cursos' | 'secciones';

export const catalogValuesService = {
  async get(type: CatalogType): Promise<string[]> {
    return api.get<string[]>(`/config/catalog/${type}`);
  },

  async set(type: CatalogType, values: string[]): Promise<void> {
    await api.put(`/config/catalog/${type}`, values);
  },

  async add(type: CatalogType, value: string): Promise<string[]> {
    const current = await this.get(type);
    if (current.includes(value.trim())) return current;
    const updated = [...current, value.trim()].sort();
    await this.set(type, updated);
    return updated;
  },

  async remove(type: CatalogType, value: string): Promise<string[]> {
    const current = await this.get(type);
    const updated = current.filter(v => v !== value);
    await this.set(type, updated);
    return updated;
  },

  async getAll(): Promise<Record<CatalogType, string[]>> {
    const [niveles, cursos, secciones] = await Promise.all([
      this.get('niveles'),
      this.get('cursos'),
      this.get('secciones'),
    ]);
    return { niveles, cursos, secciones };
  },
};
