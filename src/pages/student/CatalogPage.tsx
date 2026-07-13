import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Loader2, Globe, Library, MapPin } from 'lucide-react';
import { booksService } from '../../services/books.service';
import type { BookWithRelations } from '../../services/books.service';
import SearchBar from '../../components/catalog/SearchBar';
import CatalogGrid from '../../components/catalog/CatalogGrid';
import RecommendationCarousel from '../../components/catalog/RecommendationCarousel';
import BookModal from '../../components/catalog/BookModal';
import LocalBookModal from '../../components/catalog/LocalBookModal';
import { useSearch, useRecommendations } from '../../hooks/useCatalog';
import type { CatalogItem } from '../../types/catalog.types';

// ── Category colors ────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Literatura:    'bg-blue-100 text-blue-700',
  Ciencias:      'bg-green-100 text-green-700',
  'Matemáticas': 'bg-yellow-100 text-yellow-700',
  Historia:      'bg-red-100 text-red-700',
  Idiomas:       'bg-purple-100 text-purple-700',
  Arte:          'bg-pink-100 text-pink-700',
  'Tecnología':  'bg-cyan-100 text-cyan-700',
  Infantil:      'bg-lime-100 text-lime-700',
};

// ── Local book card ────────────────────────────────────────────────────────────
// Genera la URL de portada: usa la imagen propia si existe, si no busca por ISBN en Open Library
function coverUrl(book: BookWithRelations): string | null {
  if (book.imagen_portada_url) return book.imagen_portada_url;
  const isbn = book.isbn?.trim().replace(/[-\s]/g, '');
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
  return null;
}

const LocalBookCard: React.FC<{ book: BookWithRelations; onClick: () => void }> = ({ book, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const catName = book.categories?.nombre ?? '';
  const catColor = CATEGORY_COLORS[catName] ?? 'bg-gray-100 text-gray-600';
  const imgSrc = coverUrl(book);

  return (
    <button
      onClick={onClick}
      className="flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left overflow-hidden group"
    >
      <div className="relative w-full aspect-[3/4] bg-gray-100 overflow-hidden">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={book.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <BookOpen className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {catName && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold ${catColor}`}>
            {catName}
          </span>
        )}
        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
          book.cantidad_disponible > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {book.cantidad_disponible > 0 ? `${book.cantidad_disponible} disp.` : 'Sin stock'}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{book.titulo}</p>
        <p className="text-xs text-gray-500 truncate">{book.autor}</p>
        {book.editorial && <p className="text-xs text-gray-400 truncate">{book.editorial}</p>}
        {book.resena && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-1 italic leading-snug">
            {book.resena}
          </p>
        )}
        {book.locations && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-md px-1.5 py-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {[book.locations.section, book.locations.shelf_name, book.locations.row ? `Niv. ${book.locations.row}` : ''].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  count?: number;
  loading?: boolean;
}> = ({ icon, title, count, loading }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-blue-500">{icon}</span>
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
    {count !== undefined && count > 0 && (
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
    )}
    {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
  </div>
);

// ── Main CatalogPage ───────────────────────────────────────────────────────────
const CatalogPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSala, setSelectedSala] = useState('');
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<CatalogItem | null>(null);
  const [selectedLocalBook, setSelectedLocalBook] = useState<BookWithRelations | null>(null);

  const isSearching = searchQuery.trim().length >= 2;

  // Local DB books — always loaded (with search when typing)
  const { data: localBooksRaw = [], isLoading: localLoading } = useQuery({
    queryKey: ['books-catalog', searchQuery],
    queryFn: () => booksService.getAll(searchQuery || undefined),
    staleTime: 30 * 1000,
  });

  // Filter by sala client-side
  const localBooks = useMemo(() => {
    if (!selectedSala) return localBooksRaw;
    return localBooksRaw.filter((b) => b.locations?.section === selectedSala);
  }, [localBooksRaw, selectedSala]);

  // Available salas (distinct sections from all loaded books)
  const availableSalas = useMemo(() => {
    const sections = localBooksRaw
      .map((b) => b.locations?.section)
      .filter((s): s is string => !!s);
    return [...new Set(sections)].sort();
  }, [localBooksRaw]);

  // Internet Archive search — only when searching
  const { data: archiveItems = [], isFetching: archiveLoading } = useSearch(searchQuery);

  // Recommendations — only shown when not searching
  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations();

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-800">Catálogo</h1>
        <p className="text-sm text-gray-500">
          Busca en nuestra colección o en Internet Archive
        </p>
      </div>

      <SearchBar onSearch={setSearchQuery} />

      {/* Location filter — only shown when locations exist */}
      {availableSalas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">Sala:</span>
          <button
            onClick={() => setSelectedSala('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedSala === '' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {availableSalas.map((sala) => (
            <button
              key={sala}
              onClick={() => setSelectedSala(sala === selectedSala ? '' : sala)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedSala === sala ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sala}
            </button>
          ))}
        </div>
      )}

      {/* Recommendations: visible only when no active search */}
      {!isSearching && (recsLoading || recommendations.length > 0) && (
        <section>
          <SectionHeader
            icon={<Globe className="w-4 h-4" />}
            title="Recomendados para ti"
            loading={recsLoading}
          />
          <RecommendationCarousel
            items={recommendations}
            isLoading={recsLoading}
            onSelect={setSelectedArchiveItem}
          />
        </section>
      )}

      {/* Local library collection */}
      <section>
        <SectionHeader
          icon={<Library className="w-4 h-4" />}
          title={isSearching ? 'Colección de la Biblioteca' : 'Todos los libros'}
          count={isSearching && localBooks.length > 0 ? localBooks.length : undefined}
          loading={localLoading}
        />

        {localLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : localBooks.length === 0 ? (
          isSearching ? (
            <p className="text-sm text-gray-400 py-4">
              No se encontraron libros en la colección para "<span className="font-medium">{searchQuery}</span>".
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookOpen className="w-12 h-12 mb-3" />
              <p className="text-sm">No hay libros en la colección aún</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {localBooks.map(book => (
              <LocalBookCard
                key={book.id}
                book={book}
                onClick={() => setSelectedLocalBook(book)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Internet Archive results — only when searching */}
      {isSearching && (
        <section>
          <SectionHeader
            icon={<Globe className="w-4 h-4" />}
            title="Resultados de Internet Archive"
            count={archiveItems.length > 0 ? archiveItems.length : undefined}
            loading={archiveLoading && archiveItems.length === 0}
          />
          <CatalogGrid
            items={archiveItems}
            isLoading={archiveLoading && archiveItems.length === 0}
            onSelect={setSelectedArchiveItem}
          />
        </section>
      )}

      {/* Modals */}
      <BookModal item={selectedArchiveItem} onClose={() => setSelectedArchiveItem(null)} />
      <LocalBookModal book={selectedLocalBook} onClose={() => setSelectedLocalBook(null)} />
    </div>
  );
};

export default CatalogPage;
