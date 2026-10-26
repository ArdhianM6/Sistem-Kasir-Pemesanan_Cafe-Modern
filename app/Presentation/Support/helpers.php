<?php
declare(strict_types=1);

function e(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function rupiah(int|float|string $value): string { return 'Rp' . number_format((float) $value, 0, ',', '.'); }
function url(string $page = 'dashboard', array $params = []): string { return '?' . http_build_query(['page' => $page] + $params); }
function redirect(string $page, array $params = []): never { header('Location: ' . url($page, $params)); exit; }
function csrf_token(): string { if (empty($_SESSION['_token'])) $_SESSION['_token'] = bin2hex(random_bytes(32)); return $_SESSION['_token']; }
function verify_csrf(): void { if (!hash_equals($_SESSION['_token'] ?? '', (string) ($_POST['_token'] ?? ''))) { http_response_code(419); exit('Sesi formulir berakhir. Muat ulang halaman lalu coba lagi.'); } }
function flash(string $message, string $type = 'success'): void { $_SESSION['_flash'] = ['message' => $message, 'type' => $type]; }
function take_flash(): ?array { $flash = $_SESSION['_flash'] ?? null; unset($_SESSION['_flash']); return $flash; }
function current_user(): ?array { return $_SESSION['user'] ?? null; }
function require_login(): void { if (!current_user()) redirect('login'); }
function require_admin(): void { require_login(); if (!in_array(current_user()['role'], ['admin', 'manager'], true)) { flash('Halaman ini hanya untuk administrator dan manager.', 'error'); redirect('dashboard'); } }
function is_admin(): bool { return in_array(current_user()['role'] ?? '', ['admin', 'manager'], true); }
function status_label(string $status): string { return ['processing' => 'Diproses', 'completed' => 'Selesai', 'cancelled' => 'Dibatalkan'][$status] ?? $status; }
function payment_label(string $method): string { return ['cash' => 'Tunai', 'qris' => 'QRIS', 'transfer' => 'Transfer bank', 'debit' => 'Kartu debit'][$method] ?? $method; }
function date_id(string $date): string { return date('d/m/Y', strtotime($date)); }
