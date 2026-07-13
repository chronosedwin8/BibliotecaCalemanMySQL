import type { ArchiveDoc, CatalogItem, CatalogItemCategory, CatalogItemType } from '../types/catalog.types';

const ADULT_BLOCKLIST = ['xxx', 'porn', 'adult', 'erotic', 'nude', 'sex', 'erotica', 'pornographic'];

const LANGUAGE_MAP: Record<string, string> = {
  eng: 'English',
  en: 'English',
  ger: 'German',
  deu: 'German',
  de: 'German',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ita: 'Italian',
  it: 'Italian',
  por: 'Portuguese',
  pt: 'Portuguese',
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isAdult(doc: ArchiveDoc): boolean {
  const fields = [
    ...(doc.title ? [doc.title] : []),
    ...toArray(doc.subject),
  ].map(s => s.toLowerCase());

  return ADULT_BLOCKLIST.some(term => fields.some(f => f.includes(term)));
}

function resolveType(mediatype: string | undefined): CatalogItemType {
  switch (mediatype) {
    case 'texts': return 'book';
    case 'audio': return 'audio';
    case 'movies': return 'video';
    case 'etree': return 'audio';
    default: return 'book';
  }
}

function resolveCategory(doc: ArchiveDoc): CatalogItemCategory {
  const searchable = [
    doc.title ?? '',
    ...toArray(doc.subject),
  ].join(' ').toLowerCase();

  if (/german|deutsch|alemán|alemania/.test(searchable)) return 'german';
  if (/english\s+learn|learn\s+english|esl|english\s+for/.test(searchable)) return 'english';
  if (/math|mathemat|algebra|geometry|arithmetic|calculus|número|número/.test(searchable)) return 'math';
  return 'literature';
}

function resolveLanguage(lang: string | string[] | undefined): string {
  const langs = toArray(lang);
  if (langs.length === 0) return 'Unknown';
  const code = langs[0].toLowerCase().trim();
  return LANGUAGE_MAP[code] ?? code;
}

export function normalizeArchiveDoc(doc: ArchiveDoc): CatalogItem | null {
  if (!doc.identifier) return null;
  if (isAdult(doc)) return null;

  const creator = toArray(doc.creator);
  const author = creator.length > 0 ? creator[0] : 'Unknown';

  const rawYear = doc.year;
  const year = rawYear !== undefined ? parseInt(String(rawYear), 10) : undefined;

  return {
    id: doc.identifier,
    title: doc.title?.trim() || doc.identifier,
    author: author.trim(),
    year: year && !isNaN(year) ? year : undefined,
    cover: `https://archive.org/services/img/${doc.identifier}`,
    type: resolveType(doc.mediatype),
    category: resolveCategory(doc),
    readerUrl: `https://archive.org/embed/${doc.identifier}`,
    downloadUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
    language: resolveLanguage(doc.language),
  };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
