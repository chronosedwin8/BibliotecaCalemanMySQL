import { query } from '../src/db.js';

const sql = `
  SELECT b.*,
    JSON_OBJECT('id', c.id, 'nombre', c.nombre, 'color_hex', c.color_hex) AS categories,
    JSON_OBJECT('id', l.id, 'shelf_name', l.shelf_name, 'section', l.section, 'row', l.row) AS locations
  FROM books b
  LEFT JOIN categories c ON c.id = b.categoria_id
  LEFT JOIN locations  l ON l.id = b.ubicacion_id
  WHERE (b.titulo LIKE ? OR b.autor LIKE ?)
  ORDER BY b.titulo
  LIMIT 5
`;

try {
  const rows = await query(sql, ['%matematica%', '%matematica%']);
  console.log(`✅ ${rows.length} resultados`);
  (rows as Record<string, unknown>[]).forEach(r => console.log(' -', r.titulo));
} catch (e) {
  console.error('ERROR:', e);
}
process.exit(0);
