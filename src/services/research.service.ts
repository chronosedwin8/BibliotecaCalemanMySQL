import { api } from './api.js';

export interface ResearchArticle {
  id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  journal_title: string | null;
  publication_date: string | null;
  keywords: string[];
  doi: string | null;
  url: string | null;
  language: string | null;
  source: 'local' | 'doaj';
}

export interface ResearchFilters {
  year?: number;
  language?: string;
  keywords?: string;
}

export interface ResearchStats {
  totalArticles: number;
  totalJournals: number;
  lastSync: string | null;
}

export interface HarvestOptions {
  onProgress?: (message: string, percent: number) => void;
  signal?: AbortSignal;
  maxPages?: number;
}

export interface HarvestResult {
  saved: number;
  errors: number;
}

// ── DOAJ API types ────────────────────────────────────────────────────────────
interface DoajIdentifier { type: string; id: string; }
interface DoajLink { url: string; type?: string; }
interface DoajAuthor { name: string; }
interface DoajBibjson {
  title?: string; abstract?: string; author?: DoajAuthor[];
  journal?: { title?: string }; year?: string; keywords?: string[];
  identifier?: DoajIdentifier[]; link?: DoajLink[];
}
interface DoajResult { id: string; bibjson: DoajBibjson; }
interface DoajResponse { results: DoajResult[]; total?: number; }

function mapDoajResult(item: DoajResult): ResearchArticle {
  const bib = item.bibjson ?? {};
  const doi = bib.identifier?.find(id => id.type === 'doi')?.id ?? null;
  const url = bib.link?.[0]?.url ?? null;
  return {
    id: `doaj-${item.id}`,
    title: bib.title ?? '(Sin título)',
    abstract: bib.abstract ?? null,
    authors: (bib.author ?? []).map(a => a.name).filter(Boolean),
    journal_title: bib.journal?.title ?? null,
    publication_date: bib.year ? `${bib.year}-01-01` : null,
    keywords: bib.keywords ?? [],
    doi, url, language: null, source: 'doaj',
  };
}

export async function searchLocal(query: string, filters: ResearchFilters, limit = 20): Promise<ResearchArticle[]> {
  const params = new URLSearchParams({ q: query, ...(limit ? { limit: String(limit) } : {}) });
  if (filters.year)     params.set('year', String(filters.year));
  if (filters.language && filters.language !== 'all') params.set('language', filters.language);
  if (filters.keywords) params.set('keywords', filters.keywords);
  return api.get<ResearchArticle[]>(`/research/search?${params}`);
}

export async function searchDOAJ(query: string, filters: ResearchFilters, page = 1): Promise<ResearchArticle[]> {
  try {
    let url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=20&page=${page}`;
    if (filters.year) url += `&year=${filters.year}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const json: DoajResponse = await res.json();
    return (json.results ?? []).map(mapDoajResult);
  } catch { return []; }
}

export async function cacheArticles(articles: ResearchArticle[]): Promise<void> {
  if (!articles.length) return;
  try {
    await api.post('/research/cache', articles);
  } catch (e) { console.error('cacheArticles error:', e); }
}

export async function search(query: string, filters: ResearchFilters): Promise<ResearchArticle[]> {
  const localResults = await searchLocal(query, filters);
  if (localResults.length >= 5) return localResults;

  const doajResults = await searchDOAJ(query, filters);
  if (doajResults.length > 0) cacheArticles(doajResults).catch(e => console.error('Cache error:', e));

  const seen = new Set(localResults.map(a => a.id));
  const combined = [...localResults];
  for (const a of doajResults) {
    if (!seen.has(a.id)) { seen.add(a.id); combined.push(a); }
  }
  return combined;
}

export async function getStats(): Promise<ResearchStats> {
  return api.get<ResearchStats>('/research/stats');
}

const HARVEST_QUERIES = ['education','science','technology','medicine','history','literature','mathematics','engineering','psychology','economics'];

export async function harvestFromDOAJ(opts: HarvestOptions = {}): Promise<HarvestResult> {
  const { onProgress, signal, maxPages = 5 } = opts;
  let saved = 0, errors = 0;
  const totalSteps = HARVEST_QUERIES.length * maxPages;
  let step = 0;

  for (const topic of HARVEST_QUERIES) {
    for (let page = 1; page <= maxPages; page++) {
      if (signal?.aborted) { onProgress?.('Sincronización cancelada.', Math.round((step/totalSteps)*100)); return { saved, errors }; }
      step++;
      onProgress?.(`Descargando "${topic}" — página ${page}/${maxPages}…`, Math.round((step/totalSteps)*100));
      try {
        const articles = await searchDOAJ(topic, {}, page);
        if (!articles.length) break;
        await cacheArticles(articles);
        saved += articles.length;
      } catch { errors++; }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  onProgress?.(`Sincronización completa. ${saved} artículos guardados.`, 100);
  return { saved, errors };
}

export async function getAutocompleteSuggestions(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  return api.get<string[]>(`/research/autocomplete?q=${encodeURIComponent(query)}`);
}
