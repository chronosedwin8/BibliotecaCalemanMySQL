/**
 * Inicio de sesión con Microsoft Entra ID (Azure AD).
 *
 * Flujo de código de autorización con cliente confidencial: el secreto vive
 * sólo en el backend y el navegador nunca lo ve. Microsoft autentica, aquí se
 * valida el id_token y se emite el JWT propio de la aplicación.
 */
import 'dotenv/config';
import { createPublicKey, randomBytes } from 'crypto';
import jwt, { type JwtHeader } from 'jsonwebtoken';

const TENANT        = process.env.ENTRA_TENANT_ID     ?? '';
const CLIENT_ID     = process.env.ENTRA_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET ?? '';
const REDIRECT_URI  = process.env.ENTRA_REDIRECT_URI  ?? '';

/** Dominios institucionales aceptados. Separados por coma. */
export const ALLOWED_DOMAINS = (process.env.SSO_ALLOWED_DOMAINS ?? 'colegioaleman.edu.co')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

const authority = (): string => `https://login.microsoftonline.com/${TENANT}`;

export class EntraError extends Error {}

export function entraIsConfigured(): boolean {
  return Boolean(TENANT && CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

function requireConfig(): void {
  if (!entraIsConfigured()) {
    throw new EntraError('SSO de Microsoft no configurado: faltan variables ENTRA_* en el entorno.');
  }
}

const aleatorio = (): string => randomBytes(32).toString('base64url');

function limpiar<T extends { creado: number }>(m: Map<string, T>, vida: number): void {
  const ahora = Date.now();
  for (const [k, v] of m) if (ahora - v.creado > vida) m.delete(k);
}

// ─── Estado de las peticiones en curso ───────────────────────────────────────
// El `state` evita CSRF y el `nonce` ataques de repetición. Viven en memoria
// porque duran segundos; con varias instancias habría que moverlos a la BD.

interface Pendiente { nonce: string; creado: number }
const pendientes = new Map<string, Pendiente>();
const VIDA_ESTADO_MS = 10 * 60 * 1000;

/** URL a la que se manda el navegador para autenticarse contra Microsoft. */
export function buildAuthorizeUrl(): string {
  requireConfig();
  limpiar(pendientes, VIDA_ESTADO_MS);

  const state = aleatorio();
  const nonce = aleatorio();
  pendientes.set(state, { nonce, creado: Date.now() });

  const u = new URL(`${authority()}/oauth2/v2.0/authorize`);
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('response_mode', 'query');
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  return u.toString();
}

/** Consume un `state`: sólo vale una vez. */
function consumirEstado(state: string): Pendiente {
  limpiar(pendientes, VIDA_ESTADO_MS);
  const p = pendientes.get(state);
  if (!p) throw new EntraError('Estado inválido o expirado. Vuelve a iniciar sesión.');
  pendientes.delete(state);
  return p;
}

// ─── Claves públicas de Microsoft (JWKS) ─────────────────────────────────────

interface Jwk { kid: string; kty: string; x5c?: string[]; n?: string; e?: string }
let jwksCache: { claves: Jwk[]; creado: number } | null = null;
const VIDA_JWKS_MS = 60 * 60 * 1000;

async function descargarJwks(): Promise<Jwk[]> {
  const res = await fetch(`${authority()}/discovery/v2.0/keys`);
  if (!res.ok) {
    throw new EntraError(`No se pudieron obtener las claves de Microsoft (HTTP ${res.status}).`);
  }
  const { keys } = await res.json() as { keys: Jwk[] };
  jwksCache = { claves: keys, creado: Date.now() };
  return keys;
}

function jwkAPem(jwk: Jwk): string {
  if (jwk.x5c && jwk.x5c[0]) {
    const cuerpo = jwk.x5c[0].match(/.{1,64}/g);
    if (cuerpo) {
      return `-----BEGIN CERTIFICATE-----\n${cuerpo.join('\n')}\n-----END CERTIFICATE-----\n`;
    }
  }
  if (jwk.n && jwk.e) {
    return createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' }).toString();
  }
  throw new EntraError('La clave de Microsoft no trae material utilizable.');
}

async function obtenerClave(kid: string): Promise<string> {
  let claves = jwksCache && Date.now() - jwksCache.creado < VIDA_JWKS_MS
    ? jwksCache.claves
    : await descargarJwks();

  let jwk = claves.find(k => k.kid === kid);
  if (!jwk) {
    // Microsoft rota sus claves: recargar antes de rendirse.
    claves = await descargarJwks();
    jwk = claves.find(k => k.kid === kid);
  }
  if (!jwk) throw new EntraError('Microsoft firmó el token con una clave desconocida.');
  return jwkAPem(jwk);
}

// ─── Intercambio de código y validación ──────────────────────────────────────

export interface UsuarioEntra {
  email: string;
  nombre: string;
  oid: string;
}

interface IdTokenClaims {
  aud?: string; iss?: string; nonce?: string; oid?: string; tid?: string;
  email?: string; preferred_username?: string; upn?: string;
  name?: string; given_name?: string; family_name?: string;
}

/** Canjea el código de Microsoft y devuelve el usuario ya validado. */
export async function exchangeCodeForUser(code: string, state: string): Promise<UsuarioEntra> {
  requireConfig();
  const { nonce } = consumirEstado(state);

  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      scope:         'openid profile email',
    }),
  });

  const cuerpo = await res.json() as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !cuerpo.id_token) {
    throw new EntraError(
      cuerpo.error_description ?? cuerpo.error ?? `Microsoft rechazó el código (HTTP ${res.status}).`,
    );
  }

  const decodificado = jwt.decode(cuerpo.id_token, { complete: true });
  if (!decodificado) throw new EntraError('El id_token de Microsoft no es legible.');

  const pem = await obtenerClave((decodificado.header as JwtHeader).kid ?? '');

  let claims: IdTokenClaims;
  try {
    claims = jwt.verify(cuerpo.id_token, pem, {
      algorithms: ['RS256'],
      audience:   CLIENT_ID,
      issuer:     `https://login.microsoftonline.com/${TENANT}/v2.0`,
    }) as IdTokenClaims;
  } catch (err) {
    throw new EntraError(`Token de Microsoft inválido: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (claims.nonce !== nonce) throw new EntraError('El nonce no coincide: posible intento de repetición.');
  if (claims.tid !== TENANT)  throw new EntraError('El token proviene de otro directorio.');

  const email = (claims.email ?? claims.preferred_username ?? claims.upn ?? '').trim().toLowerCase();
  if (!email) throw new EntraError('Microsoft no devolvió un correo para esta cuenta.');

  const dominio = email.split('@')[1] ?? '';
  if (!ALLOWED_DOMAINS.includes(dominio)) {
    throw new EntraError(`Sólo se permiten cuentas de ${ALLOWED_DOMAINS.join(', ')}.`);
  }

  const nombre = (claims.name ?? [claims.given_name, claims.family_name].filter(Boolean).join(' ')).trim();

  return { email, nombre: nombre || email.split('@')[0], oid: claims.oid ?? '' };
}

// ─── Tickets de un solo uso ──────────────────────────────────────────────────
// El JWT no viaja en la URL de retorno: se entrega un ticket efímero que el
// frontend canjea por POST. Así el token no queda en el historial ni en logs.

interface Ticket { token: string; perfil: unknown; creado: number }
const tickets = new Map<string, Ticket>();
const VIDA_TICKET_MS = 60 * 1000;

export function crearTicket(token: string, perfil: unknown): string {
  limpiar(tickets, VIDA_TICKET_MS);
  const t = aleatorio();
  tickets.set(t, { token, perfil, creado: Date.now() });
  return t;
}

export function canjearTicket(t: string): { token: string; perfil: unknown } | null {
  limpiar(tickets, VIDA_TICKET_MS);
  const v = tickets.get(t);
  if (!v) return null;
  tickets.delete(t);   // un solo uso
  return { token: v.token, perfil: v.perfil };
}
