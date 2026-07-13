import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth, type AuthRequest } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/pending-total', async (_req, res) => {
  try {
    const row = await queryOne<{ total: number }>(`SELECT COALESCE(SUM(monto),0) AS total FROM multas WHERE estado='pendiente'`);
    res.json(row?.total ?? 0);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

router.get('/user/:userId/pending', async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.id !== req.params.userId) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    const row = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(monto),0) AS total FROM multas WHERE usuario_id=? AND estado='pendiente'`,
      [req.params.userId],
    );
    res.json(row?.total ?? 0);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

export default router;
