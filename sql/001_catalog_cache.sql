-- Cache tables for Internet Archive integration

CREATE TABLE public.cached_books (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  query      text        NOT NULL UNIQUE,
  results    jsonb       NOT NULL,
  cached_at  timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX cached_books_query_idx     ON public.cached_books (query);
CREATE INDEX cached_books_cached_at_idx ON public.cached_books (cached_at);

CREATE TABLE public.cached_recommendations (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  results    jsonb       NOT NULL,
  cached_at  timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX cached_recommendations_singleton ON public.cached_recommendations ((true));

ALTER TABLE public.cached_books           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read cached_books"
  ON public.cached_books FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "write cached_books"
  ON public.cached_books FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "read cached_recommendations"
  ON public.cached_recommendations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "write cached_recommendations"
  ON public.cached_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);
