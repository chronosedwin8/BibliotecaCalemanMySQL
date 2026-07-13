-- Corrección de valores incorrectos en el campo idioma de la tabla books
-- Ejecutar en Supabase SQL Editor

-- 1. Corregir variantes incorrectas de "Alemán"
UPDATE books SET idioma = 'Alemán' WHERE idioma = 'Alemám';
UPDATE books SET idioma = 'Alemán' WHERE idioma = 'Aleman';

-- 2. Corregir capitalización incorrecta de "Español"
UPDATE books SET idioma = 'Español' WHERE idioma = 'español';

-- Verificar resultados
SELECT idioma, COUNT(*) AS total
FROM books
WHERE idioma ILIKE '%alem%' OR idioma ILIKE '%espa%'
GROUP BY idioma
ORDER BY idioma;
