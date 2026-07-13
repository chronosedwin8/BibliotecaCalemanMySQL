import React, { useState } from 'react';
import { BookOpen, Headphones, Video, Mic, Loader2 } from 'lucide-react';
import type { CatalogItem, CatalogItemType } from '../../types/catalog.types';

interface CatalogGridProps {
  items: CatalogItem[];
  isLoading: boolean;
  onSelect: (item: CatalogItem) => void;
}

const TYPE_CONFIG: Record<CatalogItemType, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  book:    { label: 'Libro',   color: 'bg-blue-100 text-blue-700',   Icon: BookOpen },
  audio:   { label: 'Audio',   color: 'bg-green-100 text-green-700', Icon: Headphones },
  video:   { label: 'Video',   color: 'bg-red-100 text-red-700',     Icon: Video },
  podcast: { label: 'Podcast', color: 'bg-purple-100 text-purple-700', Icon: Mic },
};

const CatalogCard: React.FC<{ item: CatalogItem; onClick: () => void }> = ({ item, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const { label, color, Icon } = TYPE_CONFIG[item.type];

  return (
    <button
      onClick={onClick}
      className="flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left overflow-hidden group"
    >
      <div className="relative w-full aspect-[3/4] bg-gray-100 overflow-hidden">
        {!imgError ? (
          <img
            src={item.cover}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Icon className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
          {label}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{item.title}</p>
        <p className="text-xs text-gray-500 truncate">{item.author}</p>
        {item.year && <p className="text-xs text-gray-400">{item.year}</p>}
      </div>
    </button>
  );
};

const CatalogGrid: React.FC<CatalogGridProps> = ({ items, isLoading, onSelect }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <BookOpen className="w-12 h-12 mb-3" />
        <p className="text-sm">No se encontraron resultados</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map(item => (
        <CatalogCard key={item.id} item={item} onClick={() => onSelect(item)} />
      ))}
    </div>
  );
};

export default CatalogGrid;
