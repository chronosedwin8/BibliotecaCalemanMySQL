// Simulate exactly what books.routes.ts does
import { query } from '../src/db.js';

const BASE_SELECT = `
  SELECT b.*,
    JSON_OBJECT('id', c.id, 'nombre', c.nombre, 'color_hex', c.color_hex) AS categories,
    JSON_OBJECT('id', l.id, 'shelf_name', l.shelf_name, 'section', l.section, 'row', l.row) AS locations
  FROM books b
  LEFT JOIN categories c ON c.id = b.categoria_id
  LEFT JOIN locations  l ON l.id = b.ubicacion_id
`;

try {
  const term = '%matematica%';
  const rows = await query<Record<string, unknown>>(
    `${BASE_SELECT} WHERE (b.titulo LIKE ? OR b.autor LIKE ?) ORDER BY b.titulo LIMIT 3`,
    [term, term],
  );
  console.log('Raw row[0] categories type:', typeof rows[0]?.categories, JSON.stringify(rows[0]?.categories).slice(0, 80));
  console.log('Raw row[0] locations type:', typeof rows[0]?.locations, JSON.stringify(rows[0]?.locations).slice(0, 80));

  // Simulate parseBookRow
  const parsed = rows.map(row => ({
    ...row,
    categories: row.categories ? JSON.parse(row.categories as string) : null,
    locations:  row.locations  ? JSON.parse(row.locations  as string) : null,
  }));
  console.log('✅ Parsed OK. Título:', parsed[0]?.titulo);
} catch (e) {
  console.error('ERROR:', e);
}
process.exit(0);
