// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const RECOMMENDATION_QUERIES = [
  'children literature',
  'math for kids',
  'german learning children',
  'english learning kids',
  'audiobook children',
  'educational kids video',
  'kids podcast',
];

const ADULT_BLOCKLIST = ['xxx', 'porn', 'adult', 'erotic', 'nude', 'sex', 'erotica'];
const FIELDS = 'identifier,title,creator,year,mediatype,language,subject';
const TTL_HOURS = 6;

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function isAdult(doc) {
  const fields = [doc.title ?? '', ...toArray(doc.subject)].map(s => s.toLowerCase());
  return ADULT_BLOCKLIST.some(t => fields.some(f => f.includes(t)));
}

function resolveType(mediatype) {
  switch (mediatype) {
    case 'texts': return 'book';
    case 'audio': return 'audio';
    case 'movies': return 'video';
    default: return 'book';
  }
}

const LANG_MAP = { eng: 'English', en: 'English', ger: 'German', deu: 'German', de: 'German', spa: 'Spanish', es: 'Spanish' };

function resolveLanguage(lang) {
  const langs = toArray(lang);
  if (!langs.length) return 'Unknown';
  const code = langs[0].toLowerCase().trim();
  return LANG_MAP[code] ?? code;
}

function resolveCategory(doc) {
  const s = [doc.title ?? '', ...toArray(doc.subject)].join(' ').toLowerCase();
  if (/german|deutsch/.test(s)) return 'german';
  if (/english\s+learn|learn\s+english|esl/.test(s)) return 'english';
  if (/math|mathemat|algebra|geometry|arithmetic/.test(s)) return 'math';
  return 'literature';
}

function normalize(doc) {
  if (!doc.identifier || isAdult(doc)) return null;
  const creator = toArray(doc.creator);
  const rawYear = parseInt(String(doc.year ?? ''), 10);
  return {
    id: doc.identifier,
    title: (doc.title ?? doc.identifier).trim(),
    author: (creator[0] ?? 'Unknown').trim(),
    year: isNaN(rawYear) ? undefined : rawYear,
    cover: `https://archive.org/services/img/${doc.identifier}`,
    type: resolveType(doc.mediatype),
    category: resolveCategory(doc),
    readerUrl: `https://archive.org/embed/${doc.identifier}`,
    downloadUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
    language: resolveLanguage(doc.language),
  };
}

async function searchArchive(query, rows = 5) {
  const params = new URLSearchParams({
    q: `${query} AND (language:eng OR language:ger OR language:spa) AND NOT subject:adult`,
    'fl[]': FIELDS,
    rows: String(rows),
    output: 'json',
    'sort[]': 'downloads desc',
  });

  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.response?.docs ?? [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Check cache with TTL
    const { data: cached } = await supabase
      .from('cached_recommendations')
      .select('results, cached_at')
      .limit(1)
      .maybeSingle();

    if (cached?.results) {
      const cachedAt = new Date(cached.cached_at).getTime();
      const expiresAt = cachedAt + TTL_HOURS * 60 * 60 * 1000;
      if (Date.now() < expiresAt) {
        return new Response(JSON.stringify(cached.results), { headers: CORS });
      }
    }

    // Fetch all queries in parallel
    const results = await Promise.allSettled(
      RECOMMENDATION_QUERIES.map(q => searchArchive(q, 5))
    );

    const allDocs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Deduplicate by identifier
    const seen = new Set();
    const unique = allDocs.filter(doc => {
      if (!doc.identifier || seen.has(doc.identifier)) return false;
      seen.add(doc.identifier);
      return true;
    });

    // Normalize, filter, shuffle, limit
    const items = shuffle(unique.map(normalize).filter(Boolean)).slice(0, 10);

    // Upsert cache (singleton pattern via unique index on (true))
    if (cached) {
      await supabase
        .from('cached_recommendations')
        .update({ results: items, cached_at: new Date().toISOString() })
        .eq('id', cached.id);
    } else {
      await supabase
        .from('cached_recommendations')
        .insert({ results: items, cached_at: new Date().toISOString() });
    }

    return new Response(JSON.stringify(items), { headers: CORS });
  } catch (err) {
    console.error('recommendations error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), { status: 500, headers: CORS });
  }
});
