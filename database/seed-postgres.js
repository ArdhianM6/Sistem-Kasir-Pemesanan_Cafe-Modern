import 'dotenv/config';
import pg from 'pg';
import { ensureSupabaseReady } from '../api/bootstrap.js';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const connectionUrl = databaseUrl ? new URL(databaseUrl) : null;
for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connectionUrl?.searchParams.delete(key);
const pool = new pg.Pool({ connectionString: connectionUrl?.toString(), options: '-c search_path=titik_temu,public', ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false } });
try {
  await ensureSupabaseReady(pool);
  console.log('Setup database selesai. Akun demo: admin / kasir / pelayan — password: password');
} finally { await pool.end(); }
