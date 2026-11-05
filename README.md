# ALOVERA — React + Node.js + PostgreSQL

Aplikasi kasir kafe dengan UI React, API Express di Vercel Functions, dan database Supabase PostgreSQL. Data transaksi dan stok tersimpan secara persisten di database Supabase.

## Fitur

- Login aplikasi dengan profil dan role admin/manager/kasir/pelayan. Password disimpan sebagai hash scrypt di database; aplikasi tidak menggunakan Supabase Auth.
- Dashboard, transaksi dine-in/takeaway, pembayaran, kembalian, riwayat, struk, dan laporan.
- Database PostgreSQL memakai transaksi untuk mengunci stok, menyimpan order dan detail, serta mengembalikan stok ketika order dibatalkan.
- Pengelolaan menu, kategori, dan akun tim.

## Setup otomatis Supabase

Saat API pertama kali dibuka, aplikasi otomatis membuat/memperbarui tabel, akun demo, kategori, dan menu awal. Tidak perlu membuka SQL Editor atau menjalankan seed manual. Setup aman diulang dan tidak menghapus pesanan/data menu yang sudah ada.

Aplikasi memakai schema database terpisah bernama `titik_temu`. Tabel aplikasi kasir terpisah dari tabel Marketplace di schema `public`. Supabase Auth tidak digunakan, sehingga aplikasi tidak membuat akun atau mengubah konfigurasi Auth di project Marketplace.

Variabel yang dibutuhkan:

- `DATABASE_URL` atau `POSTGRES_URL`: koneksi PostgreSQL dari Supabase/Vercel.
- `SUPABASE_JWT_SECRET` atau `JWT_SECRET`: secret untuk sesi login aplikasi. Integrasi Supabase Vercel menyediakan `SUPABASE_JWT_SECRET`.
- `TAX_RATE=0.10`, `SERVICE_RATE=0.05`, `LOW_STOCK_LIMIT=5` (opsional; nilai default sudah tersedia).

Akun demo: `admin`, `manager`, `kasir`, atau `pelayan`; password awal `password`. Ganti password akun demo sebelum membagikan live demo.

## Menjalankan lokal

Butuh Node.js 20+.

```sh
npm start
npm run dev
```

Buka `http://localhost:5173`. Vite meneruskan `/api` ke Express di port 3000.

## Deploy ke Vercel

1. Hubungkan repository ke Vercel. Framework preset Vite, build command `npm run build`, output `dist`.
2. Hubungkan integrasi Supabase ke project Vercel. Pastikan `POSTGRES_URL` dan `SUPABASE_JWT_SECRET` tersedia untuk Production.
3. Deploy. Buka `/api/health`; respons `{"ok":true,"setup":"ready"}` berarti database dan setup awal berhasil.

Jangan commit `.env` atau membagikan secret. Project Supabase menjadi tempat penyimpanan persisten; Vercel menjalankan UI dan API.

## Struktur

```text
api/index.js                 Express API, login aplikasi, transaksi PostgreSQL
src/main.jsx                 Aplikasi React
src/style.css                Tampilan responsif
database/schema.postgres.sql Skema PostgreSQL
database/seed-postgres.js    Setup akun dan data contoh
vercel.json                  Routing API dan SPA
```

Berkas PHP dan MySQL lama tetap disimpan sebagai arsip versi awal. Deployment React tidak memakai entry point PHP tersebut.
