/**
 * Crea o actualiza un usuario administrador.
 *
 * Uso:
 *   node node_modules/tsx/dist/cli.mjs scripts/create-admin.ts <email> <password> [nombre]
 *
 * Si el email ya existe se le asigna rol admin, estado activo y se
 * restablece la contraseña.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { pool, queryOne } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

const [emailArg, passwordArg, ...nameParts] = process.argv.slice(2);

if (!emailArg || !passwordArg) {
  console.error('Uso: create-admin.ts <email> <password> [nombre completo]');
  process.exit(1);
}

const email    = emailArg.toLowerCase().trim();
const fullName = nameParts.join(' ').trim() || 'Administrador';
const hash     = await hashPassword(passwordArg);

const existing = await queryOne<{ id: string }>(
  'SELECT id FROM profiles WHERE email = ?',
  [email],
);

if (existing) {
  await pool.execute(
    `UPDATE profiles
        SET role = 'admin', estado = 'activo', password_hash = ?
      WHERE id = ?`,
    [hash, existing.id],
  );
  console.log(`✅ Admin actualizado — ${email} (contraseña restablecida)`);
} else {
  await pool.execute(
    `INSERT INTO profiles (id, email, full_name, role, estado, password_hash)
     VALUES (?, ?, ?, 'admin', 'activo', ?)`,
    [randomUUID(), email, fullName, hash],
  );
  console.log(`✅ Admin creado — ${email}`);
}

await pool.end();
