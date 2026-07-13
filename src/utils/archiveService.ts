import type { ArchiveDoc, ArchiveSearchResponse } from '../types/catalog.types';

const ARCHIVE_BASE = 'https://archive.org';
const FIELDS = ['identifier', 'title', 'creator', 'year', 'mediatype', 'language', 'subject'].join(',');

export async function searchArchive(query: string, rows = 20): Promise<ArchiveDoc[]> {
  const params = new URLSearchParams({
    q: `${query} AND (language:eng OR language:ger OR language:spa) AND NOT subject:adult`,
    'fl[]': FIELDS,
    rows: String(rows),
    output: 'json',
    'sort[]': 'downloads desc',
  });

  const url = `${ARCHIVE_BASE}/advancedsearch.php?${params.toString()}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`archive.org search failed: ${res.status}`);
  }

  const data = await res.json() as ArchiveSearchResponse;
  return data?.response?.docs ?? [];
}

export async function fetchMetadata(identifier: string): Promise<Record<string, unknown>> {
  const url = `${ARCHIVE_BASE}/metadata/${identifier}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`archive.org metadata failed for ${identifier}: ${res.status}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}
