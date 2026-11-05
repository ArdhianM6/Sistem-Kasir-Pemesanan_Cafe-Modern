import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ensureSupabaseReady } from './bootstrap.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const connectionUrl = databaseUrl ? new URL(databaseUrl) : null;
for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connectionUrl?.searchParams.delete(key);
const pool = new Pool({ connectionString: connectionUrl?.toString(), options: '-c search_path=titik_temu,public', ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false }, max: 3, idleTimeoutMillis: 5000 });
const app = express();
app.use(express.json({ limit: '100kb' }));
const scrypt = promisify(scryptCallback);
const hashPassword = async password => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
};
const verifyPassword = async (password, encoded) => {
  const [algorithm, saltText, hashText] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
const tokenSecret = () => process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
const signToken = (user, type, lifetime) => {
  if (!tokenSecret()) throw new Error('JWT secret is not configured.');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ iss: 'titik-temu-pos', aud: 'titik-temu-pos', sub: String(user.id), username: user.username, role: user.role, typ: type, exp: Math.floor(Date.now() / 1000) + lifetime });
  const signature = createHmac('sha256', tokenSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};
const readToken = (token, type) => {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature || !tokenSecret()) return null;
  const expected = createHmac('sha256', tokenSecret()).update(`${header}.${payload}`).digest();
  let received;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (claims.iss !== 'titik-temu-pos' || claims.aud !== 'titik-temu-pos' || claims.typ !== type || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
};
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
  const claims = readToken(token, 'access');
  if (!claims) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
  pool.query("SELECT id,username,full_name,role,status FROM users WHERE id=$1 AND status='active'", [claims.sub]).then(({ rows }) => {
    const profile = rows[0];
    if (!profile) return res.status(401).json({ error: 'Akun tidak aktif atau profil tidak ditemukan.' });
    req.user = { id: profile.id, username: profile.username, name: profile.full_name, role: profile.role };
    next();
  }).catch(next);
};
const admin = (req, res, next) => req.user.role === 'admin' || req.user.role === 'manager' ? next() : res.status(403).json({ error: 'Akses khusus admin atau manager.' });
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const num = n => Math.max(0, Math.trunc(Number(n) || 0));

app.get('/api/health', asyncRoute(async (_req, res) => { await ensureSupabaseReady(pool); await pool.query('SELECT 1'); res.json({ ok: true, setup: 'ready' }); }));
app.post('/api/login', asyncRoute(async (req, res) => {
  await ensureSupabaseReady(pool);
  const login = String(req.body.login || '').trim();
  const { rows } = await pool.query("SELECT id,username,email,full_name,role,password_hash FROM users WHERE (username=$1 OR email=$1) AND status='active' LIMIT 1", [login]);
  const u = rows[0];
  if (!u || !(await verifyPassword(String(req.body.password || ''), u.password_hash))) return res.status(401).json({ error: 'Username/email atau password tidak cocok.' });
  const user = { id: u.id, username: u.username, name: u.full_name, role: u.role };
  res.json({ token: signToken(user, 'access', 60 * 60), refreshToken: signToken(user, 'refresh', 30 * 24 * 60 * 60), user });
}));
app.post('/api/refresh', asyncRoute(async (req, res) => {
  const claims = readToken(req.body.refreshToken, 'refresh');
  if (!claims) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
  const { rows } = await pool.query("SELECT id,username,full_name,role FROM users WHERE id=$1 AND status='active'", [claims.sub]);
  const profile = rows[0];
  if (!profile) return res.status(401).json({ error: 'Akun tidak aktif atau profil tidak ditemukan.' });
  const user = { id: profile.id, username: profile.username, name: profile.full_name, role: profile.role };
  res.json({ token: signToken(user, 'access', 60 * 60), refreshToken: signToken(user, 'refresh', 30 * 24 * 60 * 60) });
}));
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
app.get('/api/catalog', auth, asyncRoute(async (_req, res) => {
  const [cats, products] = await Promise.all([pool.query("SELECT id,name FROM categories WHERE status='active' ORDER BY name"), pool.query("SELECT p.id,p.sku,p.name,p.selling_price,p.stock,p.unit,p.category_id,c.name category FROM products p JOIN categories c ON c.id=p.category_id WHERE p.status='active' AND c.status='active' AND p.stock>0 ORDER BY c.name,p.name")]);
  res.json({ categories: cats.rows, products: products.rows });
}));
app.get('/api/dashboard', auth, asyncRoute(async (req, res) => {
  const scoped = !['admin','manager'].includes(req.user.role); const userArg = scoped ? [req.user.id] : [];
  const [kpiResult, bestResult, ordersResult, lowResult, chartResult] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(grand_total),0) revenue,COUNT(*) orders FROM orders WHERE created_at::date=CURRENT_DATE AND status IN ('processing','completed')${scoped?' AND user_id=$1':''}`, userArg),
    pool.query(`SELECT od.product_name name,SUM(od.quantity) quantity FROM order_details od JOIN orders o ON o.id=od.order_id WHERE o.created_at::date=CURRENT_DATE AND o.status IN ('processing','completed')${scoped?' AND o.user_id=$1':''} GROUP BY od.product_name ORDER BY quantity DESC LIMIT 1`, userArg),
    pool.query(`SELECT o.id,o.invoice_number,o.created_at,o.grand_total,o.status,o.order_type,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id ${scoped?'WHERE o.user_id=$1':''} ORDER BY o.created_at DESC LIMIT 6`, userArg),
    pool.query("SELECT p.name,p.stock,c.name category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.status='active' AND p.stock<=$1 ORDER BY p.stock,p.name LIMIT 6", [num(process.env.LOW_STOCK_LIMIT || 5)]),
    pool.query(`SELECT created_at::date AS "day",COALESCE(SUM(grand_total),0) total FROM orders WHERE created_at>=CURRENT_DATE-6 AND status IN ('processing','completed')${scoped?' AND user_id=$1':''} GROUP BY created_at::date ORDER BY "day"`, userArg)
  ]);
  res.json({ kpi: kpiResult.rows[0], best: bestResult.rows[0], orders: ordersResult.rows, low: lowResult.rows, chart: chartResult.rows });
}));
app.get('/api/orders', auth, asyncRoute(async (req,res)=>{const scoped=!['admin','manager'].includes(req.user.role);const {rows}=await pool.query(`SELECT o.*,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id ${scoped?'WHERE o.user_id=$1':''} ORDER BY o.created_at DESC LIMIT 100`,scoped?[req.user.id]:[]);res.json({orders:rows});}));
app.get('/api/orders/:id', auth, asyncRoute(async (req,res)=>{const scoped=!['admin','manager'].includes(req.user.role);const args=[req.params.id];const {rows}=await pool.query(`SELECT o.*,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1${scoped?' AND o.user_id=$2':''}`,scoped?[...args,req.user.id]:args);if(!rows[0])return res.status(404).json({error:'Struk tidak ditemukan.'});const details=await pool.query('SELECT * FROM order_details WHERE order_id=$1 ORDER BY id',[req.params.id]);res.json({order:rows[0],details:details.rows});}));
app.post('/api/orders', auth, asyncRoute(async(req,res)=>{
  const {items=[],order_type,table_number,customer_name,payment_method,amount_paid,discount,notes={}}=req.body;
  if(!Array.isArray(items)||!items.length||!['dine_in','takeaway'].includes(order_type)||(order_type==='dine_in'&&!String(table_number||'').trim())||!['cash','qris','transfer','debit'].includes(payment_method))return res.status(400).json({error:'Lengkapi jenis pesanan, nomor meja, metode pembayaran, dan item menu.'});
  const quantities=new Map();for(const i of items){const id=num(i.id),q=num(i.qty);if(id&&q>0&&q<=99)quantities.set(id,(quantities.get(id)||0)+q);} if(!quantities.size)return res.status(400).json({error:'Pilih minimal satu menu.'});
  const client=await pool.connect();try{await client.query('BEGIN');const lines=[];let subtotal=0;
    for(const [id,qty] of quantities){const {rows}=await client.query("SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND p.status='active' AND c.status='active' FOR UPDATE OF p",[id]);const p=rows[0];if(!p)throw Object.assign(Error('Menu tidak tersedia.'),{status:400});if(Number(p.stock)<qty)throw Object.assign(Error(`Stok ${p.name} tidak mencukupi.`),{status:400});const lineTotal=Number(p.selling_price)*qty;subtotal+=lineTotal;lines.push({p,qty,lineTotal});}
    const disc=Math.min(num(discount),subtotal);const base=subtotal-disc;const tax=Math.round(base*Number(process.env.TAX_RATE??0.1));const service=Math.round(base*Number(process.env.SERVICE_RATE??0.05));const total=base+tax+service;const paid=payment_method==='cash'?num(amount_paid):total;if(paid<total)throw Object.assign(Error('Nominal pembayaran belum mencukupi.'),{status:400});
    const {rows}=await client.query("INSERT INTO orders(invoice_number,user_id,order_type,table_number,customer_name,subtotal,discount,tax_amount,service_amount,grand_total,payment_method,amount_paid,change_amount,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'processing') RETURNING id",[`PENDING-${Date.now()}-${Math.random()}`,req.user.id,order_type,order_type==='dine_in'?String(table_number).trim():null,String(customer_name||'').trim()||null,subtotal,disc,tax,service,total,payment_method,paid,Math.max(0,paid-total)]);const id=rows[0].id;const invoice=`INV-POS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(id).padStart(4,'0')}`;await client.query('UPDATE orders SET invoice_number=$1 WHERE id=$2',[invoice,id]);
    for(const {p,qty,lineTotal} of lines){await client.query('INSERT INTO order_details(order_id,product_id,product_name,unit_label,unit_price,quantity,line_total,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,p.id,p.name,p.unit,p.selling_price,qty,lineTotal,String(notes[p.id]||'').trim()||null]);await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[qty,p.id]);}
    await client.query('COMMIT');res.status(201).json({id,invoice});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
app.patch('/api/orders/:id/status',auth,asyncRoute(async(req,res)=>{const status=req.body.status;if(!['processing','completed','cancelled'].includes(status))return res.status(400).json({error:'Status tidak valid.'});const client=await pool.connect();try{await client.query('BEGIN');const scoped=!['admin','manager'].includes(req.user.role);const {rows}=await client.query(`SELECT * FROM orders WHERE id=$1${scoped?' AND user_id=$2':''} FOR UPDATE`,scoped?[req.params.id,req.user.id]:[req.params.id]);const o=rows[0];if(!o)throw Object.assign(Error('Pesanan tidak ditemukan.'),{status:404});if(o.status==='cancelled')throw Object.assign(Error('Pesanan yang dibatalkan bersifat final.'),{status:400});if(status==='cancelled'){const lines=await client.query('SELECT product_id,quantity FROM order_details WHERE order_id=$1',[o.id]);for(const l of lines.rows)if(l.product_id)await client.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[l.quantity,l.product_id]);}await client.query('UPDATE orders SET status=$1 WHERE id=$2',[status,o.id]);await client.query('COMMIT');res.json({ok:true});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
app.get('/api/products',auth,admin,asyncRoute(async(_req,res)=>{const [c,p]=await Promise.all([pool.query('SELECT * FROM categories ORDER BY name'),pool.query('SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.name')]);res.json({categories:c.rows,products:p.rows});}));
app.post('/api/products',auth,admin,asyncRoute(async(req,res)=>{const p=req.body;const id=num(p.id);if(!p.name||!num(p.category_id)||num(p.selling_price)<=0)return res.status(400).json({error:'Nama, kategori, dan harga menu wajib diisi.'});if(id)await pool.query('UPDATE products SET category_id=$1,name=$2,selling_price=$3,cost_price=$4,stock=$5,unit=$6,status=$7 WHERE id=$8',[p.category_id,p.name,num(p.selling_price),num(p.cost_price),num(p.stock),p.unit||'porsi',p.status==='inactive'?'inactive':'active',id]);else await pool.query('INSERT INTO products(category_id,sku,name,selling_price,cost_price,stock,unit,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.category_id,`KOP-${Math.random().toString(36).slice(2,8).toUpperCase()}`,p.name,num(p.selling_price),num(p.cost_price),num(p.stock),p.unit||'porsi',p.status==='inactive'?'inactive':'active']);res.json({ok:true});}));
app.post('/api/categories',auth,admin,asyncRoute(async(req,res)=>{const {id,name,status}=req.body;if(!name?.trim())return res.status(400).json({error:'Nama kategori wajib diisi.'});const slug=name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');if(num(id))await pool.query('UPDATE categories SET name=$1,slug=$2,status=$3 WHERE id=$4',[name.trim(),slug,status==='inactive'?'inactive':'active',id]);else await pool.query('INSERT INTO categories(name,slug) VALUES($1,$2)',[name.trim(),slug]);res.json({ok:true});}));
app.delete('/api/categories/:id',auth,admin,asyncRoute(async(req,res)=>{const result=await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]);if(!result.rowCount)return res.status(404).json({error:'Kategori tidak ditemukan.'});res.json({ok:true});}));
app.get('/api/users',auth,admin,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT id,username,email,full_name,role,status,created_at FROM users ORDER BY full_name');res.json({users:rows});}));
app.post('/api/users',auth,admin,asyncRoute(async(req,res)=>{
  const u=req.body,id=num(req.body.id);
  if(!u.username||!u.email||!u.full_name||!['admin','manager','cashier','waiter'].includes(u.role))return res.status(400).json({error:'Lengkapi nama, username, email, dan peran.'});
  if(!id&&!String(u.password||'').match(/^.{8,}$/))return res.status(400).json({error:'Password minimal 8 karakter.'});
  const active=u.status==='inactive'?'inactive':'active';
  if(id){
    const {rows}=await pool.query('SELECT id FROM users WHERE id=$1',[id]);if(!rows[0])return res.status(404).json({error:'Akun tidak ditemukan.'});
    const passwordHash=u.password?await hashPassword(String(u.password)):null;
    if(u.password&&!/^.{8,}$/.test(String(u.password)))return res.status(400).json({error:'Password minimal 8 karakter.'});
    await pool.query('UPDATE users SET username=$1,email=$2,full_name=$3,role=$4,status=$5,password_hash=COALESCE($6,password_hash) WHERE id=$7',[u.username,u.email,u.full_name,u.role,active,passwordHash,id]);
  }else{
    const passwordHash=await hashPassword(String(u.password));
    await pool.query('INSERT INTO users(auth_uid,username,email,full_name,role,status,password_hash) VALUES(NULL,$1,$2,$3,$4,$5,$6)',[u.username,u.email,u.full_name,u.role,active,passwordHash]);
  }
  res.json({ok:true});
}));
app.get('/api/reports',auth,admin,asyncRoute(async(req,res)=>{const from=req.query.from||new Date().toISOString().slice(0,10),to=req.query.to||from;const args=[from,to];let extra='';if(req.query.payment){args.push(req.query.payment);extra+=` AND o.payment_method=$${args.length}`;}if(num(req.query.category)){args.push(num(req.query.category));extra+=` AND EXISTS(SELECT 1 FROM order_details od JOIN products p ON p.id=od.product_id WHERE od.order_id=o.id AND p.category_id=$${args.length})`;}const {rows}=await pool.query(`SELECT o.*,u.full_name cashier,COALESCE((SELECT SUM(quantity) FROM order_details WHERE order_id=o.id),0)::int item_quantity,COALESCE((SELECT string_agg(product_name||' ×'||quantity||' '||unit_label,', ' ORDER BY id) FROM order_details WHERE order_id=o.id),'') item_names FROM orders o JOIN users u ON u.id=o.user_id WHERE o.created_at::date BETWEEN $1 AND $2${extra} ORDER BY o.created_at DESC`,args);const summary=rows.filter(r=>r.status!=='cancelled').reduce((s,r)=>({gross:s.gross+Number(r.subtotal),discount:s.discount+Number(r.discount),tax:s.tax+Number(r.tax_amount),revenue:s.revenue+Number(r.grand_total)-Number(r.tax_amount)-Number(r.service_amount),charged:s.charged+Number(r.grand_total),count:s.count+1}),{gross:0,discount:0,tax:0,revenue:0,charged:0,count:0});const {rows:categories}=await pool.query("SELECT id,name FROM categories WHERE status='active' ORDER BY name");res.json({rows,summary,categories,filters:{from,to,category:num(req.query.category),payment:req.query.payment||''}});}));
app.get('/api/reports.csv',auth,admin,asyncRoute(async(req,res)=>{req.url='/api/reports'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'');res.status(307).set('Location',req.url).end();}));
app.use((err,_req,res,_next)=>{console.error(err);const status=err.status|| (err.code==='23505'?409:500);res.status(status).json({error:err.code==='23505'?'Kode, nama, username, atau email sudah digunakan.':status===500?'Terjadi kesalahan server. Periksa konfigurasi database.':err.message});});
export default app;
