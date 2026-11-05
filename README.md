# Titik Temu Kopi — React + Node.js + Supabase

Aplikasi kasir kafe dengan UI React, API Express di Vercel Functions, database Supabase PostgreSQL, dan login Supabase Auth. Data transaksi dan stok tersimpan di project Supabase yang sama setelah deploy.

## Fitur

- Login Supabase Auth dengan profil dan role admin/manager/kasir/pelayan.
- Dashboard, transaksi dine-in/takeaway, pembayaran, kembalian, riwayat, struk, dan laporan.
- Database PostgreSQL memakai transaksi untuk mengunci stok, menyimpan order dan detail, serta mengembalikan stok ketika order dibatalkan.
- Pengelolaan menu, kategori, dan akun tim. Password akun dikelola Supabase Auth.

## Otomatisasi setup Supabase

Saat API pertama kali dibuka, aplikasi otomatis membuat/memperbarui tabel, akun Supabase Auth demo, profil role, kategori, dan menu awal. Tidak perlu membuka SQL Editor atau menjalankan seed manual. Setup aman diulang dan tidak menghapus pesanan/data menu yang sudah ada.

Tidak perlu membuat project Supabase baru jika kuota project Anda penuh. Aplikasi menggunakan schema database terpisah bernama `titik_temu` di dalam project yang sudah ada, sehingga tabel aplikasi tidak bercampur dengan tabel `public` milik project lain. Cukup hubungkan project tersebut dengan URL, key, dan koneksi database:

- `SUPABASE_URL`: Project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: secret/service role key, server saja.
- `DATABASE_URL`: PostgreSQL connection string Supabase; gunakan pooler untuk Vercel.

`.env.example` berisi nama variabel tersebut. Isi `.env` lokal untuk menjalankan proyek di komputer. Seed akun demo dipanggil otomatis; `npm run seed` tersedia sebagai cara manual untuk memicu setup lebih awal.

Akun demo: `admin`, `manager`, `kasir`, atau `pelayan`; password awal `password`.

## Menjalankan lokal

Butuh Node.js 20+.

```sh
npm start
npm run dev
```

Buka `http://localhost:5173`. Vite meneruskan `/api` ke Express di port 3000.

## Deploy ke Vercel

1. Hubungkan repository ke Vercel. Framework preset Vite, build command `npm run build`, output `dist`.
2. Di **Project → Settings → Environment Variables**, atur empat variabel Supabase di atas, `TAX_RATE=0.10`, `SERVICE_RATE=0.05`, dan `LOW_STOCK_LIMIT=5`.
3. Deploy. Kunjungan pertama ke API otomatis membuat schema `titik_temu`, tabel, dan akun demo; setelah itu login dengan `admin` / `password`.

> Jangan commit `.env` atau membagikan secret/service role key. Akun demo menggunakan password publik, jadi ganti passwordnya di Supabase Auth sebelum membagikan live demo. Project Supabase menjadi tempat penyimpanan persisten; Vercel hanya menjalankan UI dan API.

## Struktur

```text
api/index.js                 Express API, Supabase Auth, transaksi PostgreSQL
src/main.jsx                 Aplikasi React
src/style.css                Tampilan responsif
database/schema.postgres.sql Skema Supabase PostgreSQL
database/seed-postgres.js    Akun Supabase Auth dan data contoh
vercel.json                  Routing API dan SPA
```

Berkas PHP dan MySQL lama tetap disimpan sebagai arsip versi awal. Deployment React tidak memakai entry point PHP tersebut.
