import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute, pool } from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

const toMysqlDt = (v: unknown) =>
  v ? new Date(v as string).toISOString().slice(0, 19).replace('T', ' ') : null;

const RESERVA_SELECT = `
  SELECT r.*,
    JSON_OBJECT('id',b.id,'titulo',b.titulo,'autor',b.autor,'isbn',b.isbn,
      'imagen_portada_url',b.imagen_portada_url,'cantidad_total',b.cantidad_total,
      'cantidad_disponible',b.cantidad_disponible,'codigo_barras',b.codigo_barras) AS books,
    JSON_OBJECT('id',p.id,'full_name',p.full_name,'email',p.email,
      'role',p.role,'codigo_identificacion',p.codigo_identificacion,
      'course',p.course,'level',p.level) AS profiles
  FROM reservas r
  LEFT JOIN books    b ON b.id = r.libro_id
  LEFT JOIN profiles p ON p.id = r.usuario_id
`;

function parseReservaRow(row: Record<string, unknown>) {
  return {
    ...row,
    books:    row.books    ? (typeof row.books    === 'string' ? JSON.parse(row.books)    : row.books)    : null,
    profiles: row.profiles ? (typeof row.profiles === 'string' ? JSON.parse(row.profiles) : row.profiles) : null,
  };
}

// ── Expirar reservas vencidas (llamado internamente) ──────────────────────────
export async function expireOldReservas(): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Obtener reservas pendientes vencidas
    const [expired] = await conn.execute(
      `SELECT id, libro_id FROM reservas WHERE estado='pendiente' AND fecha_expiracion < NOW()`,
    ) as [Record<string, string>[], unknown];

    for (const r of expired) {
      await conn.execute(`UPDATE reservas SET estado='expirada' WHERE id=?`, [r.id]);
      await conn.execute(`UPDATE books SET cantidad_disponible = cantidad_disponible + 1 WHERE id=?`, [r.libro_id]);
    }
    await conn.commit();
    return (expired as unknown[]).length;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── POST /reservas ────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res) => {
  try {
    await expireOldReservas(); // limpiar expiradas antes de cada operación

    const { libro_id, usuario_id } = req.body as { libro_id: string; usuario_id: string };
    const uid = usuario_id || req.user!.id;

    // 1. Verificar que el libro existe y tiene más de 1 unidad total
    const book = await queryOne<{ cantidad_total: number; cantidad_disponible: number; titulo: string }>(
      'SELECT cantidad_total, cantidad_disponible, titulo FROM books WHERE id = ?', [libro_id],
    );
    if (!book) { res.status(404).json({ error: 'Libro no encontrado' }); return; }

    if (book.cantidad_total <= 1) {
      res.status(400).json({
        error: 'Este libro solo tiene 1 ejemplar y no puede ser reservado. Solicita directamente un préstamo.',
      });
      return;
    }

    if (book.cantidad_disponible <= 0) {
      res.status(400).json({ error: 'No hay ejemplares disponibles para reservar en este momento.' });
      return;
    }

    // 2. Verificar que el usuario no tenga ya una reserva pendiente del mismo libro
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM reservas WHERE libro_id=? AND usuario_id=? AND estado='pendiente'`,
      [libro_id, uid],
    );
    if (existing) {
      res.status(409).json({ error: 'Ya tienes una reserva activa para este libro.' });
      return;
    }

    // 3. Crear la reserva y descontar stock
    const id = randomUUID();
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO reservas (id,libro_id,usuario_id,fecha_reserva,fecha_expiracion,estado,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [id, libro_id, uid,
          toMysqlDt(ahora), toMysqlDt(expiracion), 'pendiente', toMysqlDt(ahora)],
      );
      await conn.execute(
        `UPDATE books SET cantidad_disponible = cantidad_disponible - 1 WHERE id = ?`, [libro_id],
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const created = await queryOne<Record<string, unknown>>(`${RESERVA_SELECT} WHERE r.id = ?`, [id]);
    res.status(201).json(parseReservaRow(created!));
  } catch (err) {
    console.error('POST /reservas:', err);
    res.status(500).json({ error: 'Error al crear reserva' });
  }
});

// ── GET /reservas  (admin: todas | usuario: las suyas) ────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    await expireOldReservas();
    const { estado } = req.query as { estado?: string };

    let rows: Record<string, unknown>[];
    if (req.user!.role === 'admin') {
      const where = estado ? 'WHERE r.estado = ?' : '';
      const params = estado ? [estado] : [];
      rows = await query<Record<string, unknown>>(
        `${RESERVA_SELECT} ${where} ORDER BY r.fecha_reserva DESC`, params,
      );
    } else {
      const where = estado
        ? 'WHERE r.usuario_id = ? AND r.estado = ?'
        : 'WHERE r.usuario_id = ?';
      const params = estado ? [req.user!.id, estado] : [req.user!.id];
      rows = await query<Record<string, unknown>>(
        `${RESERVA_SELECT} ${where} ORDER BY r.fecha_reserva DESC`, params,
      );
    }
    res.json(rows.map(parseReservaRow));
  } catch (err) {
    console.error('GET /reservas:', err);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// ── PATCH /reservas/:id/cancel ────────────────────────────────────────────────
router.patch('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const reserva = await queryOne<{ usuario_id: string; libro_id: string; estado: string }>(
      'SELECT usuario_id, libro_id, estado FROM reservas WHERE id = ?', [req.params.id],
    );
    if (!reserva) { res.status(404).json({ error: 'Reserva no encontrada' }); return; }
    if (req.user!.role !== 'admin' && req.user!.id !== reserva.usuario_id) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    if (reserva.estado !== 'pendiente') {
      res.status(400).json({ error: 'Solo se pueden cancelar reservas pendientes' }); return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`UPDATE reservas SET estado='cancelada' WHERE id=?`, [req.params.id]);
      await conn.execute(
        `UPDATE books SET cantidad_disponible = cantidad_disponible + 1 WHERE id=?`,
        [reserva.libro_id],
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /reservas/cancel:', err);
    res.status(500).json({ error: 'Error al cancelar reserva' });
  }
});

// ── PATCH /reservas/:id/confirm  (admin: convierte reserva en préstamo) ───────
router.patch('/:id/confirm', requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const reserva = await queryOne<{ usuario_id: string; libro_id: string; estado: string }>(
      'SELECT usuario_id, libro_id, estado FROM reservas WHERE id = ?', [req.params.id],
    );
    if (!reserva) { res.status(404).json({ error: 'Reserva no encontrada' }); return; }
    if (reserva.estado !== 'pendiente') {
      res.status(400).json({ error: 'Solo se pueden confirmar reservas pendientes' }); return;
    }

    const { dias = 7 } = req.body as { dias?: number };
    const devolucion = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const loanId = randomUUID();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Marcar reserva como completada (el stock ya estaba descontado, NO volver a descontar)
      await conn.execute(`UPDATE reservas SET estado='completada' WHERE id=?`, [req.params.id]);

      // Crear el préstamo sin el trigger de stock (stock ya fue descontado en la reserva)
      // Usamos una bandera de sesión para saltarnos el trigger
      await conn.execute(`SET @skip_loan_trigger = 1`);
      await conn.execute(
        `INSERT INTO loans (id,libro_id,usuario_id,fecha_devolucion_estimada,estado,renovaciones,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [loanId, reserva.libro_id, reserva.usuario_id,
          toMysqlDt(devolucion), 'active', 0, toMysqlDt(new Date())],
      );
      await conn.execute(`SET @skip_loan_trigger = 0`);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    res.json({ ok: true, loan_id: loanId });
  } catch (err) {
    console.error('PATCH /reservas/confirm:', err);
    res.status(500).json({ error: 'Error al confirmar reserva' });
  }
});

export default router;
