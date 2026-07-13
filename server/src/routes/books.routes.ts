import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { query, queryOne, execute, pool } from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../auth/middleware.js';
import { uploadObject } from '../s3.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// ── helpers ──────────────────────────────────────────────────────────────────

function buildBookSelect() {
  return `
    SELECT b.*,
      JSON_OBJECT('id', c.id, 'nombre', c.nombre, 'color_hex', c.color_hex) AS categories,
      JSON_OBJECT('id', l.id, 'shelf_name', l.shelf_name, 'section', l.section, 'row', l.row) AS locations
    FROM books b
    LEFT JOIN categories c ON c.id = b.categoria_id
    LEFT JOIN locations  l ON l.id = b.ubicacion_id
  `;
}

function parseJsonField(val: unknown): unknown {
  if (val == null) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val; // mysql2 already parsed it as object
}

function parseBookRow(row: Record<string, unknown>) {
  const cats = parseJsonField(row.categories) as Record<string, unknown> | null;
  const locs  = parseJsonField(row.locations)  as Record<string, unknown> | null;
  return {
    ...row,
    categories: cats?.id  != null ? cats  : null,
    locations:  locs?.id  != null ? locs  : null,
  };
}

// ── GET /books ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, coleccion, idioma, formato_material, estado } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(`(b.titulo LIKE ? OR b.autor LIKE ? OR b.isbn LIKE ? OR b.editorial LIKE ? OR b.numero_clasificacion LIKE ? OR b.terminos_tematicos LIKE ? OR b.numero_inventario LIKE ? OR b.coleccion LIKE ? OR b.codigo_barras LIKE ? OR b.resena LIKE ?)`);
      params.push(term, term, term, term, term, term, term, term, term, term);
    }
    if (coleccion) { conditions.push('b.coleccion = ?'); params.push(coleccion); }
    if (idioma)    { conditions.push('b.idioma LIKE ?'); params.push(`%${idioma}%`); }
    if (formato_material) { conditions.push('b.formato_material LIKE ?'); params.push(`%${formato_material}%`); }
    if (estado)    { conditions.push('b.estado = ?'); params.push(estado); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await query<Record<string, unknown>>(
      `${buildBookSelect()} ${where} ORDER BY b.titulo`,
      params,
    );
    res.json(rows.map(parseBookRow));
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error al obtener libros' });
  }
});

// GET /books/count
router.get('/count', async (_req, res) => {
  try {
    const row = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM books');
    res.json(row?.total ?? 0);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /books/collections
router.get('/collections', async (_req, res) => {
  try {
    const rows = await query<{ coleccion: string }>('SELECT DISTINCT coleccion FROM books WHERE coleccion IS NOT NULL ORDER BY coleccion');
    res.json(rows.map(r => r.coleccion));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /books/idiomas
router.get('/idiomas', async (_req, res) => {
  try {
    const rows = await query<{ idioma: string }>('SELECT DISTINCT idioma FROM books WHERE idioma IS NOT NULL ORDER BY idioma');
    res.json(rows.map(r => r.idioma));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /books/export
router.get('/export', async (_req, res) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `${buildBookSelect()} ORDER BY b.titulo`,
    );
    res.json(rows.map(parseBookRow));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /books/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      `${buildBookSelect()} WHERE b.id = ?`,
      [req.params.id],
    );
    if (!row) { res.status(404).json({ error: 'Libro no encontrado' }); return; }
    res.json(parseBookRow(row));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /books
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const id = randomUUID();
    const b = req.body;
    await execute(
      `INSERT INTO books (id,titulo,autor,isbn,editorial,anio_publicacion,categoria_id,ubicacion_id,cantidad_total,cantidad_disponible,codigo_barras,imagen_portada_url,estado,coleccion,numero_inventario,fecha_ingreso,formato_material,idioma,numero_clasificacion,titulo_paralelo,numero_ejemplar,lugar_publicacion,mencion_serie,numero_paginas,terminos_tematicos,fecha_adquisicion,precio,orden_compra,nota,resena)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,b.titulo,b.autor,b.isbn??null,b.editorial??null,b.anio_publicacion??null,b.categoria_id??null,b.ubicacion_id??null,b.cantidad_total??1,b.cantidad_disponible??1,b.codigo_barras??null,b.imagen_portada_url??null,b.estado??'disponible',b.coleccion??null,b.numero_inventario??null,b.fecha_ingreso??null,b.formato_material??null,b.idioma??null,b.numero_clasificacion??null,b.titulo_paralelo??null,b.numero_ejemplar??null,b.lugar_publicacion??null,b.mencion_serie??null,b.numero_paginas??null,b.terminos_tematicos??null,b.fecha_adquisicion??null,b.precio??null,b.orden_compra??null,b.nota??null,b.resena??null],
    );
    const created = await queryOne<Record<string,unknown>>(`${buildBookSelect()} WHERE b.id = ?`, [id]);
    res.status(201).json(parseBookRow(created!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear libro' }); }
});

// PUT /books/:id
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const b = req.body;
    // imagen_portada_url usa COALESCE: si el payload no la trae (undefined→null),
    // se conserva la portada existente en la BD y nunca se borra por accidente.
    await execute(
      `UPDATE books SET titulo=?,autor=?,isbn=?,editorial=?,anio_publicacion=?,categoria_id=?,ubicacion_id=?,cantidad_total=?,cantidad_disponible=?,codigo_barras=?,imagen_portada_url=COALESCE(?,imagen_portada_url),estado=?,coleccion=?,numero_inventario=?,fecha_ingreso=?,formato_material=?,idioma=?,numero_clasificacion=?,titulo_paralelo=?,numero_ejemplar=?,lugar_publicacion=?,mencion_serie=?,numero_paginas=?,terminos_tematicos=?,fecha_adquisicion=?,precio=?,orden_compra=?,nota=?,resena=? WHERE id=?`,
      [b.titulo,b.autor,b.isbn??null,b.editorial??null,b.anio_publicacion??null,b.categoria_id??null,b.ubicacion_id??null,b.cantidad_total??1,b.cantidad_disponible??1,b.codigo_barras??null,b.imagen_portada_url??null,b.estado??'disponible',b.coleccion??null,b.numero_inventario??null,b.fecha_ingreso??null,b.formato_material??null,b.idioma??null,b.numero_clasificacion??null,b.titulo_paralelo??null,b.numero_ejemplar??null,b.lugar_publicacion??null,b.mencion_serie??null,b.numero_paginas??null,b.terminos_tematicos??null,b.fecha_adquisicion??null,b.precio??null,b.orden_compra??null,b.nota??null,b.resena??null,req.params.id],
    );
    const updated = await queryOne<Record<string,unknown>>(`${buildBookSelect()} WHERE b.id = ?`, [req.params.id]);
    res.json(parseBookRow(updated!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al actualizar libro' }); }
});

// DELETE /books?coleccion=X  OR  DELETE /books/:id
router.delete('/', requireRole('admin'), async (req, res) => {
  try {
    const { coleccion } = req.query as { coleccion?: string };
    if (!coleccion) { res.status(400).json({ error: 'coleccion requerida' }); return; }
    const result = await execute('DELETE FROM books WHERE coleccion = ?', [coleccion]);
    res.json({ deleted: result.affectedRows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar' }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await execute('DELETE FROM books WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar libro' }); }
});

// POST /books/bulk
router.post('/bulk', requireRole('admin'), async (req, res) => {
  const books: Record<string, unknown>[] = req.body;
  if (!Array.isArray(books)) { res.status(400).json({ error: 'Se esperaba un array' }); return; }

  const BATCH = 100;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < books.length; i += BATCH) {
    const batch = books.slice(i, i + BATCH);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const b of batch) {
        const id = (b.id as string) || randomUUID();
        await conn.execute(
          `INSERT INTO books (id,titulo,autor,isbn,editorial,anio_publicacion,categoria_id,ubicacion_id,cantidad_total,cantidad_disponible,codigo_barras,imagen_portada_url,estado,coleccion,numero_inventario,fecha_ingreso,formato_material,idioma,numero_clasificacion,titulo_paralelo,numero_ejemplar,lugar_publicacion,mencion_serie,numero_paginas,terminos_tematicos,fecha_adquisicion,precio,orden_compra,nota,resena)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE titulo=VALUES(titulo),autor=VALUES(autor)`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [id,b.titulo,b.autor,b.isbn??null,b.editorial??null,b.anio_publicacion??null,b.categoria_id??null,b.ubicacion_id??null,b.cantidad_total??1,b.cantidad_disponible??1,b.codigo_barras??null,b.imagen_portada_url??null,b.estado??'disponible',b.coleccion??null,b.numero_inventario??null,b.fecha_ingreso??null,b.formato_material??null,b.idioma??null,b.numero_clasificacion??null,b.titulo_paralelo??null,b.numero_ejemplar??null,b.lugar_publicacion??null,b.mencion_serie??null,b.numero_paginas??null,b.terminos_tematicos??null,b.fecha_adquisicion??null,b.precio??null,b.orden_compra??null,b.nota??null,b.resena??null] as any[],
        );
        inserted++;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${String(err)}`);
    } finally {
      conn.release();
    }
  }
  res.json({ inserted, errors });
});

// POST /books/:id/cover
router.post('/:id/cover', requireRole('admin'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return; }
    const ext = req.file.originalname.split('.').pop() ?? 'jpg';
    const key = `covers/${req.params.id}.${ext}`;
    const url = await uploadObject(key, req.file.buffer, req.file.mimetype);
    const finalUrl = `${url}?t=${Date.now()}`;
    await execute('UPDATE books SET imagen_portada_url = ? WHERE id = ?', [finalUrl, req.params.id]);
    res.json({ url: finalUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al subir portada' }); }
});

export default router;
