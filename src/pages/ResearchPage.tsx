import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  BookOpen,
  ExternalLink,
  X,
  Loader2,
  Microscope,
  Globe,
  Database,
  Calendar,
  Tag,
  ChevronDown,
  Users2,
} from 'lucide-react';
import {
  search as searchArticles,
  getStats,
  harvestFromDOAJ,
  type ResearchArticle,
  type ResearchFilters,
} from '../services/research.service';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../hooks/useAuthStore';

// ── Article Detail Modal ───────────────────────────────────────────────────────
interface ArticleModalProps {
  article: ResearchArticle;
  onClose: () => void;
}

const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                article.source === 'local'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {article.source === 'local' ? 'Base Local' : 'DOAJ Live'}
              </span>
              {article.language && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {article.language}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
              {article.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Authors */}
          {article.authors.length > 0 && (
            <div className="flex items-start gap-2">
              <Users2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {article.authors.join('; ')}
              </p>
            </div>
          )}

          {/* Journal + Date */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {article.journal_title && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span className="italic">{article.journal_title}</span>
              </div>
            )}
            {article.publication_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{article.publication_date.slice(0, 4)}</span>
              </div>
            )}
          </div>

          {/* Abstract */}
          {article.abstract && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                Resumen
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {article.abstract}
              </p>
            </div>
          )}

          {/* Keywords */}
          {article.keywords.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1 uppercase tracking-wide">
                <Tag className="w-3.5 h-3.5" /> Palabras clave
              </h3>
              <div className="flex flex-wrap gap-2">
                {article.keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full border border-indigo-200 dark:border-indigo-700">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex gap-3 pt-2">
            {article.doi && (
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver en DOI
              </a>
            )}
            {article.url && !article.doi && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver artículo
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Article Card ──────────────────────────────────────────────────────────────
interface ArticleCardProps {
  article: ResearchArticle;
  onClick: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group">
      {/* Source badge + language */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          article.source === 'local'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {article.source === 'local' ? 'Base Local' : 'DOAJ Live'}
        </span>
        {article.language && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Globe className="w-3 h-3" /> {article.language}
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="font-bold text-gray-900 dark:text-white mb-2 leading-snug cursor-pointer group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2"
        onClick={onClick}
      >
        {article.title}
      </h3>

      {/* Authors */}
      {article.authors.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Users2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{article.authors.slice(0, 3).join(', ')}{article.authors.length > 3 ? ` +${article.authors.length - 3}` : ''}</span>
        </p>
      )}

      {/* Journal + Year */}
      {(article.journal_title || article.publication_date) && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1">
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          <span className="truncate italic">
            {article.journal_title}
            {article.journal_title && article.publication_date ? ' · ' : ''}
            {article.publication_date?.slice(0, 4)}
          </span>
        </p>
      )}

      {/* Abstract preview */}
      {article.abstract && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3 leading-relaxed">
          {article.abstract}
        </p>
      )}

      {/* Keywords chips */}
      {article.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.keywords.slice(0, 4).map((kw, i) => (
            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />{kw}
            </span>
          ))}
          {article.keywords.length > 4 && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <ChevronDown className="w-3 h-3" />+{article.keywords.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer: DOI link */}
      {(article.doi || article.url) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <a
            href={article.doi ? `https://doi.org/${article.doi}` : article.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            {article.doi ? `DOI: ${article.doi.slice(0, 30)}${article.doi.length > 30 ? '…' : ''}` : 'Ver artículo'}
          </a>
          <button
            onClick={onClick}
            className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Ver detalle →
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ResearchPage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.role === 'admin';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<ResearchFilters>({});
  const [results, setResults] = useState<ResearchArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ResearchArticle | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [doajCount, setDoajCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncResult, setSyncResult] = useState<{ saved: number; errors: number } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const queryClient = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['research-stats'],
    queryFn: getStats,
    staleTime: 5 * 60 * 1000,
  });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = useCallback(async (q: string, f: ResearchFilters) => {
    if (q.trim().length < 3) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchArticles(q, f);
      setResults(data);
      setLocalCount(data.filter(a => a.source === 'local').length);
      setDoajCount(data.filter(a => a.source === 'doaj').length);
    } catch (e) {
      console.error('Search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 3) {
      doSearch(debouncedQuery, filters);
    } else if (debouncedQuery.trim().length === 0) {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, filters, doSearch]);

  const handleFilterChange = (key: keyof ResearchFilters, value: string | number | undefined) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Microscope className="w-8 h-8 opacity-90" />
            <h1 className="text-3xl font-bold">Investigación Académica</h1>
          </div>
          <p className="text-indigo-200 mb-8 text-lg max-w-2xl">
            Busca artículos académicos de acceso abierto en nuestra base local y en DOAJ — el directorio mundial de revistas de acceso abierto.
          </p>

          {/* Search Input */}
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar artículos, autores, temas..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim().length >= 3) {
                    setDebouncedQuery(query);
                  }
                }}
              />
            </div>
            <button
              onClick={() => { if (query.trim().length >= 3) setDebouncedQuery(query); }}
              className="px-6 py-3.5 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Buscar
            </button>
          </div>
          {query.length > 0 && query.length < 3 && (
            <p className="text-indigo-300 text-sm mt-2">Escribe al menos 3 caracteres para buscar</p>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Database className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-800 dark:text-white">
              {stats?.totalArticles?.toLocaleString() ?? '—'}
            </span>
            <span>artículos locales</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <BookOpen className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-800 dark:text-white">
              {stats?.totalJournals?.toLocaleString() ?? '—'}
            </span>
            <span>revistas indexadas</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>+ acceso en vivo a DOAJ</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Año
              </label>
              <input
                type="number"
                placeholder="ej. 2023"
                min={1900}
                max={2030}
                value={filters.year ?? ''}
                onChange={(e) => handleFilterChange('year', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Idioma
              </label>
              <select
                value={filters.language ?? 'all'}
                onChange={(e) => handleFilterChange('language', e.target.value === 'all' ? undefined : e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">Todos</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Francés</option>
                <option value="de">Alemán</option>
                <option value="pt">Portugués</option>
              </select>
            </div>

            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Palabra clave específica
              </label>
              <input
                type="text"
                placeholder="ej. machine learning"
                value={filters.keywords ?? ''}
                onChange={(e) => handleFilterChange('keywords', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {(filters.year || filters.language || filters.keywords) && (
              <button
                onClick={() => setFilters({})}
                className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3 text-indigo-500" />
            <span>Buscando en base local y DOAJ...</span>
          </div>
        )}

        {/* Results header */}
        {!loading && hasSearched && results.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-white">{results.length} resultados encontrados</span>
              {' '}
              <span className="text-gray-400">
                ({localCount} locales · {doajCount} de DOAJ)
              </span>
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => setSelectedArticle(article)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-16">
            <Microscope className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Sin resultados
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No encontramos artículos para &ldquo;{debouncedQuery}&rdquo;.
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>Sugerencias:</p>
              <ul className="list-disc inline-block text-left pl-6 space-y-1">
                <li>Prueba términos más generales</li>
                <li>Busca en inglés para más resultados en DOAJ</li>
                <li>Revisa la ortografía</li>
                <li>Elimina filtros activos</li>
              </ul>
            </div>
          </div>
        )}

        {/* Initial state (no search yet) */}
        {!loading && !hasSearched && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-5">
              <Search className="w-9 h-9 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Explora el conocimiento académico
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Ingresa un término de búsqueda para encontrar artículos de acceso abierto en nuestra base local y en DOAJ.
            </p>
          </div>
        )}

        {/* Admin sync section */}
        {isAdmin && (
          <div className="mt-10 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
            <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Panel de Administración — Sincronización DOAJ
            </h3>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 text-sm text-amber-700 dark:text-amber-400 mb-5">
              <div>
                <p className="font-medium mb-1">Artículos en base local</p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                  {stats?.totalArticles?.toLocaleString() ?? '—'}
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Última sincronización</p>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {stats?.lastSync
                    ? new Date(stats.lastSync).toLocaleString('es-ES')
                    : 'Nunca'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {syncing && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 mb-1">
                  <span className="truncate pr-2">{syncMessage}</span>
                  <span className="font-semibold shrink-0">{syncProgress}%</span>
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-900 rounded-full h-2.5">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Result message */}
            {!syncing && syncResult && (
              <div className="mb-4 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2">
                ✓ Sincronización completada: <strong>{syncResult.saved}</strong> artículos guardados
                {syncResult.errors > 0 && `, ${syncResult.errors} errores`}.
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {!syncing ? (
                <button
                  onClick={async () => {
                    setSyncing(true);
                    setSyncResult(null);
                    setSyncProgress(0);
                    setSyncMessage('Iniciando sincronización…');
                    abortRef.current = new AbortController();
                    try {
                      const result = await harvestFromDOAJ({
                        signal: abortRef.current.signal,
                        onProgress: (msg, pct) => {
                          setSyncMessage(msg);
                          setSyncProgress(pct);
                        },
                      });
                      setSyncResult(result);
                      await refetchStats();
                      queryClient.invalidateQueries({ queryKey: ['research-stats'] });
                    } finally {
                      setSyncing(false);
                      abortRef.current = null;
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Sincronizar con DOAJ
                </button>
              ) : (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  );
};

export default ResearchPage;
