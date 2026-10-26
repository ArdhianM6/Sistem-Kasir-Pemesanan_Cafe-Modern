# Titik Temu Kopi — Sistem Kasir & Pemesanan

Aplikasi POS kafe berbasis PHP 8.1+ dan MySQL/MariaDB. Dibangun mengikuti empat modul praktik: autentikasi dan hak akses, dashboard operasional, transaksi dine-in/takeaway, dan laporan penjualan.

## Yang tersedia

- Login aman dengan password hash, sesi yang diperbarui saat masuk, token CSRF, dan pembatasan halaman berdasarkan peran.
- Peran admin/manager untuk dashboard, laporan, menu, kategori, stok, dan akun tim. Kasir/pelayan dapat membuat pesanan dan melihat transaksi serta struk miliknya sendiri.
- Dashboard dengan omzet dan jumlah transaksi harian, menu terlaris, peringatan stok, grafik tujuh hari, serta pesanan terakhir.
- Transaksi detail dengan nomor faktur `INV-POS-YYYYMMDD-XXXX`, dine-in wajib memilih meja, catatan item, diskon, pajak, biaya layanan, empat metode pembayaran, dan hitung kembalian.
- Validasi stok dan nominal bayar di server. Stok dikunci dan dikurangi dalam transaksi database yang sama dengan header/detail pesanan. Pembatalan mengembalikan stok.
- Cetak struk ukuran thermal melalui dialog cetak browser, laporan dengan rentang tanggal/kategori/metode, cetak atau simpan sebagai PDF, serta unduh CSV yang dapat dibuka di Excel.
- Kelola menu dan persediaan dengan satuan per produk; tambah, ubah, nonaktifkan, atau hapus kategori; serta tambah/edit/nonaktifkan akun tim.

## Kebutuhan

- PHP 8.1 atau lebih baru dengan ekstensi `PDO` dan `pdo_mysql`.
- MySQL 8+ atau MariaDB yang mendukung InnoDB dan subquery.
- Browser modern.

## Menjalankan lokal

1. Pastikan MySQL berjalan. Buat database dan tabel dengan mengimpor `database/schema.sql` lewat phpMyAdmin atau klien MySQL.
2. Isi data awal dengan mengimpor `database/seed.sql`.
3. Jika akses database bukan `root` tanpa password, atur variabel lingkungan `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASS`, atau ubah nilai awal di `config/config.php`.
4. Dari folder project, jalankan:

   ```sh
   php -S 127.0.0.1:8000 -t public
   ```

5. Buka `http://127.0.0.1:8000`.

Jika database berasal dari versi awal project sebelum kolom satuan ditambahkan, jalankan sekali `database/migration_001_product_units.sql` dari prompt MariaDB/MySQL. Jangan jalankan migrasi yang sama berulang kali.

Untuk XAMPP, letakkan project di `htdocs`, impor dua berkas SQL berurutan, lalu buka folder `public` melalui Apache. Atur document root Apache ke folder `public` agar direktori konfigurasi, SQL, dan kode aplikasi tidak disajikan ke publik.

## Akun awal

| Peran | Username | Password awal |
| --- | --- | --- |
| Administrator | `admin` | `password` |
| Kasir | `kasir` | `password` |
| Pelayan | `pelayan` | `password` |

Ganti password contoh sebelum aplikasi digunakan di lingkungan nyata. Buat akun baru melalui halaman **Akun pengguna**.

## Pengaturan

Konfigurasi koneksi database, tarif pajak restoran, biaya layanan, dan batas stok minimum ada di `config/config.php`. Tarif awal aplikasi adalah pajak 10%, biaya layanan 5%, dan peringatan stok 5 item. Sesuaikan tarif pajak dengan kebijakan usaha setempat.

## Struktur project

```text
app/
  Domain/Order/               Perhitungan total transaksi
  Application/
    Contracts/                Antarmuka repository
    UseCases/                 Login, buat pesanan, ubah status
    Services/                 Kebutuhan dashboard, katalog, dan laporan
  Infrastructure/Persistence/ Implementasi repository dengan PDO
  Presentation/
    Http/                     Controller dan alur request/response
    Support/                  Helper presentasi, CSRF, sesi, format
  views/                      Template halaman
  bootstrap.php               Autoload, konfigurasi, koneksi, perakitan aplikasi
config/config.php     Konfigurasi lokal
database/schema.sql   Skema 5 tabel InnoDB
database/seed.sql     Akun, kategori, dan menu demo
database/migration_001_product_units.sql  Penyesuaian database versi awal
public/index.php      Entry point HTTP
public/assets/        CSS dan JavaScript antarmuka
```

### Pembagian tanggung jawab

- **Domain** berisi aturan inti yang tidak bergantung pada database atau halaman web, seperti kalkulasi subtotal, diskon, pajak, biaya layanan, dan total.
- **Application** mengatur alur penggunaan aplikasi melalui use case dan service. Lapisan ini bergantung pada kontrak repository, bukan pada PDO.
- **Infrastructure** menerapkan kontrak tersebut untuk MySQL/MariaDB menggunakan PDO.
- **Presentation** menangani request, validasi sesi/akses, dan penyajian view. `public/index.php` menjadi entry point, sedangkan `app/bootstrap.php` merakit implementasi yang dibutuhkan.

Ketergantungan alurnya mengarah ke dalam: Presentation memanggil Application, Application memakai kontrak, lalu Infrastructure menyediakan implementasinya. Skema database dan data awal tidak berubah. Ini menerapkan prinsip Clean Architecture dalam skala project praktik; view masih berupa template PHP dan helper sesi masih berupa fungsi presentasi sederhana.

### Catatan implementasi

- Harga disimpan sebagai rupiah bulat; persentase pajak dan layanan dihitung server sebelum transaksi disimpan.
- Setiap produk memiliki satuan (misalnya gelas, porsi, buah, atau potong); satuan produk ikut disimpan sebagai snapshot di detail pesanan.
- Nomor faktur berurutan mengikuti ID pesanan, dengan urutan minimum empat digit dan tanggal hari transaksi.
- Status pesanan: diproses, selesai, dan dibatalkan. Pesanan yang sudah dibatalkan menjadi final.
- Ekspor PDF menggunakan fitur **Cetak / simpan PDF** di browser; ekspor Excel/CSV dibuat langsung oleh aplikasi.
- Berkas seed sengaja berisi password demo agar aplikasi mudah dicoba. Jangan gunakan akun demo di server publik.
