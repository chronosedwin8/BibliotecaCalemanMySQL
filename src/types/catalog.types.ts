export type CatalogItemType = 'book' | 'audio' | 'video' | 'podcast';
export type CatalogItemCategory = 'literature' | 'math' | 'german' | 'english';

export type CatalogItem = {
  id: string;
  title: string;
  author: string;
  year?: number;
  cover: string;
  type: CatalogItemType;
  category: CatalogItemCategory;
  readerUrl?: string;
  downloadUrl?: string;
  language: string;
};

export type ArchiveDoc = {
  identifier: string;
  title?: string;
  creator?: string | string[];
  year?: string | number;
  mediatype?: string;
  language?: string | string[];
  subject?: string | string[];
};

export type ArchiveSearchResponse = {
  response: {
    docs: ArchiveDoc[];
    numFound: number;
  };
};
