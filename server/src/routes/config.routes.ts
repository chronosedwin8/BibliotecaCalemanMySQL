import { Router } from 'express';
import { query, queryOne, execute } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

// GET /config/:clave
router.get('/:clave', async (req, res) => {
  try {
    const row = await queryOne<{ valor: string }>('SELECT valor FROM configuracion_sistema WHERE clave = ?', [req.params.clave]);
    if (!row) { res.status(404).json({ error: 'Clave no encontrada' }); return; }
    res.json({ valor: row.valor });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// PUT /config/:clave
router.put('/:clave', requireRole('admin'), async (req, res) => {
  try {
    const { valor, tipo_dato, descripcion } = req.body;
    await execute(
      `INSERT INTO configuracion_sistema (clave,valor,tipo_dato,descripcion)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE valor=VALUES(valor), tipo_dato=COALESCE(VALUES(tipo_dato),tipo_dato), descripcion=COALESCE(VALUES(descripcion),descripcion)`,
      [req.params.clave, valor, tipo_dato ?? null, descripcion ?? null],
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /config/catalog/:type  — fallback con distinct de profiles
const CATALOG_COLS: Record<string, string> = { niveles: 'level', cursos: 'course', secciones: 'section' };
const CATALOG_KEYS: Record<string, string> = { niveles: 'catalog.niveles', cursos: 'catalog.cursos', secciones: 'catalog.secciones' };

router.get('/catalog/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!CATALOG_KEYS[type]) { res.status(400).json({ error: 'Tipo inválido' }); return; }

    const row = await queryOne<{ valor: string }>('SELECT valor FROM configuracion_sistema WHERE clave = ?', [CATALOG_KEYS[type]]);
    if (row?.valor) {
      try { res.json(JSON.parse(row.valor)); return; } catch { /* fall through */ }
    }

    // Fallback: distinct from profiles
    const col = CATALOG_COLS[type];
    const rows = await query<Record<string, string>>(`SELECT DISTINCT ${col} FROM profiles WHERE ${col} IS NOT NULL ORDER BY ${col}`);
    const vals = rows.map(r => r[col]).filter(Boolean);
    res.json(vals);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// PUT /config/catalog/:type
router.put('/catalog/:type', requireRole('admin'), async (req, res) => {
  try {
    const { type } = req.params;
    if (!CATALOG_KEYS[type]) { res.status(400).json({ error: 'Tipo inválido' }); return; }

    const values: string[] = req.body;
    const sorted = [...new Set(values.filter(Boolean))].sort();
    await execute(
      `INSERT INTO configuracion_sistema (clave,valor,tipo_dato,descripcion) VALUES (?,?,'json',?)
       ON DUPLICATE KEY UPDATE valor=VALUES(valor)`,
      [CATALOG_KEYS[type], JSON.stringify(sorted), `Valores permitidos para ${type}`],
    );
    res.json(sorted);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

export default router;
