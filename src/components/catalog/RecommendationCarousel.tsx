import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Headphones, Video } from 'lucide-react';
import type { CatalogItem, CatalogItemType } from '../../types/catalog.types';

interface RecommendationCarouselProps {
  items: CatalogItem[];
  isLoading: boolean;
  onSelect: (item: CatalogItem) => void;
}

const TYPE_COLORS: Record<CatalogItemType, string> = {
  book:    'bg-blue-100 text-blue-700',
  audio:   'bg-green-100 text-green-700',
  video:   'bg-red-100 text-red-700',
  podcast: 'bg-purple-100 text-purple-700',
};

const TYPE_ICONS: Record<CatalogItemType, React.FC<{ className?: string }>> = {
  book:    BookOpen,
  audio:   Headphones,
  video:   Video,
  podcast: Headphones,
};

const SCROLL_AMOUNT = 288;

const RecommendationCarousel: React.FC<RecommendationCarouselProps> = ({ items, isLoading, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Cargando recomendaciones...</span>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="relative group">
      {/* Left button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-opacity opacity-0 group-hover:opacity-100"
        aria-label="Anterior"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {items.map(item => {
          const Icon = TYPE_ICONS[item.type];
          const hasError = imgErrors[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="flex-none w-32 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left overflow-hidden"
            >
              <div className="w-full aspect-[3/4] bg-gray-100 overflow-hidden relative">
                {!hasError ? (
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setImgErrors(prev => ({ ...prev, [item.id]: true }))}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[item.type]}`}>
                  {item.type}
                </span>
              </div>
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-700 line-clamp-2 leading-tight">{item.title}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-opacity opacity-0 group-hover:opacity-100"
        aria-label="Siguiente"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
};

export default RecommendationCarousel;
