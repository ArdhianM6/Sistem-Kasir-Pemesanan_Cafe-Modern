<?php
declare(strict_types=1);

use Cafe\Application\Services\BackOfficeService;
use Cafe\Application\UseCases\AuthenticateUser;
use Cafe\Application\UseCases\ChangeOrderStatus;
use Cafe\Application\UseCases\PlaceOrder;
use Cafe\Infrastructure\Persistence\PdoBackOfficeRepository;
use Cafe\Infrastructure\Persistence\PdoOrderRepository;
use Cafe\Presentation\Http\PosController;

spl_autoload_register(static function (string $class): void {
    $prefix = 'Cafe\\';
    if (!str_starts_with($class, $prefix)) return;
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) require $file;
});

require __DIR__ . '/Presentation/Support/helpers.php';

$config = require dirname(__DIR__) . '/config/config.php';
date_default_timezone_set('Asia/Jakarta');
session_name($config['session_name']);
session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
session_start();

try {
    $db = $config['db'];
    $pdo = new PDO(
        "mysql:host={$db['host']};port={$db['port']};dbname={$db['database']};charset={$db['charset']}",
        $db['username'], $db['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
    );
    $pdo->exec("SET time_zone = '+07:00'");
} catch (PDOException $e) {
    error_log('Koneksi database Titik Temu gagal: ' . $e->getMessage());
    http_response_code(500);
    exit('<h1>Database belum siap</h1><p>Pastikan MySQL aktif, pengaturan koneksi benar, dan database sudah dibuat sesuai <code>database/schema.sql</code>.</p>');
}

$backOfficeRepository = new PdoBackOfficeRepository($pdo);
$orderRepository = new PdoOrderRepository($pdo);
$controller = new PosController(
    $config,
    new AuthenticateUser($backOfficeRepository),
    new PlaceOrder($orderRepository, $config),
    new ChangeOrderStatus($orderRepository),
    new BackOfficeService($backOfficeRepository, $config),
);
