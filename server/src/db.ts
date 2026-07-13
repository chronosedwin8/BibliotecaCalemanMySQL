import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'biblioteca',
  waitForConnections: true,
  connectionLimit:    10,
  timezone: '+00:00',
  charset:  'utf8mb4',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Params = any[];

export async function query<T = unknown>(sql: string, params?: Params): Promise<T[]> {
  const [rows] = params !== undefined
    ? await pool.execute(sql, params)
    : await pool.execute(sql);
  return rows as T[];
}

export async function queryOne<T = unknown>(sql: string, params?: Params): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: Params): Promise<mysql.ResultSetHeader> {
  const [result] = params !== undefined
    ? await pool.execute(sql, params)
    : await pool.execute(sql);
  return result as mysql.ResultSetHeader;
}
