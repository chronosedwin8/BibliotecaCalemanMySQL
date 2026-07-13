import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db.js';
import { requireAuth, requireRole, type AuthRequest } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';
import { uploadObject } from '../s3.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const DEFAULT_PASSWORD = 'Colegio123';

router.use(requireAuth);

function safeProfile(row: Record<string, unknown>) {
  const { password_hash: _, ...rest } = row;
  return rest;
}

// GET /users/search?term=
router.get('/search', async (req, res) => {
  try {
    const { term = '' } = req.query as { term: string };
    const t = `%${term.trim()}%`;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM profiles WHERE full_name LIKE ? OR email LIKE ? OR codigo_identificacion LIKE ? LIMIT 10`,
      [t, t, t],
    );
    res.json(rows.map(safeProfile));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /users/courses
router.get('/courses', async (_req, res) => {
  try {
    const rows = await query<{ course: string }>('SELECT DISTINCT course FROM profiles WHERE course IS NOT NULL ORDER BY course');
    res.json(rows.map(r => r.course));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /users/export
router.get('/export', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await query<Record<string, unknown>>('SELECT * FROM profiles ORDER BY full_name');
    res.json(rows.map(safeProfile));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// GET /users
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { search, role, course, estado } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search?.trim()) {
      const t = `%${search.trim()}%`;
      conditions.push(`(full_name LIKE ? OR email LIKE ? OR codigo_identificacion LIKE ? OR course LIKE ?)`);
      params.push(t, t, t, t);
    }
    if (role)   { conditions.push('role = ?');   params.push(role); }
    if (course) { conditions.push('course = ?'); params.push(course); }
    if (estado) { conditions.push('estado = ?'); params.push(estado); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = await query<Record<string, unknown>>(`SELECT * FROM profiles ${where} ORDER BY full_name`, params);
    res.json(rows.map(safeProfile));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al obtener usuarios' }); }
});

// GET /users/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    // Un usuario no-admin solo puede ver su propio perfil
    if (req.user!.role !== 'admin' && req.user!.id !== req.params.id) {
      res.status(403).json({ error: 'Acceso denegado' }); return;
    }
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM profiles WHERE id = ?', [req.params.id]);
    if (!row) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(safeProfile(row));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /users
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const d = req.body;
    const id = randomUUID();
    const hash = await hashPassword(d.password || DEFAULT_PASSWORD);
    await execute(
      `INSERT INTO profiles (id,email,full_name,role,codigo_identificacion,telefono,section,course,level,estado,password_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.email.toLowerCase().trim(), d.full_name, d.role ?? 'student', d.codigo_identificacion ?? null, d.telefono ?? null, d.section ?? null, d.course ?? null, d.level ?? null, 'activo', hash],
    );
    const created = await queryOne<Record<string, unknown>>('SELECT * FROM profiles WHERE id = ?', [id]);
    res.status(201).json(safeProfile(created!));
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('Duplicate entry') && msg.includes('email')) {
      res.status(409).json({ error: 'El email ya está registrado' });
    } else if (msg.includes('Duplicate entry') && msg.includes('codigo_identificacion')) {
      res.status(409).json({ error: 'El código de identificación ya existe' });
    } else {
      console.error(err); res.status(500).json({ error: 'Error al crear usuario' });
    }
  }
});

// PUT /users/:id
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const d = req.body;
    await execute(
      `UPDATE profiles SET full_name=?,role=?,codigo_identificacion=?,telefono=?,section=?,course=?,level=?,avatar_url=?,updated_at=NOW() WHERE id=?`,
      [d.full_name, d.role, d.codigo_identificacion ?? null, d.telefono ?? null, d.section ?? null, d.course ?? null, d.level ?? null, d.avatar_url ?? null, req.params.id],
    );
    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM profiles WHERE id = ?', [req.params.id]);
    res.json(safeProfile(updated!));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al actualizar usuario' }); }
});

// PATCH /users/:id/estado
router.patch('/:id/estado', requireRole('admin'), async (req, res) => {
  try {
    const { estado } = req.body as { estado: 'activo' | 'inactivo' };
    await execute('UPDATE profiles SET estado=?, updated_at=NOW() WHERE id=?', [estado, req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// POST /users/:id/avatar
router.post('/:id/avatar', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Archivo requerido' }); return; }
    const ext = req.file.originalname.split('.').pop() ?? 'jpg';
    const key = `avatars/${req.params.id}.${ext}`;
    const url = await uploadObject(key, req.file.buffer, req.file.mimetype);
    const finalUrl = `${url}?t=${Date.now()}`;
    await execute('UPDATE profiles SET avatar_url=?, updated_at=NOW() WHERE id=?', [finalUrl, req.params.id]);
    res.json({ url: finalUrl });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al subir avatar' }); }
});

// POST /users/bulk
router.post('/bulk', requireRole('admin'), async (req, res) => {
  const rows: Record<string, unknown>[] = req.body;
  if (!Array.isArray(rows)) { res.status(400).json({ error: 'Array esperado' }); return; }

  let created = 0, updated = 0;
  const errors: { row: number; codigo: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      // Buscar por codigo_identificacion
      const byCodigo = await queryOne<{ id: string }>('SELECT id FROM profiles WHERE codigo_identificacion = ?', [r.codigo_identificacion]);
      if (byCodigo) {
        await execute(
          'UPDATE profiles SET full_name=?,section=?,course=?,level=?,updated_at=NOW() WHERE id=?',
          [r.full_name, r.section ?? null, r.course ?? null, r.level ?? null, byCodigo.id],
        );
        updated++; continue;
      }

      // Buscar por email
      const byEmail = await queryOne<{ id: string }>('SELECT id FROM profiles WHERE email = ?', [(r.email as string).toLowerCase().trim()]);
      if (byEmail) {
        await execute(
          'UPDATE profiles SET full_name=?,codigo_identificacion=?,section=?,course=?,level=?,updated_at=NOW() WHERE id=?',
          [r.full_name, r.codigo_identificacion ?? null, r.section ?? null, r.course ?? null, r.level ?? null, byEmail.id],
        );
        updated++; continue;
      }

      // Crear nuevo
      const id = randomUUID();
      const hash = await hashPassword((r.password as string) || DEFAULT_PASSWORD);
      await execute(
        `INSERT INTO profiles (id,email,full_name,role,codigo_identificacion,section,course,level,estado,password_hash) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, (r.email as string).toLowerCase().trim(), r.full_name, r.role ?? 'student', r.codigo_identificacion ?? null, r.section ?? null, r.course ?? null, r.level ?? null, 'activo', hash],
      );
      created++;
    } catch (err) {
      errors.push({ row: i + 1, codigo: String(r.codigo_identificacion), message: String(err) });
    }
  }
  res.json({ created, updated, errors });
});

export default router;
