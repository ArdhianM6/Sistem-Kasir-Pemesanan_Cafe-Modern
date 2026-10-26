<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Masuk · Titik Temu Kopi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="login-body">
  <main class="login-shell">
    <section class="login-art">
      <a class="brand brand-light"><span class="brand-mark">tk</span><span><strong>titik temu</strong><small>coffee & kitchen</small></span></a>
      <div class="art-copy"><span class="art-kicker">KAFE · KASIR · CERITA</span><h1>Semua pesanan<br>bermula dari sini.</h1><p>Satu meja untuk tim yang membuat setiap kunjungan terasa seperti pulang.</p></div>
      <div class="art-bottom">Jl. Purnawarman No. 18 · Bandung <span>Est. 2024</span></div>
      <div class="coffee-shape" aria-hidden="true">☕</div>
    </section>
    <section class="login-panel">
      <div class="login-form-wrap">
        <span class="form-kicker">SENANG BERTEMU KEMBALI</span>
        <h2>Masuk ke ruang kerja</h2>
        <p class="muted">Gunakan akun kafe untuk melanjutkan.</p>
        <?php if($flash):?><div class="flash <?=$flash['type']==='error'?'flash-error':'flash-success'?>"><?=e($flash['message'])?><button type="button" aria-label="Tutup notifikasi">×</button></div><?php endif?>
        <form method="post" class="form-stack">
          <input type="hidden" name="_token" value="<?=e(csrf_token())?>">
          <input type="hidden" name="action" value="login">
          <label>Username atau email<input name="login" required autofocus autocomplete="username" placeholder="contoh: admin"></label>
          <label>Password<input name="password" type="password" required autocomplete="current-password" placeholder="Masukkan password"></label>
          <button class="button button-primary button-wide">Masuk ke dashboard <span>→</span></button>
        </form>
        <div class="login-hint"><strong>Akun demo</strong><div>admin · kasir · pelayan</div><small>Password awal: <code>password</code></small></div>
      </div>
      <div class="login-footer">© <?=date('Y')?> Titik Temu Kopi <span>Sistem kasir & pemesanan</span></div>
    </section>
  </main>
  <script src="assets/app.js"></script>
</body>
</html>
