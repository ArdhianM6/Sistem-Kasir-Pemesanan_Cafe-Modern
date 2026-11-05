import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const accounts = [['admin','admin@titiktemu-demo.com','Administrator','admin'],['manager','manager@titiktemu-demo.com','Manager Kafe','manager'],['kasir','kasir@titiktemu-demo.com','Kasir Utama','cashier'],['pelayan','pelayan@titiktemu-demo.com','Pelayan Kafe','waiter']];
const categories = [['Coffee','coffee'],['Non-Coffee','non-coffee'],['Food','food'],['Pastry','pastry']];
const products=[['coffee','KOP-ESP','Espresso',22000,9000,40,'gelas'],['coffee','KOP-LAT','Cafe Latte',30000,12000,34,'gelas'],['coffee','KOP-AREN','Kopi Susu Aren',32000,13000,7,'gelas'],['coffee','KOP-V60','V60 Manual Brew',34000,14000,12,'gelas'],['non-coffee','KOP-MAT','Matcha Latte',32000,13000,4,'gelas'],['non-coffee','KOP-CHC','Chocolate',28000,11000,20,'gelas'],['food','KOP-CHK','Chicken Rice Bowl',42000,19000,15,'porsi'],['food','KOP-PASTA','Creamy Mushroom Pasta',45000,20000,3,'porsi'],['pastry','KOP-CRO','Butter Croissant',24000,9000,9,'buah'],['pastry','KOP-CKE','Basque Cheesecake',36000,16000,6,'potong']];
let ready;

export function ensureSupabaseReady(pool, supabaseAdmin) {
  if (!ready) ready = initialize(pool, supabaseAdmin).catch(error => { ready = null; throw error; });
  return ready;
}

async function initialize(pool, supabaseAdmin) {
  const schema = await readFile(fileURLToPath(new URL('../database/schema.postgres.sql', import.meta.url)), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(734928104)');
    await client.query('CREATE SCHEMA IF NOT EXISTS titik_temu');
    await client.query('SET LOCAL search_path TO titik_temu, public');
    await client.query(schema);
    // Upgrade profiles in this app's private schema without touching public tables.
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID');
    await client.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='titik_temu' AND table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE titik_temu.users ALTER COLUMN password_hash DROP NOT NULL;
        UPDATE titik_temu.users SET password_hash=NULL;
      END IF;
    END $$`);
    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const authUsers = new Map(listed.users.map(user => [user.email.toLowerCase(), user]));
    for (const [username,email,full_name,role] of accounts) {
      let authUser = authUsers.get(email.toLowerCase());
      if (!authUser) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: 'password', email_confirm: true, user_metadata: { full_name } });
        if (error) throw error;
        authUser = data.user;
        authUsers.set(email.toLowerCase(), authUser);
      }
      await client.query(`INSERT INTO users(auth_uid,username,email,full_name,role) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(username) DO UPDATE SET auth_uid=EXCLUDED.auth_uid,email=EXCLUDED.email`, [authUser.id,username,email,full_name,role]);
    }
    for (const [name,slug] of categories) await client.query('INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(name) DO NOTHING',[name,slug]);
    for (const [slug,sku,name,price,cost,stock,unit] of products) await client.query("INSERT INTO products(category_id,sku,name,selling_price,cost_price,stock,unit) SELECT id,$2,$3,$4,$5,$6,$7 FROM categories WHERE slug=$1 ON CONFLICT(sku) DO NOTHING",[slug,sku,name,price,cost,stock,unit]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
