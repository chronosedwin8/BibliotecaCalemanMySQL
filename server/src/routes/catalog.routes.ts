import { Router } from 'express';
import { randomUUID } from 'crypto';
import { queryOne, execute } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

const TTL_MS = 6 * 60 * 60 * 1000;
const ADULT_BLOCKLIST = ['xxx', 'porn', 'adult', 'erotic', 'nude', 'sex', 'erotica'];
const FIELDS = 'identifier,title,creator,year,mediatype,language,subject';
const LANG_MAP: Record<string, string> = { eng: 'English', en: 'English', ger: 'German', deu: 'German', de: 'German', spa: 'Spanish', es: 'Spanish' };

const RECOMMENDATION_QUERIES = [
  'children literature', 'math for kids', 'german learning children',
  'english learning kids', 'audiobook children', 'educational kids video', 'kids podcast',
];

type AnyArray = unknown[];
function toArray(v: unknown): AnyArray { if (!v) return []; return Array.isArray(v) ? v : [v]; }
function isAdult(doc: Record<string, unknown>): boolean {
  const fields = [(doc.title ?? '') as string, ...toArray(doc.subject)].map(s => String(s).toLowerCase());
  return ADULT_BLOCKLIST.some(t => fields.some(f => f.includes(t)));
}
function resolveType(mt: unknown) {
  if (mt === 'texts') return 'book'; if (mt === 'audio') return 'audio'; if (mt === 'movies') return 'video'; return 'book';
}
function resolveLanguage(lang: unknown) {
  const arr = toArray(lang); if (!arr.length) return 'Unknown';
  const code = String(arr[0]).toLowerCase().trim(); return LANG_MAP[code] ?? code;
}
function resolveCategory(doc: Record<string, unknown>) {
  const s = [(doc.title ?? '') as string, ...toArray(doc.subject)].join(' ').toLowerCase();
  if (/german|deutsch/.test(s)) return 'german';
  if (/english\s+learn|learn\s+english|esl/.test(s)) return 'english';
  if (/math|mathemat|algebra|geometry|arithmetic/.test(s)) return 'math';
  return 'literature';
}
function normalize(doc: Record<string, unknown>) {
  if (!doc.identifier || isAdult(doc)) return null;
  const creator = toArray(doc.creator);
  const rawYear = parseInt(String(doc.year ?? ''), 10);
  return {
    id: doc.identifier,
    title: (String(doc.title ?? doc.identifier)).trim(),
    author: (String(creator[0] ?? 'Unknown')).trim(),
    year: isNaN(rawYear) ? undefined : rawYear,
    cover: `https://archive.org/services/img/${doc.identifier}`,
    type: resolveType(doc.mediatype),
    category: resolveCategory(doc),
    readerUrl: `https://archive.org/embed/${doc.identifier}`,
    downloadUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
    language: resolveLanguage(doc.language),
  };
}

async function searchArchive(query: string, rows = 20) {
  const params = new URLSearchParams({
    q: `${query} AND (language:eng OR language:ger OR language:spa) AND NOT subject:adult`,
    'fl[]': FIELDS, rows: String(rows), output: 'json', 'sort[]': 'downloads desc',
  });
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as { response?: { docs?: Record<string, unknown>[] } };
  return data?.response?.docs ?? [];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// GET /catalog/search?q=
router.get('/search', async (req, res) => {
  try {
    const rawQ = String(req.query.q ?? '').trim().toLowerCase();
    if (rawQ.length < 2) { res.status(400).json({ error: 'Query too short' }); return; }

    // Check cache
    const cached = await queryOne<{ results: unknown }>('SELECT results FROM cached_books WHERE query_text = ?', [rawQ]);
    if (cached?.results) {
      const parsed = typeof cached.results === 'string' ? JSON.parse(cached.results) : cached.results;
      res.json(parsed); return;
    }

    const docs = await searchArchive(rawQ, 25);
    const items = docs.map(normalize).filter(Boolean).slice(0, 20);

    const id = randomUUID();
    await execute(
      `INSERT INTO cached_books (id,query_text,results,cached_at) VALUES (?,?,?,NOW())
       ON DUPLICATE KEY UPDATE results=VALUES(results), cached_at=NOW()`,
      [id, rawQ, JSON.stringify(items)],
    );
    res.json(items);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error en búsqueda de catálogo' }); }
});

// GET /catalog/recommendations
router.get('/recommendations', async (_req, res) => {
  try {
    const cached = await queryOne<{ id: string; results: unknown; cached_at: string }>('SELECT * FROM cached_recommendations LIMIT 1');
    if (cached?.results) {
      const cachedAt = new Date(cached.cached_at).getTime();
      if (Date.now() < cachedAt + TTL_MS) {
        const parsed = typeof cached.results === 'string' ? JSON.parse(cached.results) : cached.results;
        res.json(parsed); return;
      }
    }

    const results = await Promise.allSettled(RECOMMENDATION_QUERIES.map(q => searchArchive(q, 5)));
    const allDocs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const seen = new Set<unknown>();
    const unique = allDocs.filter(doc => { if (!doc.identifier || seen.has(doc.identifier)) return false; seen.add(doc.identifier); return true; });
    const items = shuffle(unique.map(normalize).filter(Boolean)).slice(0, 10);

    const id = randomUUID();
    if (cached) {
      await execute('UPDATE cached_recommendations SET results=?, cached_at=NOW() WHERE id=?', [JSON.stringify(items), cached.id]);
    } else {
      await execute('INSERT INTO cached_recommendations (id,results,cached_at) VALUES (?,?,NOW())', [id, JSON.stringify(items)]);
    }
    res.json(items);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error en recomendaciones' }); }
});

export default router;
