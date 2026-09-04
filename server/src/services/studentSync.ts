/**
 * Sincronización de estudiantes desde Phidias hacia la tabla `profiles`.
 *
 * Reglas acordadas:
 *  - Sólo se importan matrículas con estado "activo".
 *  - Los estudiantes que ya no vienen en Phidias se marcan `inactivo`
 *    (nunca se borran: conservan préstamos, multas e historial).
 *  - Nunca se toca `password_hash` de alguien que ya existe.
 *  - Nunca se toca a quien no tenga rol `student` (protege a los admin).
 */
import { randomUUID } from 'crypto';
import { pool, query } from '../db.js';
import { hashPassword } from '../auth/password.js';
import { fetchMatriculas, type MatriculaPlana } from './phidias.js';

const ESTADO_MATRICULA_VALIDO = 'activo';
const PASSWORD_POR_DEFECTO    = 'Colegio123';

export interface SyncOptions {
  /** No escribe nada; sólo informa qué haría. */
  dryRun?: boolean;
  /** Marca inactivo a quien ya no esté en Phidias. */
  desactivarAusentes?: boolean;
  year?: number;
}

export interface SyncResult {
  dryRun: boolean;
  leidosDeApi: number;
  matriculasActivas: number;
  creados: number;
  actualizados: number;
  sinCambios: number;
  desactivados: number;
  omitidos: { email: string | null; codigo: string | null; nombre: string; motivo: string }[];
  errores: { email: string | null; motivo: string }[];
  duracionMs: number;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  codigo_identificacion: string | null;
  estado: string;
  level: string | null;
  course: string | null;
  section: string | null;
}

/** "GLORIA INÉS" + "PÉREZ" + "YEPES" → "GLORIA INÉS PÉREZ YEPES" */
function nombreCompleto(m: MatriculaPlana): string {
  const s = m.student;
  const partes = [s.firstname, s.lastname1, s.lastname2]
    .map(p => (p ?? '').trim())
    .filter(Boolean);
  // Si no vinieron los apellidos separados, caer al campo `lastname` completo.
  if (partes.length <= 1 && s.lastname) {
    return [(s.firstname ?? '').trim(), s.lastname.trim()].filter(Boolean).join(' ');
  }
  return partes.join(' ');
}

const norm = (v: unknown): string => (v ?? '').toString().trim();
const normEmail = (v: unknown): string => norm(v).toLowerCase();

export async function syncStudentsFromPhidias(opts: SyncOptions = {}): Promise<SyncResult> {
  const t0 = Date.now();
  const { dryRun = false, desactivarAusentes = true, year } = opts;

  const res: SyncResult = {
    dryRun, leidosDeApi: 0, matriculasActivas: 0,
    creados: 0, actualizados: 0, sinCambios: 0, desactivados: 0,
    omitidos: [], errores: [], duracionMs: 0,
  };

  // ── 1. Traer y filtrar ─────────────────────────────────────────────────
  const matriculas = await fetchMatriculas(year);
  res.leidosDeApi = matriculas.length;

  const activas = matriculas.filter(
    m => m.status.toLowerCase() === ESTADO_MATRICULA_VALIDO,
  );
  res.matriculasActivas = activas.length;

  // ── 2. Estado actual de la BD ──────────────────────────────────────────
  const perfiles = await query<ProfileRow>(
    `SELECT id, email, full_name, role, codigo_identificacion, estado, level, course, section
       FROM profiles`,
  );
  const porEmail  = new Map(perfiles.map(p => [normEmail(p.email), p]));
  const porCodigo = new Map(
    perfiles.filter(p => p.codigo_identificacion).map(p => [norm(p.codigo_identificacion), p]),
  );

  const vistos = new Set<string>();   // ids de profiles tocados en esta corrida
  const emailsUsados = new Set<string>();

  // ── 3. Crear / actualizar ──────────────────────────────────────────────
  for (const m of activas) {
    const email  = normEmail(m.student.email);
    const codigo = norm(m.student.code);
    const nombre = nombreCompleto(m);

    if (!email) {
      res.omitidos.push({ email: null, codigo: codigo || null, nombre, motivo: 'sin email en Phidias' });
      continue;
    }
    if (emailsUsados.has(email)) {
      res.omitidos.push({ email, codigo: codigo || null, nombre, motivo: 'email repetido en la respuesta de Phidias' });
      continue;
    }
    emailsUsados.add(email);

    // Buscar primero por código (estable) y si no, por email.
    const existente = (codigo ? porCodigo.get(codigo) : undefined) ?? porEmail.get(email);

    try {
      if (existente) {
        if (existente.role !== 'student') {
          res.omitidos.push({ email, codigo: codigo || null, nombre, motivo: `existe con rol '${existente.role}', no se modifica` });
          continue;
        }
        vistos.add(existente.id);

        const cambios =
          normEmail(existente.email) !== email ||
          norm(existente.full_name) !== nombre ||
          norm(existente.codigo_identificacion) !== codigo ||
          norm(existente.level)   !== norm(m.level) ||
          norm(existente.course)  !== norm(m.course) ||
          norm(existente.section) !== norm(m.section) ||
          existente.estado !== 'activo';

        if (!cambios) { res.sinCambios++; continue; }

        if (!dryRun) {
          await pool.execute(
            `UPDATE profiles
                SET email = ?, full_name = ?, codigo_identificacion = ?,
                    level = ?, course = ?, section = ?, estado = 'activo'
              WHERE id = ?`,
            [email, nombre, codigo || null, m.level, m.course, m.section, existente.id],
          );
        }
        res.actualizados++;
      } else {
        if (!dryRun) {
          const id = randomUUID();
          const hash = await hashPassword(PASSWORD_POR_DEFECTO);
          await pool.execute(
            `INSERT INTO profiles
               (id, email, full_name, role, codigo_identificacion, level, course, section, estado, password_hash)
             VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'activo', ?)`,
            [id, email, nombre, codigo || null, m.level, m.course, m.section, hash],
          );
          vistos.add(id);
        }
        res.creados++;
      }
    } catch (err) {
      // Choque de UNIQUE (email o código ya usados por otra fila), etc.
      const motivo = err instanceof Error ? err.message : String(err);
      res.errores.push({ email, motivo });
    }
  }

  // ── 4. Desactivar a quienes ya no están matriculados ───────────────────
  if (desactivarAusentes) {
    const ausentes = perfiles.filter(
      p => p.role === 'student' && p.estado === 'activo' && !vistos.has(p.id),
    );
    if (!dryRun && ausentes.length) {
      // En lotes: evita una sentencia con miles de parámetros.
      for (let i = 0; i < ausentes.length; i += 200) {
        const lote = ausentes.slice(i, i + 200);
        await pool.query(
          `UPDATE profiles SET estado = 'inactivo' WHERE id IN (${lote.map(() => '?').join(',')})`,
          lote.map(p => p.id),
        );
      }
    }
    res.desactivados = ausentes.length;
  }

  res.duracionMs = Date.now() - t0;
  return res;
}
