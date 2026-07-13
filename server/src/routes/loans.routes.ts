import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

const LOAN_SELECT = `
  SELECT l.*,
    JSON_OBJECT('id',b.id,'titulo',b.titulo,'autor',b.autor,'isbn',b.isbn,'imagen_portada_url',b.imagen_portada_url,'codigo_barras',b.codigo_barras) AS books,
    JSON_OBJECT('id',p.id,'full_name',p.full_name,'email',p.email,'role',p.role,'codigo_identificacion',p.codigo_identificacion,'course',p.course,'level',p.level) AS profiles
  FROM loans l
  LEFT JOIN books    b ON b.id = l.libro_id
  LEFT JOIN profiles p ON p.id = l.usuario_id
`;

function parseLoanRow(row: Record<string, unknown>) {
  return {
    ...row,
    books:    row.books    ? (typeof row.books    === 'string' ? JSON.parse(row.books)    : row.books)    : null,
    profiles: row.profiles ? (typeof row.profiles === 'string' ? JSON.parse(row.profiles) : row.profiles) : null,
  };
}

// GET /loans?estado=
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { estado } = req.query as { estado?: string };
    const where = estado ? 'WHERE l.estado = ?' : '';
    const params = estado ? [estado] : [];
    const rows = await query<Record<string, unknown>>(`${LOAN_SELECT} ${where} ORDER BY l.created_at DESC`, params);
    res.json(rows.map(parseLoanRow));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al obtener préstamos' }); }
});

// GET /loans/count/active
router.get('/count/active', async (_req, res) => {
  try {
    const row = await queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM loans WHERE estado IN ('active','overdue')`);
    res.json(row?.total ?? 0);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /loans/count/overdue
router.get('/count/overdue', async (_req, res) => {
  try {
    const row = await queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM loans WHERE estado = 'overdue'`);
    res.json(row?.total ?? 0);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /loans/user/:userId
router.get('/user/:userId', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    const rows = await query<Record<string, unknown>>(
      `${LOAN_SELECT} WHERE l.usuario_id = ? ORDER BY l.created_at DESC`,
      [userId],
    );
    res.json(rows.map(parseLoanRow));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /loans/user/:userId/active
router.get('/user/:userId/active', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    const rows = await query<Record<string, unknown>>(
      `${LOAN_SELECT} WHERE l.usuario_id = ? AND l.estado IN ('active','overdue') ORDER BY l.fecha_devolucion_estimada`,
      [userId],
    );
    res.json(rows.map(parseLoanRow));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /loans
router.post('/', async (req: AuthRequest, res) => {
  try {
    const d = req.body;
    const id = randomUUID();
    // Normalizar fecha: MySQL DATETIME no acepta ISO 8601 con 'T' y 'Z'
    const toMysqlDt = (v: unknown) =>
      v ? new Date(v as string).toISOString().slice(0, 19).replace('T', ' ') : null;

    await execute(
      `INSERT INTO loans (id,libro_id,usuario_id,fecha_devolucion_estimada,estado,renovaciones) VALUES (?,?,?,?,?,?)`,
      [id, d.libro_id, d.usuario_id, toMysqlDt(d.fecha_devolucion_estimada), d.estado ?? 'active', d.renovaciones ?? 0],
    );
    const created = await queryOne<Record<string, unknown>>(`${LOAN_SELECT} WHERE l.id = ?`, [id]);
    res.status(201).json(parseLoanRow(created!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear préstamo' }); }
});

// PATCH /loans/:id/return
router.patch('/:id/return', async (req: AuthRequest, res) => {
  try {
    const loan = await queryOne<{ usuario_id: string }>('SELECT usuario_id FROM loans WHERE id = ?', [req.params.id]);
    if (!loan) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }
    if (req.user!.role !== 'admin' && req.user!.id !== loan.usuario_id) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    await execute(
      `UPDATE loans SET estado='returned', fecha_devolucion_real=NOW() WHERE id=?`,
      [req.params.id],
    );
    const updated = await queryOne<Record<string, unknown>>(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(parseLoanRow(updated!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al devolver' }); }
});

// PATCH /loans/:id/renew
router.patch('/:id/renew', async (req: AuthRequest, res) => {
  try {
    const loan = await queryOne<{ usuario_id: string; renovaciones: number }>('SELECT usuario_id, renovaciones FROM loans WHERE id = ?', [req.params.id]);
    if (!loan) { res.status(404).json({ error: 'Préstamo no encontrado' }); return; }
    if (req.user!.role !== 'admin' && req.user!.id !== loan.usuario_id) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    if (loan.renovaciones >= 2) {
      res.status(400).json({ error: 'Máximo de renovaciones alcanzado (2)' }); return;
    }
    const { fecha_devolucion_estimada } = req.body;
    const mysqlDt = new Date(fecha_devolucion_estimada).toISOString().slice(0, 19).replace('T', ' ');
    await execute(
      `UPDATE loans SET fecha_devolucion_estimada=?, renovaciones=renovaciones+1 WHERE id=?`,
      [mysqlDt, req.params.id],
    );
    const updated = await queryOne<Record<string, unknown>>(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json(parseLoanRow(updated!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al renovar' }); }
});

export default router;
