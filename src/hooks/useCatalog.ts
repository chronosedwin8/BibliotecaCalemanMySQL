import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { searchCatalog, fetchRecommendations } from '../services/catalogService';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['catalog-search', query.toLowerCase().trim()],
    queryFn: () => searchCatalog(query.trim()),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: ['catalog-recommendations'],
    queryFn: fetchRecommendations,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 2,
  });
}
