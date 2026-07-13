import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM categories ORDER BY nombre');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

export default router;
