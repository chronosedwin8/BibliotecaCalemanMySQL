import React, { useEffect } from 'react';
import { X, Download, BookOpen, Headphones, Video, Globe, Calendar, Tag } from 'lucide-react';
import type { CatalogItem, CatalogItemType } from '../../types/catalog.types';

interface BookModalProps {
  item: CatalogItem | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<CatalogItemType, string> = {
  book: 'Libro', audio: 'Audio', video: 'Video', podcast: 'Podcast',
};

const CATEGORY_LABEL: Record<string, string> = {
  literature: 'Literatura', math: 'Matemáticas', german: 'Alemán', english: 'Inglés',
};

const BookModal: React.FC<BookModalProps> = ({ item, onClose }) => {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex flex-col md:flex-row gap-0">
          {/* Left column: cover + metadata */}
          <div className="md:w-72 flex-none bg-gray-50 p-6 rounded-tl-2xl rounded-bl-2xl flex flex-col gap-4">
            <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray-200 shadow-md">
              <img
                src={item.cover}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <h2 className="text-base font-bold text-gray-800 leading-tight">{item.title}</h2>
              <p className="text-gray-600">{item.author}</p>

              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <BookOpen className="w-3 h-3" />
                  {TYPE_LABEL[item.type]}
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  <Tag className="w-3 h-3" />
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
              </div>

              {item.year && (
                <p className="flex items-center gap-1.5 text-gray-500 text-xs">
                  <Calendar className="w-3.5 h-3.5" /> {item.year}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Globe className="w-3.5 h-3.5" /> {item.language}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-auto">
              {item.downloadUrl && (
                <a
                  href={item.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </a>
              )}
              {item.readerUrl && (
                <a
                  href={`https://archive.org/details/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {item.type === 'audio' ? <Headphones className="w-4 h-4" /> :
                   item.type === 'video' ? <Video className="w-4 h-4" /> :
                   <BookOpen className="w-4 h-4" />}
                  Ver en Archive.org
                </a>
              )}
            </div>
          </div>

          {/* Right column: embedded reader */}
          {item.readerUrl && (
            <div className="flex-1 flex flex-col min-h-[400px]">
              <div className="p-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-500">Vista previa</p>
              </div>
              <iframe
                src={item.readerUrl}
                title={item.title}
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="flex-1 w-full min-h-[500px] border-0"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookModal;
