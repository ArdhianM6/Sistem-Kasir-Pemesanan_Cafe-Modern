import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const accounts = [['admin','admin@titiktemu-demo.com','Administrator','admin'],['manager','manager@titiktemu-demo.com','Manager Kafe','manager'],['kasir','kasir@titiktemu-demo.com','Kasir Utama','cashier'],['pelayan','pelayan@titiktemu-demo.com','Pelayan Kafe','waiter']];
const categories = [['Coffee','coffee'],['Non-Coffee','non-coffee'],['Food','food'],['Pastry','pastry']];
const products=[['coffee','KOP-ESP','Espresso',22000,9000,40,'gelas'],['coffee','KOP-LAT','Cafe Latte',30000,12000,34,'gelas'],['coffee','KOP-AREN','Kopi Susu Aren',32000,13000,7,'gelas'],['coffee','KOP-V60','V60 Manual Brew',34000,14000,12,'gelas'],['non-coffee','KOP-MAT','Matcha Latte',32000,13000,4,'gelas'],['non-coffee','KOP-CHC','Chocolate',28000,11000,20,'gelas'],['food','KOP-CHK','Chicken Rice Bowl',42000,19000,15,'porsi'],['food','KOP-PASTA','Creamy Mushroom Pasta',45000,20000,3,'porsi'],['pastry','KOP-CRO','Butter Croissant',24000,9000,9,'buah'],['pastry','KOP-CKE','Basque Cheesecake',36000,16000,6,'potong']];
let ready;
const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function ensureSupabaseReady(pool) {
  if (!ready) ready = initialize(pool).catch(error => { ready = null; throw error; });
  return ready;
}

async function initialize(pool) {
  const schema = await readFile(fileURLToPath(new URL('../database/schema.postgres.sql', import.meta.url)), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(734928104)');
    await client.query('CREATE SCHEMA IF NOT EXISTS titik_temu');
    await client.query('SET LOCAL search_path TO titik_temu, public');
    await client.query(schema);
    await client.query('ALTER TABLE users ALTER COLUMN auth_uid DROP NOT NULL');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    // Remove obsolete Supabase Auth IDs only from this app's private schema.
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID');
    for (const [username,email,full_name,role] of accounts) {
      const passwordHash = await hashPassword('password');
      await client.query(`INSERT INTO users(auth_uid,username,email,full_name,role,password_hash) VALUES(NULL,$1,$2,$3,$4,$5)
        ON CONFLICT(username) DO UPDATE SET auth_uid=NULL,email=EXCLUDED.email,full_name=EXCLUDED.full_name,role=EXCLUDED.role,password_hash=COALESCE(users.password_hash,EXCLUDED.password_hash)`, [username,email,full_name,role,passwordHash]);
    }
    for (const [name,slug] of categories) await client.query('INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(name) DO NOTHING',[name,slug]);
    for (const [slug,sku,name,price,cost,stock,unit] of products) await client.query("INSERT INTO products(category_id,sku,name,selling_price,cost_price,stock,unit) SELECT id,$2,$3,$4,$5,$6,$7 FROM categories WHERE slug=$1 ON CONFLICT(sku) DO NOTHING",[slug,sku,name,price,cost,stock,unit]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
