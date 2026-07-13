/**
 * Script de migración: copia datos de Supabase → MySQL.
 * Requiere en el .env raíz: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY
 * Requiere en server/.env: DB_* credentials
 * Uso: desde la carpeta server/ correr:
 *   npx tsx scripts/migrate-from-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Cargar .env del proyecto raíz y de server/ ────────────────────────────────
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(path.resolve(__dirname, '../../.env'));   // raíz del proyecto
loadEnv(path.resolve(__dirname, '../.env'));       // server/

// ── Clientes ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey  = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: faltan VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY en el .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const db = await mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'biblioteca',
  waitForConnections: true,
  connectionLimit:    5,
  timezone: '+00:00',
  charset:  'utf8mb4',
});

// ── Paginación genérica de Supabase ───────────────────────────────────────────
async function fetchAll<T>(table: string, PAGE = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) { console.error(`  ✗ Error leyendo ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dt(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}
function dateOnly(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  return s.slice(0, 10);
}
function str(v: unknown): string | null { return v == null ? null : String(v); }
function num(v: unknown): number | null { const n = Number(v); return isNaN(n) ? null : n; }
function jsonStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

const DEFAULT_PASSWORD_HASH = await bcrypt.hash('Colegio123', 12);
console.log('✅ Hash de contraseña por defecto generado.\n');

// ── Migración por tabla ───────────────────────────────────────────────────────

async function migrateCategories() {
  process.stdout.write('categories... ');
  const rows = await fetchAll<Record<string, unknown>>('categories');
  if (!rows.length) { console.log('(vacía)'); return; }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO categories (id,nombre,descripcion,color_hex,created_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre)`,
        [r.id, r.nombre, str(r.descripcion), str(r.color_hex) || '#3B82F6', dt(r.created_at) || new Date().toISOString().slice(0,19).replace('T',' ')],
      );
    }
    await conn.commit();
    console.log(`✅ ${rows.length} filas`);
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally { conn.release(); }
}

async function migrateLocations() {
  process.stdout.write('locations... ');
  const rows = await fetchAll<Record<string, unknown>>('locations');
  if (!rows.length) { console.log('(vacía)'); return; }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO locations (id,shelf_name,section,\`row\`,capacity,current_occupancy,created_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE shelf_name=VALUES(shelf_name)`,
        [r.id, r.shelf_name, str(r.section), str(r.row), num(r.capacity) ?? 100, num(r.current_occupancy) ?? 0, dt(r.created_at) || new Date().toISOString().slice(0,19).replace('T',' ')],
      );
    }
    await conn.commit();
    console.log(`✅ ${rows.length} filas`);
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally { conn.release(); }
}

async function migrateProfiles() {
  process.stdout.write('profiles (usuarios)... ');
  const rows = await fetchAll<Record<string, unknown>>('profiles');
  if (!rows.length) { console.log('(vacía)'); return; }
  const conn = await db.getConnection();
  let ok = 0;
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO profiles (id,email,full_name,role,codigo_identificacion,telefono,estado,avatar_url,section,course,level,password_hash,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE email=VALUES(email), full_name=VALUES(full_name)`,
        [
          r.id, String(r.email).toLowerCase().trim(), str(r.full_name),
          str(r.role) || 'student', str(r.codigo_identificacion), str(r.telefono),
          str(r.estado) || 'activo', str(r.avatar_url),
          str(r.section), str(r.course), str(r.level),
          DEFAULT_PASSWORD_HASH,
          dt(r.created_at) || new Date().toISOString().slice(0,19).replace('T',' '),
          dt(r.updated_at) || new Date().toISOString().slice(0,19).replace('T',' '),
        ],
      );
      ok++;
    }
    await conn.commit();
    console.log(`✅ ${ok} filas (contraseñas reseteadas a 'Colegio123')`);
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally { conn.release(); }
}

async function migrateBooks() {
  process.stdout.write('books... ');
  const rows = await fetchAll<Record<string, unknown>>('books');
  if (!rows.length) { console.log('(vacía)'); return; }
  const conn = await db.getConnection();
  let ok = 0; const errors: string[] = [];
  // Deshabilitar triggers temporalmente para no alterar cantidad_disponible al insertar préstamos después
  await conn.execute('SET @DISABLE_TRIGGERS = 1');
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      try {
        await conn.execute(
          `INSERT INTO books (id,titulo,autor,isbn,editorial,anio_publicacion,categoria_id,ubicacion_id,cantidad_total,cantidad_disponible,codigo_barras,imagen_portada_url,estado,coleccion,numero_inventario,fecha_ingreso,formato_material,idioma,numero_clasificacion,titulo_paralelo,numero_ejemplar,lugar_publicacion,mencion_serie,numero_paginas,terminos_tematicos,fecha_adquisicion,precio,orden_compra,nota,resena,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE titulo=VALUES(titulo)`,
          [r.id,r.titulo,r.autor,str(r.isbn),str(r.editorial),num(r.año_publicacion??r.anio_publicacion),r.categoria_id??null,r.ubicacion_id??null,num(r.cantidad_total)??1,num(r.cantidad_disponible)??1,str(r.codigo_barras),str(r.imagen_portada_url),str(r.estado)||'disponible',str(r.coleccion),str(r.numero_inventario),dateOnly(r.fecha_ingreso),str(r.formato_material),str(r.idioma),str(r.numero_clasificacion),str(r.titulo_paralelo),num(r.numero_ejemplar),str(r.lugar_publicacion),str(r.mencion_serie),str(r.numero_paginas),str(r.terminos_tematicos),dateOnly(r.fecha_adquisicion),num(r.precio),str(r.orden_compra),str(r.nota),str(r.resena),dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
        );
        ok++;
      } catch (e) { errors.push(`${r.id}: ${e}`); }
    }
    await conn.commit();
    console.log(`✅ ${ok} filas${errors.length ? `, ${errors.length} errores` : ''}`);
    if (errors.length) errors.slice(0,5).forEach(e => console.log('  ', e));
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally {
    await conn.execute('SET @DISABLE_TRIGGERS = 0');
    conn.release();
  }
}

async function migrateLoans() {
  process.stdout.write('loans... ');
  const rows = await fetchAll<Record<string, unknown>>('loans');
  if (!rows.length) { console.log('(vacía)'); return; }
  // Insertar sin disparar el trigger de stock (el stock ya viene correcto de Supabase)
  // Usar query() en lugar de execute() para DDL que no soporta prepared statements
  await db.query('DROP TRIGGER IF EXISTS trg_loan_checkout');
  const conn = await db.getConnection();
  let ok = 0;
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      await conn.execute(
        `INSERT INTO loans (id,libro_id,usuario_id,fecha_prestamo,fecha_devolucion_estimada,fecha_devolucion_real,estado,renovaciones,created_at)
         VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=VALUES(estado)`,
        [r.id,r.libro_id,r.usuario_id,dt(r.fecha_prestamo),dt(r.fecha_devolucion_estimada),dt(r.fecha_devolucion_real),str(r.estado)||'active',num(r.renovaciones)??0,dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
      );
      ok++;
    }
    await conn.commit();
    console.log(`✅ ${ok} filas`);
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally { conn.release(); }
  // Recrear trigger usando query() (DDL)
  await db.query('DROP TRIGGER IF EXISTS trg_loan_checkout');
  await db.query(`
    CREATE TRIGGER trg_loan_checkout
    AFTER INSERT ON loans FOR EACH ROW
    BEGIN UPDATE books SET cantidad_disponible = cantidad_disponible - 1 WHERE id = NEW.libro_id; END
  `);
}

async function migrateSimple(table: string, insertFn: (conn: mysql.PoolConnection, r: Record<string, unknown>) => Promise<void>) {
  process.stdout.write(`${table}... `);
  const rows = await fetchAll<Record<string, unknown>>(table);
  if (!rows.length) { console.log('(vacía)'); return; }
  const conn = await db.getConnection();
  let ok = 0;
  try {
    await conn.beginTransaction();
    for (const r of rows) { await insertFn(conn, r); ok++; }
    await conn.commit();
    console.log(`✅ ${ok} filas`);
  } catch (e) { await conn.rollback(); console.log(`✗ ${e}`); } finally { conn.release(); }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('=== Migración Supabase → MySQL ===\n');

await migrateCategories();
await migrateLocations();
await migrateProfiles();
await migrateBooks();
await migrateLoans();

await migrateSimple('reservas', async (conn, r) => {
  await conn.execute(
    `INSERT INTO reservas (id,libro_id,usuario_id,fecha_reserva,fecha_expiracion,estado,created_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=VALUES(estado)`,
    [r.id,r.libro_id,r.usuario_id,dt(r.fecha_reserva),dt(r.fecha_expiracion),str(r.estado)||'pendiente',dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
  );
});

await migrateSimple('multas', async (conn, r) => {
  await conn.execute(
    `INSERT INTO multas (id,prestamo_id,usuario_id,monto,motivo,estado,fecha_generacion,fecha_pago) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE monto=VALUES(monto)`,
    [r.id,r.prestamo_id??null,r.usuario_id,num(r.monto)??0,str(r.motivo),str(r.estado)||'pendiente',dt(r.fecha_generacion)||new Date().toISOString().slice(0,19).replace('T',' '),dt(r.fecha_pago)],
  );
});

await migrateSimple('notificaciones', async (conn, r) => {
  await conn.execute(
    `INSERT INTO notificaciones (id,usuario_id,tipo,mensaje,leida,created_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE mensaje=VALUES(mensaje)`,
    [r.id,r.usuario_id,str(r.tipo)||'info',str(r.mensaje)||'',r.leida?1:0,dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
  );
});

await migrateSimple('configuracion_sistema', async (conn, r) => {
  await conn.execute(
    `INSERT INTO configuracion_sistema (clave,valor,tipo_dato,descripcion) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)`,
    [str(r.clave),str(r.valor)||'',str(r.tipo_dato),str(r.descripcion)],
  );
});

// Tablas de research (pueden no existir en Supabase)
try {
  await migrateSimple('articles', async (conn, r) => {
    await conn.execute(
      `INSERT INTO articles (id,title,abstract_text,authors,journal_id,journal_title,publication_date,keywords,doi,url,language,source,last_updated,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title)`,
      [str(r.id)||randomUUID(),str(r.title)||'',str(r.abstract),jsonStr(r.authors)||'[]',str(r.journal_id),str(r.journal_title),dateOnly(r.publication_date),jsonStr(r.keywords)||'[]',str(r.doi),str(r.url),str(r.language),str(r.source)||'doaj',dt(r.last_updated),dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
    );
  });
} catch { console.log('articles: tabla no encontrada en Supabase (omitida)'); }

try {
  await migrateSimple('journals', async (conn, r) => {
    await conn.execute(
      `INSERT INTO journals (id,title,issn_print,issn_online,publisher,country,language,subjects,license,url,last_updated,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title)`,
      [str(r.id)||randomUUID(),str(r.title)||'',str(r.issn_print),str(r.issn_online),str(r.publisher),str(r.country),jsonStr(r.language)||'[]',jsonStr(r.subjects)||'[]',str(r.license),str(r.url),dt(r.last_updated),dt(r.created_at)||new Date().toISOString().slice(0,19).replace('T',' ')],
    );
  });
} catch { console.log('journals: tabla no encontrada en Supabase (omitida)'); }

console.log('\n=== Migración completa ===');
await db.end();
process.exit(0);
