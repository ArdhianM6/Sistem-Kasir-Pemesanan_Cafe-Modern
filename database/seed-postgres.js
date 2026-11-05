import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { ensureSupabaseReady } from '../api/bootstrap.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=titik_temu,public', ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  await ensureSupabaseReady(pool, supabase);
  console.log('Setup Supabase selesai. Akun demo: admin / kasir / pelayan — password: password');
} finally { await pool.end(); }
