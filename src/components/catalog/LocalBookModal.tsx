import React, { useRef, useState } from 'react';
import {
  X, BookOpen, Upload, Loader2, Calendar, Hash, Globe,
  Layers, BookMarked, Package, CheckCircle, AlertCircle, MapPin,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { booksService, type BookWithRelations } from '../../services/books.service';
import { reservasService } from '../../services/reservas.service';
import { useAuthStore } from '../../hooks/useAuthStore';

interface Props {
  book: BookWithRelations | null;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Literatura:    'bg-blue-100 text-blue-800',
  Ciencias:      'bg-green-100 text-green-800',
  'Matemáticas': 'bg-yellow-100 text-yellow-800',
  Historia:      'bg-red-100 text-red-800',
  Idiomas:       'bg-purple-100 text-purple-800',
  Arte:          'bg-pink-100 text-pink-800',
  'Tecnología':  'bg-cyan-100 text-cyan-800',
  Infantil:      'bg-lime-100 text-lime-800',
};

function resolveInitialCover(book: BookWithRelations | null): string | null {
  if (!book) return null;
  if (book.imagen_portada_url) return book.imagen_portada_url;
  const isbn = book.isbn?.trim().replace(/[-\s]/g, '');
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null;
}

const LocalBookModal: React.FC<Props> = ({ book, onClose }) => {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(() => resolveInitialCover(book));
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    if (!imgError) {
      const fresh = resolveInitialCover(book);
      if (fresh && fresh !== coverUrl) { setCoverUrl(fresh); setImgError(false); }
    }
  }, [book?.imagen_portada_url]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!book) return null;

  const catName    = book.categories?.nombre ?? '';
  const catColor   = CATEGORY_COLORS[catName] ?? 'bg-gray-100 text-gray-700';
  const isAvailable = book.cantidad_disponible > 0;
  const canReserve  = book.cantidad_total > 1;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5 MB'); return; }
    setUploading(true);
    try {
      const url = await booksService.uploadCover(book.id, file);
      setCoverUrl(url); setImgError(false);
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      toast.success('Portada actualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir portada');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReservar = async () => {
    if (!book || !profile) return;
    setReservando(true);
    try {
      await reservasService.create(book.id, profile.id);
      toast.success('¡Reserva creada! Tienes 24 horas para retirar el libro en la biblioteca.');
      queryClient.invalidateQueries({ queryKey: ['books-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['reservas'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reservar');
    } finally {
      setReservando(false);
    }
  };

  // Collect metadata rows
  const meta: { label: string; value: string | number | null | undefined; icon: React.ReactNode }[] = [
    { label: 'Año',         value: book.anio_publicacion, icon: <Calendar className="w-3.5 h-3.5" /> },
    { label: 'Editorial',   value: book.editorial,        icon: <BookMarked className="w-3.5 h-3.5" /> },
    { label: 'ISBN',        value: book.isbn,             icon: <Hash className="w-3.5 h-3.5" /> },
    { label: 'Idioma',      value: book.idioma,           icon: <Globe className="w-3.5 h-3.5" /> },
    { label: 'Colección',   value: book.coleccion,        icon: <Package className="w-3.5 h-3.5" /> },
    { label: 'Clasificación', value: book.numero_clasificacion, icon: <Layers className="w-3.5 h-3.5" /> },
    { label: 'Formato',     value: book.formato_material, icon: <BookOpen className="w-3.5 h-3.5" /> },
    { label: 'Páginas',     value: book.numero_paginas,   icon: <BookOpen className="w-3.5 h-3.5" /> },
    { label: 'Inventario',  value: book.numero_inventario,icon: <Hash className="w-3.5 h-3.5" /> },
  ].filter(m => m.value != null && m.value !== '');

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-600">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Detalle del libro</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-0">

            {/* LEFT — Portada */}
            <div className="sm:w-52 flex-shrink-0 bg-gray-50 flex flex-col items-center gap-3 p-5 sm:border-r border-gray-100">
              {/* Cover image */}
              <div className="relative w-36 sm:w-44 aspect-[3/4] rounded-xl overflow-hidden shadow-lg bg-gray-100 border border-gray-200 group">
                {coverUrl && !imgError ? (
                  <img
                    src={coverUrl}
                    alt={book.titulo}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-200">
                    <BookOpen className="w-14 h-14 text-gray-300" />
                    <span className="text-xs text-gray-400">Sin portada</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                )}
              </div>

              {/* Disponibilidad badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {isAvailable
                  ? <><CheckCircle className="w-4 h-4" />{book.cantidad_disponible} disponible{book.cantidad_disponible !== 1 ? 's' : ''}</>
                  : <><AlertCircle className="w-4 h-4" />Sin stock</>
                }
              </div>

              {/* Stock total */}
              <p className="text-xs text-gray-400">{book.cantidad_disponible} de {book.cantidad_total} ejemplar{book.cantidad_total !== 1 ? 'es' : ''}</p>

              {/* Botón reservar */}
              {!isAdmin && profile && (
                <div className="w-full mt-1">
                  {canReserve && isAvailable ? (
                    <button
                      onClick={handleReservar}
                      disabled={reservando}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-blue-200"
                    >
                      {reservando ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookMarked className="w-4 h-4" />}
                      {reservando ? 'Reservando...' : 'Reservar'}
                    </button>
                  ) : !canReserve ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-amber-800 font-medium">Solo 1 ejemplar</p>
                      <p className="text-xs text-amber-700 mt-0.5">Solicita el préstamo directamente en la biblioteca.</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-500">No disponible para reservar en este momento.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Admin: subir portada */}
              {isAdmin && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-white text-gray-500 disabled:opacity-50 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {coverUrl && !imgError ? 'Cambiar portada' : 'Subir portada'}
                  </button>
                </>
              )}
            </div>

            {/* RIGHT — Información */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="p-5 space-y-4">

                {/* Título y autor */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-snug">{book.titulo}</h2>
                  {book.titulo_paralelo && (
                    <p className="text-sm text-gray-400 italic mt-0.5">{book.titulo_paralelo}</p>
                  )}
                  <p className="text-base text-gray-600 mt-1 font-medium">{book.autor}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {catName && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${catColor}`}>{catName}</span>
                  )}
                  {book.idioma && book.idioma !== 'Español' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">{book.idioma}</span>
                  )}
                  {book.formato_material && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{book.formato_material}</span>
                  )}
                  {book.coleccion && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{book.coleccion}</span>
                  )}
                </div>

                {/* Reseña */}
                {book.resena && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-sm text-blue-900 leading-relaxed italic">"{book.resena}"</p>
                  </div>
                )}

                {/* Ubicación */}
                {book.locations && book.locations.id != null && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Dónde encontrarlo</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {book.locations.section && (
                          <span><span className="text-amber-600 text-xs">Sala </span><strong className="text-gray-800">{book.locations.section}</strong></span>
                        )}
                        <span><span className="text-amber-600 text-xs">Estante </span><strong className="text-gray-800">{book.locations.shelf_name}</strong></span>
                        {book.locations.row && (
                          <span><span className="text-amber-600 text-xs">Nivel </span><strong className="text-gray-800">{book.locations.row}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Temas */}
                {book.terminos_tematicos && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Temas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {book.terminos_tematicos.split(/[;,]/).map(k => k.trim()).filter(Boolean).map((kw) => (
                        <span key={kw} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata grid — 2 columnas */}
                {meta.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Información bibliográfica</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {meta.map(({ label, value, icon }) => (
                        <div key={label} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-300 flex-shrink-0">{icon}</span>
                          <span className="text-gray-400 flex-shrink-0">{label}:</span>
                          <span className="text-gray-700 font-medium truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalBookModal;
