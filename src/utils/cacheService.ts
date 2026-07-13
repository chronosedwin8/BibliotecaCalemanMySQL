// Cache for catalog is now handled server-side. These stubs maintain
// compatibility with any component that still imports these functions.
import type { CatalogItem } from '../types/catalog.types';

export async function getCachedSearch(_query: string): Promise<CatalogItem[] | null> {
  return null;
}

export async function getCachedRecommendations(): Promise<CatalogItem[] | null> {
  return null;
}
