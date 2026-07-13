import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, BookIcon, Loader2, Trash2, Pencil, X,
  FileSpreadsheet, Filter, ChevronDown, ChevronUp, Upload, Eye, Download,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { booksService, type BookWithRelations, type BookInsert, type BooksFilter } from '../../services/books.service';
import { categoriesService, type Category } from '../../services/categories.service';
import { locationsService, locationLabel, type Location } from '../../services/locations.service';
import ExcelImportPanel from '../../components/books/ExcelImportPanel';

type Tab = 'libros' | 'importar';

// ─── Main Page ──────────────────────────────────────────────────────────────
const BooksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('libros');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<BooksFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<BookWithRelations | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const { data: allBooks = [], isLoading } = useQuery({
    queryKey: ['books', debouncedSearch, filters],
    queryFn: () => booksService.getAll(debouncedSearch, filters),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesService.getAll(),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['books-collections'],
    queryFn: () => booksService.getDistinctCollections(),
  });

  const { data: idiomas = [] } = useQuery({
    queryKey: ['books-idiomas'],
    queryFn: () => booksService.getDistinctIdiomas(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => booksService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      toast.success('Libro eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = (id: string, titulo: string) => {
    if (window.confirm(`¿Eliminar "${titulo}"?`)) deleteMutation.mutate(id);
  };

  const openCreate = () => {
    setEditingBook(null);
    setShowModal(true);
  };

  const openEdit = (book: BookWithRelations) => {
    setEditingBook(book);
    setShowModal(true);
  };

  // Pagination
  const totalPages = Math.ceil(allBooks.length / PAGE_SIZE);
  const books = allBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean) || debouncedSearch;

  const exportBooks = async () => {
    const toastId = toast.loading('Obteniendo todos los libros…');
    try {
      const data = await booksService.getAllForExport();
      toast.dismiss(toastId);
      if (data.length === 0) { toast.error('No hay libros para exportar'); return; }
    const rows = data.map((b) => ({
      'Barcode': b.codigo_barras ?? '',
      'Título': b.titulo,
      'Autor/es': b.autor,
      'ISBN': b.isbn ?? '',
      'Editorial': b.editorial ?? '',
      'Año Publicación': b.anio_publicacion ?? '',
      'Idioma': b.idioma ?? '',
      'N° Clasificación': b.numero_clasificacion ?? '',
      'Colección': b.coleccion ?? '',
      'N° Inventario': b.numero_inventario ?? '',
      'Formato Material': b.formato_material ?? '',
      'Ejemplar N°': b.numero_ejemplar ?? '',
      'N° de Páginas': b.numero_paginas ?? '',
      'Lugar Publicación': b.lugar_publicacion ?? '',
      'Mención de Serie': b.mencion_serie ?? '',
      'Términos Temáticos': b.terminos_tematicos ?? '',
      'Fecha Ingreso': b.fecha_ingreso ?? '',
      'Fecha Adquisición': b.fecha_adquisicion ?? '',
      'Precio': b.precio ?? '',
      'Orden de Compra': b.orden_compra ?? '',
      'Nota': b.nota ?? '',
      'Reseña': b.resena ?? '',
      'Estado': b.estado,
      'Stock Total': b.cantidad_total,
      'Stock Disponible': b.cantidad_disponible,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libros');
    XLSX.writeFile(wb, `libros_bibliocalem_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${data.length} libros exportados`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message ?? 'Error al exportar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Libros</h2>
          <p className="text-gray-500">Administra el inventario de la biblioteca</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportBooks}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-purple-600" />
            Exportar Excel
          </button>
          <button
            onClick={() => setActiveTab('importar')}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Importar Excel
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Nuevo Libro
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['libros', 'Libros', BookIcon], ['importar', 'Importar Excel', FileSpreadsheet]] as const).map(
          ([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'libros' && allBooks.length > 0 && (
                <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {allBooks.length}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* ── TAB: Libros ── */}
      {activeTab === 'libros' && (
        <>
          {/* Search + Filter bar */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por título, autor, ISBN, clasificación, temas..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  showFilters || Object.values(filters).some(Boolean)
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                  Limpiar
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Colección</label>
                  <select
                    value={filters.coleccion ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, coleccion: e.target.value || undefined })); setPage(1); }}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Todas</option>
                    {collections.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Idioma</label>
                  <select
                    value={filters.idioma ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, idioma: e.target.value || undefined })); setPage(1); }}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Todos</option>
                    {idiomas.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                  <select
                    value={filters.estado ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, estado: e.target.value || undefined })); setPage(1); }}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="disponible">Disponible</option>
                    <option value="prestado">Prestado</option>
                    <option value="dañado">Dañado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                  <select
                    value={filters.formato_material ?? ''}
                    onChange={(e) => { setFilters((f) => ({ ...f, formato_material: e.target.value || undefined })); setPage(1); }}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="Libro">Libro</option>
                    <option value="Anuario">Anuario</option>
                    <option value="Minilibro">Minilibro</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : books.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookIcon className="w-12 h-12 mb-2" />
                <p>No se encontraron libros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Libro</th>
                      <th className="px-4 py-3 font-semibold">Clasificación</th>
                      <th className="px-4 py-3 font-semibold">Colección</th>
                      <th className="px-4 py-3 font-semibold">Ubicación</th>
                      <th className="px-4 py-3 font-semibold">Stock</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {books.map((book) => (
                      <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-11 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <BookIcon className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 dark:text-white truncate max-w-[200px]">{book.titulo}</p>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{book.autor}</p>
                              {book.codigo_barras && <p className="text-xs text-gray-400 font-mono">{book.codigo_barras}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 font-mono whitespace-pre-line leading-tight">
                            {book.numero_clasificacion ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 max-w-[120px] truncate block">
                            {book.coleccion ?? (
                              book.categories ? (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${book.categories.color_hex}20`,
                                    color: book.categories.color_hex,
                                  }}
                                >
                                  {book.categories.nombre}
                                </span>
                              ) : '—'
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {book.locations ? (
                            <div className="text-xs space-y-0.5">
                              {book.locations.section && (
                                <p className="text-gray-700 font-medium">{book.locations.section}</p>
                              )}
                              <p className="text-gray-500">{book.locations.shelf_name}{book.locations.row ? ` · Nivel ${book.locations.row}` : ''}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {book.cantidad_disponible} / {book.cantidad_total}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge estado={book.estado} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(book)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(book.id, book.titulo)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allBooks.length)} de {allBooks.length} libros
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 7) {
                    if (page <= 4) pg = i + 1;
                    else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                    else pg = page - 3 + i;
                  }
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`px-3 py-1.5 border rounded-lg ${
                        pg === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Importar Excel ── */}
      {activeTab === 'importar' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <ExcelImportPanel />
        </div>
      )}

      {/* Book Form Modal */}
      {showModal && (
        <BookFormModal
          book={editingBook}
          categories={categories}
          locations={locations}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// ─── Estado Badge ────────────────────────────────────────────────────────────
const estadoColors: Record<string, string> = {
  disponible: 'bg-green-100 text-green-700',
  prestado: 'bg-blue-100 text-blue-700',
  'dañado': 'bg-orange-100 text-orange-700',
  perdido: 'bg-red-100 text-red-700',
};

const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${estadoColors[estado] ?? 'bg-gray-100 text-gray-700'}`}>
    {estado}
  </span>
);

// ─── Book Cover Upload ────────────────────────────────────────────────────────
function openLibraryCover(isbn: string | null | undefined): string | null {
  const clean = isbn?.trim().replace(/[-\s]/g, '');
  return clean ? `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg` : null;
}

const BookCoverUpload: React.FC<{ bookId: string; currentUrl: string | null; isbn?: string | null; onUploaded?: (url: string) => void }> = ({ bookId, currentUrl, isbn, onUploaded }) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initialPreview = currentUrl ?? openLibraryCover(isbn);
  const [preview, setPreview] = useState<string | null>(initialPreview);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5 MB'); return; }
    setUploading(true);
    try {
      const url = await booksService.uploadCover(bookId, file);
      setPreview(url);
      onUploaded?.(url);
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      toast.success('Portada actualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir portada');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="col-span-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Portada</label>
      <div className="flex items-center gap-4">
        <div className="w-16 h-22 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0 flex items-center justify-center" style={{ height: '88px' }}>
          {preview ? (
            <img src={preview} alt="portada" className="w-full h-full object-cover" onError={() => setPreview(null)} />
          ) : (
            <BookIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {preview ? 'Cambiar portada' : 'Subir portada'}
          </button>
          {preview && (
            <a href={preview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Eye className="w-3.5 h-3.5" /> Ver portada
            </a>
          )}
          <p className="text-xs text-gray-400">JPG, PNG o WebP · máx. 5 MB</p>
        </div>
      </div>
    </div>
  );
};

// ─── Book Form Modal ─────────────────────────────────────────────────────────
interface BookFormModalProps {
  book: BookWithRelations | null;
  categories: Category[];
  locations: Location[];
  onClose: () => void;
}

const EMPTY_FORM = {
  // Core
  titulo: '', autor: '', isbn: '', codigo_barras: '', editorial: '', anio_publicacion: '',
  categoria_id: '', cantidad_total: '1', cantidad_disponible: '1', estado: 'disponible',
  // Extended
  coleccion: '', numero_inventario: '', fecha_ingreso: '', formato_material: '',
  idioma: 'Español', numero_clasificacion: '', titulo_paralelo: '',
  numero_ejemplar: '1', lugar_publicacion: '', mencion_serie: '',
  numero_paginas: '', terminos_tematicos: '', fecha_adquisicion: '',
  precio: '', orden_compra: '', nota: '', resena: '',
};

type FormData = typeof EMPTY_FORM;

const BookFormModal: React.FC<BookFormModalProps> = ({ book, categories, locations, onClose }) => {
  const queryClient = useQueryClient();
  const isEditing = !!book;
  const [section, setSection] = useState<'basico' | 'catalogo' | 'extra'>('basico');

  // Location state
  const [ubicacionId, setUbicacionId] = useState<string>(book?.ubicacion_id?.toString() ?? '');
  const [showNewLoc, setShowNewLoc] = useState(false);
  const [newLoc, setNewLoc] = useState({ section: '', shelf_name: '', row: '' });
  const [creatingLoc, setCreatingLoc] = useState(false);

  // Portada — se rastrea aquí para incluirla en el payload al guardar
  const [coverUrl, setCoverUrl] = useState<string | null>(book?.imagen_portada_url ?? null);

  const [form, setForm] = useState<FormData>(() => ({
    titulo: book?.titulo ?? '',
    autor: book?.autor ?? '',
    isbn: book?.isbn ?? '',
    codigo_barras: book?.codigo_barras ?? '',
    editorial: book?.editorial ?? '',
    anio_publicacion: book?.anio_publicacion?.toString() ?? '',
    categoria_id: book?.categoria_id?.toString() ?? '',
    cantidad_total: book?.cantidad_total?.toString() ?? '1',
    cantidad_disponible: book?.cantidad_disponible?.toString() ?? '1',
    estado: book?.estado ?? 'disponible',
    coleccion: book?.coleccion ?? '',
    numero_inventario: book?.numero_inventario ?? '',
    fecha_ingreso: book?.fecha_ingreso ?? '',
    formato_material: book?.formato_material ?? '',
    idioma: book?.idioma ?? 'Español',
    numero_clasificacion: book?.numero_clasificacion ?? '',
    titulo_paralelo: book?.titulo_paralelo ?? '',
    numero_ejemplar: book?.numero_ejemplar?.toString() ?? '1',
    lugar_publicacion: book?.lugar_publicacion ?? '',
    mencion_serie: book?.mencion_serie ?? '',
    numero_paginas: book?.numero_paginas ?? '',
    terminos_tematicos: book?.terminos_tematicos ?? '',
    fecha_adquisicion: book?.fecha_adquisicion ?? '',
    precio: book?.precio?.toString() ?? '',
    orden_compra: book?.orden_compra ?? '',
    nota: book?.nota ?? '',
    resena: book?.resena ?? '',
  }));

  const set = (field: keyof FormData, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleCreateLocation = async () => {
    if (!newLoc.shelf_name.trim()) { toast.error('El nombre del estante es requerido'); return; }
    setCreatingLoc(true);
    try {
      const created = await locationsService.create(newLoc);
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setUbicacionId(created.id.toString());
      setShowNewLoc(false);
      setNewLoc({ section: '', shelf_name: '', row: '' });
      toast.success('Ubicación creada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear ubicación');
    } finally {
      setCreatingLoc(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: BookInsert = {
        titulo: form.titulo,
        autor: form.autor,
        isbn: form.isbn || null,
        codigo_barras: form.codigo_barras || null,
        editorial: form.editorial || null,
        anio_publicacion: form.anio_publicacion ? parseInt(form.anio_publicacion) : null,
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        cantidad_total: parseInt(form.cantidad_total) || 1,
        cantidad_disponible: parseInt(form.cantidad_disponible) || 1,
        estado: form.estado as BookInsert['estado'],
        coleccion: form.coleccion || null,
        numero_inventario: form.numero_inventario || null,
        fecha_ingreso: form.fecha_ingreso || null,
        formato_material: form.formato_material || null,
        idioma: form.idioma || null,
        numero_clasificacion: form.numero_clasificacion || null,
        titulo_paralelo: form.titulo_paralelo || null,
        numero_ejemplar: form.numero_ejemplar ? parseInt(form.numero_ejemplar) : null,
        lugar_publicacion: form.lugar_publicacion || null,
        mencion_serie: form.mencion_serie || null,
        numero_paginas: form.numero_paginas || null,
        terminos_tematicos: form.terminos_tematicos || null,
        fecha_adquisicion: form.fecha_adquisicion || null,
        precio: form.precio ? parseFloat(form.precio) : null,
        orden_compra: form.orden_compra || null,
        nota: form.nota || null,
        resena: form.resena || null,
        ubicacion_id: ubicacionId ? parseInt(ubicacionId) : null,
        imagen_portada_url: coverUrl || null,
      };
      if (isEditing) return booksService.update(book.id, payload);
      return booksService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      toast.success(isEditing ? 'Libro actualizado' : 'Libro creado');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.autor) {
      toast.error('Título y autor son obligatorios');
      return;
    }
    mutation.mutate();
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

  const sectionTabs: Array<['basico' | 'catalogo' | 'extra', string]> = [
    ['basico', 'Básico'],
    ['catalogo', 'Catalogación'],
    ['extra', 'Adicional'],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">{isEditing ? 'Editar Libro' : 'Nuevo Libro'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {sectionTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                section === id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* ── Básico ── */}
            {section === 'basico' && (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className={labelCls}>Título *</label>
                    <input type="text" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Autor/es *</label>
                    <input type="text" value={form.autor} onChange={(e) => set('autor', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Título Paralelo</label>
                    <input type="text" value={form.titulo_paralelo} onChange={(e) => set('titulo_paralelo', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Barcode</label>
                    <input type="text" value={form.codigo_barras} onChange={(e) => set('codigo_barras', e.target.value)} className={inputCls} placeholder="Ej: T 19196" />
                  </div>
                  <div>
                    <label className={labelCls}>ISBN</label>
                    <input type="text" value={form.isbn} onChange={(e) => set('isbn', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>N° Inventario</label>
                    <input type="text" value={form.numero_inventario} onChange={(e) => set('numero_inventario', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Editorial</label>
                    <input type="text" value={form.editorial} onChange={(e) => set('editorial', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Año publicación</label>
                    <input type="number" value={form.anio_publicacion} onChange={(e) => set('anio_publicacion', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Ejemplar N°</label>
                    <input type="number" min="1" value={form.numero_ejemplar} onChange={(e) => set('numero_ejemplar', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>N° de Páginas</label>
                    <input type="text" value={form.numero_paginas} onChange={(e) => set('numero_paginas', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Categoría</label>
                    <select value={form.categoria_id} onChange={(e) => set('categoria_id', e.target.value)} className={inputCls}>
                      <option value="">Sin categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Stock total</label>
                    <input type="number" min="1" value={form.cantidad_total} onChange={(e) => set('cantidad_total', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Disponibles</label>
                    <input type="number" min="0" value={form.cantidad_disponible} onChange={(e) => set('cantidad_disponible', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className={inputCls}>
                    <option value="disponible">Disponible</option>
                    <option value="prestado">Prestado</option>
                    <option value="dañado">Dañado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>Reseña (máx. 300 caracteres)</label>
                  <textarea
                    value={form.resena}
                    onChange={(e) => set('resena', e.target.value.slice(0, 300))}
                    rows={3}
                    maxLength={300}
                    placeholder="Descripción breve del libro..."
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 text-right mt-0.5">{form.resena.length}/300</p>
                </div>
                {isEditing && (
                  <BookCoverUpload bookId={book.id} currentUrl={book.imagen_portada_url} isbn={book.isbn} onUploaded={setCoverUrl} />
                )}
              </>
            )}

            {/* ── Catalogación ── */}
            {section === 'catalogo' && (
              <>
                {/* Ubicación física */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                      <span>📍</span> Ubicación en la Biblioteca
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewLoc(!showNewLoc)}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {showNewLoc ? '← Cancelar' : '+ Nueva ubicación'}
                    </button>
                  </div>

                  {!showNewLoc ? (
                    <div>
                      <select
                        value={ubicacionId}
                        onChange={(e) => setUbicacionId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">— Sin ubicación asignada —</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {locationLabel(loc)}
                          </option>
                        ))}
                      </select>
                      {locations.length === 0 && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          No hay ubicaciones creadas. Usa el botón "+ Nueva ubicación" para crear la primera.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Define la ubicación física donde se encontrará el libro:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>Sala / Área</label>
                          <input
                            type="text"
                            placeholder="Ej: Sala Principal"
                            value={newLoc.section}
                            onChange={(e) => setNewLoc((l) => ({ ...l, section: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Estante *</label>
                          <input
                            type="text"
                            placeholder="Ej: Estante A"
                            value={newLoc.shelf_name}
                            onChange={(e) => setNewLoc((l) => ({ ...l, shelf_name: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Nivel / Fila</label>
                          <input
                            type="text"
                            placeholder="Ej: 2"
                            value={newLoc.row}
                            onChange={(e) => setNewLoc((l) => ({ ...l, row: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateLocation}
                        disabled={creatingLoc || !newLoc.shelf_name.trim()}
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {creatingLoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Guardar ubicación
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Colección</label>
                    <input type="text" value={form.coleccion} onChange={(e) => set('coleccion', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Formato del Material</label>
                    <input type="text" value={form.formato_material} onChange={(e) => set('formato_material', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Idioma</label>
                    <select value={form.idioma} onChange={(e) => set('idioma', e.target.value)} className={inputCls}>
                      <option value="">— Seleccionar —</option>
                      <optgroup label="Principales">
                        <option value="Español">Español</option>
                        <option value="Alemán">Alemán</option>
                        <option value="Inglés">Inglés</option>
                      </optgroup>
                      <optgroup label="Otros idiomas">
                        <option value="Afrikáans">Afrikáans</option>
                        <option value="Albanés">Albanés</option>
                        <option value="Árabe">Árabe</option>
                        <option value="Armenio">Armenio</option>
                        <option value="Azerí">Azerí</option>
                        <option value="Bengalí">Bengalí</option>
                        <option value="Bielorruso">Bielorruso</option>
                        <option value="Birmano">Birmano</option>
                        <option value="Bosnio">Bosnio</option>
                        <option value="Búlgaro">Búlgaro</option>
                        <option value="Catalán">Catalán</option>
                        <option value="Checo">Checo</option>
                        <option value="Chino (Mandarín)">Chino (Mandarín)</option>
                        <option value="Chino (Cantonés)">Chino (Cantonés)</option>
                        <option value="Coreano">Coreano</option>
                        <option value="Croata">Croata</option>
                        <option value="Danés">Danés</option>
                        <option value="Eslovaco">Eslovaco</option>
                        <option value="Esloveno">Esloveno</option>
                        <option value="Estonio">Estonio</option>
                        <option value="Euskera">Euskera</option>
                        <option value="Finlandés">Finlandés</option>
                        <option value="Francés">Francés</option>
                        <option value="Gallego">Gallego</option>
                        <option value="Georgiano">Georgiano</option>
                        <option value="Griego">Griego</option>
                        <option value="Gujarati">Gujarati</option>
                        <option value="Hebreo">Hebreo</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Húngaro">Húngaro</option>
                        <option value="Indonesio">Indonesio</option>
                        <option value="Irlandés">Irlandés</option>
                        <option value="Islandés">Islandés</option>
                        <option value="Italiano">Italiano</option>
                        <option value="Japonés">Japonés</option>
                        <option value="Javanés">Javanés</option>
                        <option value="Kazajo">Kazajo</option>
                        <option value="Khmer">Khmer</option>
                        <option value="Letón">Letón</option>
                        <option value="Lituano">Lituano</option>
                        <option value="Macedonio">Macedonio</option>
                        <option value="Malayo">Malayo</option>
                        <option value="Malayalam">Malayalam</option>
                        <option value="Marathi">Marathi</option>
                        <option value="Mongol">Mongol</option>
                        <option value="Neerlandés">Neerlandés</option>
                        <option value="Nepalés">Nepalés</option>
                        <option value="Noruego">Noruego</option>
                        <option value="Panyabí">Panyabí</option>
                        <option value="Pastún">Pastún</option>
                        <option value="Persa">Persa</option>
                        <option value="Polaco">Polaco</option>
                        <option value="Portugués">Portugués</option>
                        <option value="Rumano">Rumano</option>
                        <option value="Ruso">Ruso</option>
                        <option value="Serbio">Serbio</option>
                        <option value="Sindhi">Sindhi</option>
                        <option value="Cingalés">Cingalés</option>
                        <option value="Somalí">Somalí</option>
                        <option value="Sueco">Sueco</option>
                        <option value="Swahili">Swahili</option>
                        <option value="Tagalo">Tagalo</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Tailandés">Tailandés</option>
                        <option value="Turco">Turco</option>
                        <option value="Ucraniano">Ucraniano</option>
                        <option value="Urdu">Urdu</option>
                        <option value="Uzbeko">Uzbeko</option>
                        <option value="Vietnamita">Vietnamita</option>
                        <option value="Xhosa">Xhosa</option>
                        <option value="Yoruba">Yoruba</option>
                        <option value="Zulú">Zulú</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Lugar de Publicación</label>
                    <input type="text" value={form.lugar_publicacion} onChange={(e) => set('lugar_publicacion', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Número de Clasificación</label>
                  <input type="text" value={form.numero_clasificacion} onChange={(e) => set('numero_clasificacion', e.target.value)} className={inputCls} placeholder="Ej: I 808.831 / K17 / 2006" />
                </div>
                <div>
                  <label className={labelCls}>Mención de Serie</label>
                  <input type="text" value={form.mencion_serie} onChange={(e) => set('mencion_serie', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Términos Temáticos</label>
                  <textarea
                    value={form.terminos_tematicos}
                    onChange={(e) => set('terminos_tematicos', e.target.value)}
                    rows={3}
                    className={inputCls}
                    placeholder="Palabras clave separadas por coma o punto y coma"
                  />
                </div>
              </>
            )}

            {/* ── Adicional ── */}
            {section === 'extra' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Fecha de Ingreso</label>
                    <input type="date" value={form.fecha_ingreso} onChange={(e) => set('fecha_ingreso', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de Adquisición</label>
                    <input type="date" value={form.fecha_adquisicion} onChange={(e) => set('fecha_adquisicion', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Precio</label>
                    <input type="number" step="0.01" min="0" value={form.precio} onChange={(e) => set('precio', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Orden de Compra</label>
                    <input type="text" value={form.orden_compra} onChange={(e) => set('orden_compra', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nota</label>
                  <textarea
                    value={form.nota}
                    onChange={(e) => set('nota', e.target.value)}
                    rows={3}
                    className={inputCls}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 text-sm font-medium"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear libro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BooksPage;
