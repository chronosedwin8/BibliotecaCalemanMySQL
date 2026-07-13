import { api } from './api.js';
import type { Tables, InsertDto, UpdateDto } from '../types/database.types';

export type Book = Tables<'books'>;
export type BookInsert = InsertDto<'books'>;
export type BookUpdate = UpdateDto<'books'>;

export interface BookWithRelations extends Book {
  categories?: Tables<'categories'> | null;
  locations?: Tables<'locations'> | null;
}

export interface BooksFilter {
  search?: string;
  coleccion?: string;
  idioma?: string;
  formato_material?: string;
  estado?: string;
}

export interface BulkImportResult {
  inserted: number;
  errors: string[];
}

export const booksService = {
  async getAll(search?: string, filters?: BooksFilter): Promise<BookWithRelations[]> {
    const params = new URLSearchParams();
    if (search?.trim()) params.set('search', search.trim());
    if (filters?.coleccion)       params.set('coleccion', filters.coleccion);
    if (filters?.idioma)          params.set('idioma', filters.idioma);
    if (filters?.formato_material) params.set('formato_material', filters.formato_material);
    if (filters?.estado)          params.set('estado', filters.estado);
    const qs = params.toString();
    return api.get<BookWithRelations[]>(`/books${qs ? '?' + qs : ''}`);
  },

  async getById(id: string): Promise<BookWithRelations> {
    return api.get<BookWithRelations>(`/books/${id}`);
  },

  async create(book: BookInsert): Promise<Book> {
    return api.post<Book>('/books', book);
  },

  async update(id: string, book: BookUpdate): Promise<Book> {
    return api.put<Book>(`/books/${id}`, book);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/books/${id}`);
  },

  async deleteByCollection(coleccion: string): Promise<number> {
    const res = await api.delete<{ deleted: number }>(`/books?coleccion=${encodeURIComponent(coleccion)}`);
    return res.deleted;
  },

  async getAllForExport(): Promise<BookWithRelations[]> {
    return api.get<BookWithRelations[]>('/books/export');
  },

  async count(): Promise<number> {
    return api.get<number>('/books/count');
  },

  async getDistinctCollections(): Promise<string[]> {
    return api.get<string[]>('/books/collections');
  },

  async getDistinctIdiomas(): Promise<string[]> {
    return api.get<string[]>('/books/idiomas');
  },

  async bulkInsert(
    books: BookInsert[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<BulkImportResult> {
    onProgress?.(0, books.length);
    const res = await api.post<{ inserted: number; errors: string[] }>('/books/bulk', books);
    onProgress?.(books.length, books.length);
    return res;
  },

  async uploadCover(bookId: string, file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.upload<{ url: string }>(`/books/${bookId}/cover`, form);
    // El servidor ya actualiza imagen_portada_url en la BD dentro de /cover
    return res.url;
  },

  async bulkUpsertByCollection(
    coleccion: string,
    books: BookInsert[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<BulkImportResult> {
    await this.deleteByCollection(coleccion);
    return this.bulkInsert(books, onProgress);
  },
};
