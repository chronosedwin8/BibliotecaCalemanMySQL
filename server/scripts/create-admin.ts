import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

const db = await mysql.createConnection({
  host: 'localhost', user: 'root', password: '1004',
  database: 'biblioteca', charset: 'utf8mb4',
});

const hash = await bcrypt.hash('Colegio123', 12);
const id = randomUUID();

await db.execute(
  `INSERT INTO profiles (id,email,full_name,role,estado,password_hash)
   VALUES (?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE full_name=VALUES(full_name)`,
  [id, 'admin@biblioteca.com', 'Administrador', 'admin', 'activo', hash],
);

console.log('✅ Admin creado — email: admin@biblioteca.com  password: Colegio123');
await db.end();
