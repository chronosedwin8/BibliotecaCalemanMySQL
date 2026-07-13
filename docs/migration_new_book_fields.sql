-- Migration: Add new book fields from Biblioteca_Consolidada.xlsx
-- Run this in the Supabase SQL Editor

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS coleccion           text,
  ADD COLUMN IF NOT EXISTS numero_inventario   text,
  ADD COLUMN IF NOT EXISTS fecha_ingreso        date,
  ADD COLUMN IF NOT EXISTS formato_material    text,
  ADD COLUMN IF NOT EXISTS idioma              text DEFAULT 'Español',
  ADD COLUMN IF NOT EXISTS numero_clasificacion text,
  ADD COLUMN IF NOT EXISTS titulo_paralelo     text,
  ADD COLUMN IF NOT EXISTS numero_ejemplar     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lugar_publicacion   text,
  ADD COLUMN IF NOT EXISTS mencion_serie       text,
  ADD COLUMN IF NOT EXISTS numero_paginas      text,
  ADD COLUMN IF NOT EXISTS terminos_tematicos  text,
  ADD COLUMN IF NOT EXISTS fecha_adquisicion   date,
  ADD COLUMN IF NOT EXISTS precio              numeric(10,2),
  ADD COLUMN IF NOT EXISTS orden_compra        text,
  ADD COLUMN IF NOT EXISTS nota                text;

-- Indexes for fast search/filter
CREATE INDEX IF NOT EXISTS idx_books_coleccion           ON books(coleccion);
CREATE INDEX IF NOT EXISTS idx_books_idioma              ON books(idioma);
CREATE INDEX IF NOT EXISTS idx_books_formato_material    ON books(formato_material);
CREATE INDEX IF NOT EXISTS idx_books_numero_inventario   ON books(numero_inventario) WHERE numero_inventario IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_numero_clasificacion ON books(numero_clasificacion) WHERE numero_clasificacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_isbn_ejemplar       ON books(isbn, numero_ejemplar) WHERE isbn IS NOT NULL;

-- Full-text search index on new text fields
CREATE INDEX IF NOT EXISTS idx_books_tematicos_gin ON books USING gin(to_tsvector('spanish', coalesce(terminos_tematicos,'')));
