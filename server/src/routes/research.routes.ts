import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute, pool } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

// GET /research/search?q=&year=&language=&keywords=
router.get('/search', async (req, res) => {
  try {
    const { q = '', year, language, keywords } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];
    const limit = 20;

    if (q.trim().length >= 3) {
      conditions.push('(title LIKE ? OR abstract_text LIKE ?)');
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }
    if (year) {
      conditions.push('publication_date BETWEEN ? AND ?');
      params.push(`${year}-01-01`, `${year}-12-31`);
    }
    if (language && language !== 'all') {
      conditions.push('language LIKE ?'); params.push(`%${language}%`);
    }
    if (keywords) {
      conditions.push('JSON_CONTAINS(keywords, JSON_QUOTE(?))'); params.push(keywords);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await query<Record<string, unknown>>(`SELECT * FROM articles ${where} ORDER BY publication_date DESC LIMIT ${limit}`, params);

    const mapped = rows.map(r => ({
      id: r.id,
      title: r.title,
      abstract: r.abstract_text,
      authors: parseJsonField(r.authors, []),
      journal_title: r.journal_title,
      publication_date: r.publication_date,
      keywords: parseJsonField(r.keywords, []),
      doi: r.doi,
      url: r.url,
      language: r.language,
      source: r.source === 'doaj' ? 'doaj' : 'local',
    }));

    res.json(mapped);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error en búsqueda' }); }
});

// GET /research/stats
router.get('/stats', async (_req, res) => {
  try {
    const [articleRow, journalRow, lastRow] = await Promise.all([
      queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM articles'),
      queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM journals'),
      queryOne<{ last_updated: string }>('SELECT last_updated FROM articles ORDER BY last_updated DESC LIMIT 1'),
    ]);
    res.json({
      totalArticles: articleRow?.total ?? 0,
      totalJournals: journalRow?.total ?? 0,
      lastSync: lastRow?.last_updated ?? null,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /research/autocomplete?q=
router.get('/autocomplete', async (req, res) => {
  try {
    const { q = '' } = req.query as { q: string };
    if (q.length < 2) { res.json([]); return; }
    const rows = await query<{ title: string }>('SELECT title FROM articles WHERE title LIKE ? LIMIT 8', [`%${q}%`]);
    res.json(rows.map(r => r.title));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /research/cache  — guarda artículos de DOAJ
router.post('/cache', async (req, res) => {
  try {
    const articles: Record<string, unknown>[] = req.body;
    if (!Array.isArray(articles)) { res.status(400).json({ error: 'Array esperado' }); return; }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const a of articles) {
        await conn.execute(
          `INSERT INTO articles (id,title,abstract_text,authors,journal_title,publication_date,keywords,doi,url,language,source,last_updated)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())
           ON DUPLICATE KEY UPDATE title=VALUES(title), abstract_text=VALUES(abstract_text), last_updated=NOW()`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [a.id, a.title, a.abstract ?? null, JSON.stringify(a.authors ?? []), a.journal_title ?? null, a.publication_date ?? null, JSON.stringify(a.keywords ?? []), a.doi ?? null, a.url ?? null, a.language ?? null, a.source ?? 'doaj'] as any[],
        );
      }
      await conn.commit();
    } finally { conn.release(); }

    res.json({ cached: articles.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al cachear' }); }
});

function parseJsonField(val: unknown, fallback: unknown) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  return fallback;
}

export default router;
