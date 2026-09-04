/**
 * Cliente de la API REST de Phidias (Colegio Alemán de Barranquilla).
 *
 * Sólo se usa desde el backend: el token es un secreto y no debe viajar
 * al navegador. Al correr en Node tampoco hay problema de CORS, así que
 * no hacen falta proxies.
 */
import 'dotenv/config';

const BASE_URL = process.env.PHIDIAS_BASE_URL ?? 'https://ds-barranquilla.phidias.co/rest';
const TOKEN    = process.env.PHIDIAS_TOKEN ?? '';
const TIMEOUT  = Number(process.env.PHIDIAS_TIMEOUT_MS ?? 60_000);
const RETRIES  = 2;

export class PhidiasError extends Error {}

export function phidiasIsConfigured(): boolean {
  return TOKEN.length > 0;
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  if (!TOKEN) {
    throw new PhidiasError('Falta PHIDIAS_TOKEN en server/.env');
  }

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  let lastErr: unknown;
  for (let intento = 0; intento <= RETRIES; intento++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        signal: ac.signal,
      });

      if (res.status === 401 || res.status === 403) {
        // Reintentar no sirve: el token es inválido o le faltan permisos.
        throw new PhidiasError(`Phidias rechazó el token (HTTP ${res.status}). Revisa PHIDIAS_TOKEN.`);
      }
      if (!res.ok) throw new PhidiasError(`Phidias respondió HTTP ${res.status} en ${path}`);

      return await res.json() as T;
    } catch (err) {
      if (err instanceof PhidiasError) throw err;
      lastErr = err;
      if (intento < RETRIES) await new Promise(r => setTimeout(r, 1000 * (intento + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  const detalle = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new PhidiasError(`No se pudo contactar a Phidias (${path}): ${detalle}`);
}

// ─── Estudiantes matriculados ────────────────────────────────────────────────
// GET /1/course/consolidate → nivel[] → courses[] → sections[] → students[]

export interface PhidiasStudent {
  id: number;
  code: number | string | null;
  firstname: string | null;
  lastname: string | null;
  lastname1: string | null;
  lastname2: string | null;
  email: string | null;
  document: number | string | null;
  mobile: number | string | null;
  phone: number | string | null;
  enrollment?: { status?: string | null } | null;
}

interface Nivel {
  id: number;
  name: string;
  courses?: { id: number; name: string; sections?: { id: number; name: string; students?: PhidiasStudent[] }[] }[];
}

/** Un estudiante ya aplanado, con su ubicación académica resuelta. */
export interface MatriculaPlana {
  student: PhidiasStudent;
  level: string;    // KINDERGARTEN | PRIMARIA | SECUNDARIA
  course: string;   // KLASSE 3, KINDERKRIPPE…
  section: string;  // K3C, KKP1…
  status: string;   // activo | inscrito | retirado | pendiente | Admitido
}

export async function fetchMatriculas(year?: number): Promise<MatriculaPlana[]> {
  const data = await getJson<Nivel[]>('/1/course/consolidate', { year });

  const out: MatriculaPlana[] = [];
  for (const nivel of data ?? []) {
    for (const curso of nivel.courses ?? []) {
      for (const seccion of curso.sections ?? []) {
        for (const student of seccion.students ?? []) {
          out.push({
            student,
            level:   nivel.name   ?? '',
            course:  curso.name   ?? '',
            section: seccion.name ?? '',
            status:  student.enrollment?.status ?? '',
          });
        }
      }
    }
  }
  return out;
}
