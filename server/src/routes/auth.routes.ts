import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { comparePassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth, type AuthRequest } from '../auth/middleware.js';

const router = Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña requeridos' });
      return;
    }

    const profile = await queryOne<Record<string, unknown>>(
      'SELECT * FROM profiles WHERE email = ?',
      [email.toLowerCase().trim()],
    );

    if (!profile) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    if (profile.estado !== 'activo') {
      res.status(403).json({ error: 'Cuenta inactiva o suspendida' });
      return;
    }

    const valid = await comparePassword(password, profile.password_hash as string);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const token = signToken({
      id:    profile.id as string,
      email: profile.email as string,
      role:  profile.role as 'admin' | 'teacher' | 'student',
    });

    const { password_hash: _, ...safeProfile } = profile;
    res.json({ token, profile: safeProfile });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const profile = await queryOne<Record<string, unknown>>(
      'SELECT * FROM profiles WHERE id = ?',
      [req.user!.id],
    );
    if (!profile) { res.status(404).json({ error: 'Perfil no encontrado' }); return; }
    const { password_hash: _, ...safeProfile } = profile;
    res.json(safeProfile);
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
