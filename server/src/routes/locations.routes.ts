import { Router } from 'express';
import { query, queryOne, execute } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM locations ORDER BY section, shelf_name, `row`');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

router.get('/sections', async (_req, res) => {
  try {
    const rows = await query<{ section: string }>('SELECT DISTINCT section FROM locations WHERE section IS NOT NULL ORDER BY section');
    res.json(rows.map(r => r.section));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { shelf_name, section, row, capacity } = req.body;
    const result = await execute(
      'INSERT INTO locations (shelf_name,section,`row`,capacity,current_occupancy) VALUES (?,?,?,?,0)',
      [shelf_name, section ?? null, row ?? null, capacity ?? 50],
    );
    const created = await queryOne('SELECT * FROM locations WHERE id = ?', [result.insertId]);
    res.status(201).json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al crear ubicación' }); }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { shelf_name, section, row, capacity, current_occupancy } = req.body;
    await execute(
      'UPDATE locations SET shelf_name=?,section=?,`row`=?,capacity=?,current_occupancy=? WHERE id=?',
      [shelf_name, section ?? null, row ?? null, capacity ?? 50, current_occupancy ?? 0, req.params.id],
    );
    const updated = await queryOne('SELECT * FROM locations WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al actualizar ubicación' }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await execute('DELETE FROM locations WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al eliminar ubicación' }); }
});

export default router;
