import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { comparePassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth, type AuthRequest } from '../auth/middleware.js';
import { randomUUID } from 'crypto';
import {
  buildAuthorizeUrl,
  exchangeCodeForUser,
  entraIsConfigured,
  crearTicket,
  canjearTicket,
  EntraError,
} from '../auth/entra.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// SSO con Microsoft Entra ID
// ─────────────────────────────────────────────────────────────────────────────

/** A dónde volver en el frontend tras el rodeo por Microsoft. */
const frontendBase = (): string => {
  const origenes = (process.env.CORS_ORIGIN ?? '').split(',').map(o => o.trim()).filter(Boolean);
  return process.env.FRONTEND_URL ?? origenes[0] ?? '';
};

const volverAlLogin = (res: import('express').Response, params: Record<string, string>): void => {
  const q = new URLSearchParams(params).toString();
  res.redirect(`${frontendBase()}/login?${q}`);
};

// GET /auth/sso/status — el frontend decide si muestra el botón de Microsoft
router.get('/sso/status', (_req, res) => {
  res.json({ microsoft: entraIsConfigured() });
});

// GET /auth/microsoft — arranca el flujo
router.get('/microsoft', (_req, res) => {
  try {
    res.redirect(buildAuthorizeUrl());
  } catch (err) {
    const msg = err instanceof EntraError ? err.message : 'No se pudo iniciar el SSO';
    console.error('sso inicio:', msg);
    volverAlLogin(res, { sso_error: msg });
  }
});

// GET /auth/microsoft/callback — Microsoft devuelve aquí al usuario
router.get('/microsoft/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;

  if (error) {
    volverAlLogin(res, { sso_error: error_description ?? error });
    return;
  }
  if (!code || !state) {
    volverAlLogin(res, { sso_error: 'Respuesta incompleta de Microsoft.' });
    return;
  }

  try {
    const usuario = await exchangeCodeForUser(code, state);

    let perfil = await queryOne<Record<string, unknown>>(
      'SELECT * FROM profiles WHERE email = ?',
      [usuario.email],
    );

    if (!perfil) {
      // Alta automática como estudiante. La contraseña queda vacía a
      // propósito: comparePassword contra un hash vacío siempre falla, así
      // que estas cuentas sólo pueden entrar por SSO.
      const id = randomUUID();
      await query(
        `INSERT INTO profiles (id, email, full_name, role, estado, password_hash)
         VALUES (?, ?, ?, 'student', 'activo', '')`,
        [id, usuario.email, usuario.nombre],
      );
      perfil = await queryOne<Record<string, unknown>>('SELECT * FROM profiles WHERE id = ?', [id]);
      console.log(`sso: alta automática de ${usuario.email}`);
    }

    if (!perfil) {
      volverAlLogin(res, { sso_error: 'No se pudo preparar el perfil.' });
      return;
    }
    if (perfil.estado !== 'activo') {
      volverAlLogin(res, { sso_error: 'Tu cuenta de biblioteca está inactiva. Contacta a la biblioteca.' });
      return;
    }

    const token = signToken({
      id:    perfil.id as string,
      email: perfil.email as string,
      role:  perfil.role as 'admin' | 'teacher' | 'student',
    });

    const { password_hash: _omitido, ...perfilSeguro } = perfil;

    // El JWT no viaja en la URL: se entrega un ticket de un solo uso.
    const ticket = crearTicket(token, perfilSeguro);
    res.redirect(`${frontendBase()}/auth/callback?ticket=${encodeURIComponent(ticket)}`);
  } catch (err) {
    const msg = err instanceof EntraError ? err.message : 'Error validando la cuenta de Microsoft';
    console.error('sso callback:', err instanceof Error ? err.message : err);
    volverAlLogin(res, { sso_error: msg });
  }
});

// POST /auth/sso/exchange — el frontend canjea el ticket por el JWT
router.post('/sso/exchange', (req, res) => {
  const { ticket } = req.body as { ticket?: string };
  if (!ticket) {
    res.status(400).json({ error: 'Falta el ticket' });
    return;
  }
  const datos = canjearTicket(ticket);
  if (!datos) {
    res.status(401).json({ error: 'Ticket inválido o expirado. Vuelve a iniciar sesión.' });
    return;
  }
  res.json({ token: datos.token, profile: datos.perfil });
});

export default router;
