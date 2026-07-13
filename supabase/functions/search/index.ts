// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const ADULT_BLOCKLIST = ['xxx', 'porn', 'adult', 'erotic', 'nude', 'sex', 'erotica'];
const FIELDS = 'identifier,title,creator,year,mediatype,language,subject';

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

async function searchArchive(query, rows = 20) {
  const params = new URLSearchParams({
    q: `${query} AND (language:eng OR language:ger OR language:spa) AND NOT subject:adult`,
    'fl[]': FIELDS,
    rows: String(rows),
    output: 'json',
    'sort[]': 'downloads desc',
  });

  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`);
  if (!res.ok) throw new Error(`archive.org ${res.status}`);
  const data = await res.json();
  return data?.response?.docs ?? [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    const rawQ = url.searchParams.get('q') ?? '';
    const query = rawQ.trim().toLowerCase();

    if (query.length < 2) {
      return new Response(JSON.stringify({ error: 'Query too short (min 2 chars)' }), { status: 400, headers: CORS });
    }
    if (query.length > 100) {
      return new Response(JSON.stringify({ error: 'Query too long (max 100 chars)' }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Check cache
    const { data: cached } = await supabase
      .from('cached_books')
      .select('results')
      .eq('query', query)
      .maybeSingle();

    if (cached?.results) {
      return new Response(JSON.stringify(cached.results), { headers: CORS });
    }

    // Fetch from archive.org
    const docs = await searchArchive(query, 25);
    const items = docs.map(normalize).filter(Boolean).slice(0, 20);

    // Save to cache (upsert)
    await supabase
      .from('cached_books')
      .upsert({ query, results: items, cached_at: new Date().toISOString() }, { onConflict: 'query' });

    return new Response(JSON.stringify(items), { headers: CORS });
  } catch (err) {
    console.error('search error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), { status: 500, headers: CORS });
  }
});
