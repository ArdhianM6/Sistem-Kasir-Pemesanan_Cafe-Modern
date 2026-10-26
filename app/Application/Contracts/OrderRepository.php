<?php
declare(strict_types=1);

namespace Cafe\Application\Contracts;

interface OrderRepository
{
    public function transactional(callable $operation): mixed;
    public function lockProducts(array $productIds): array;
    public function insertOrder(array $order): int;
    public function setInvoiceNumber(int $orderId, string $invoice): void;
    public function insertOrderDetail(array $detail): void;
    public function decrementStock(int $productId, int $quantity): void;
    public function lockOrderStatus(int $orderId, ?int $ownerId): ?string;
    public function orderDetailsForStockRestore(int $orderId): array;
    public function restoreStock(int $productId, int $quantity): void;
    public function updateStatus(int $orderId, string $status): void;
}
