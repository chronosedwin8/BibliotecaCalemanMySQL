import { searchArchive } from '../utils/archiveService';
import { normalizeArchiveDoc, shuffleArray } from '../utils/normalizer';
import type { CatalogItem } from '../types/catalog.types';
import { api } from './api.js';

const RECOMMENDATION_QUERIES = [
  'children literature', 'math for kids', 'german learning children',
  'english learning kids', 'audiobook children', 'educational kids video', 'kids podcast',
];

export async function searchCatalog(query: string): Promise<CatalogItem[]> {
  try {
    return await api.get<CatalogItem[]>(`/catalog/search?q=${encodeURIComponent(query)}`);
  } catch {
    const docs = await searchArchive(query, 25);
    return docs.map(normalizeArchiveDoc).filter((item): item is CatalogItem => item !== null).slice(0, 20);
  }
}

export async function fetchRecommendations(): Promise<CatalogItem[]> {
  try {
    return await api.get<CatalogItem[]>('/catalog/recommendations');
  } catch {
    const results = await Promise.allSettled(RECOMMENDATION_QUERIES.map(q => searchArchive(q, 5)));
    const allDocs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const seen = new Set<string>();
    const unique = allDocs.filter(doc => {
      if (!doc.identifier || seen.has(doc.identifier)) return false;
      seen.add(doc.identifier); return true;
    });
    return shuffleArray(unique.map(normalizeArchiveDoc).filter((item): item is CatalogItem => item !== null)).slice(0, 10);
  }
}
