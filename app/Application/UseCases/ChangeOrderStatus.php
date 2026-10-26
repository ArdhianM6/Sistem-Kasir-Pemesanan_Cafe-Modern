<?php
declare(strict_types=1);

namespace Cafe\Application\UseCases;

use Cafe\Application\Contracts\OrderRepository;
use DomainException;

final class ChangeOrderStatus
{
    public function __construct(private OrderRepository $orders) {}

    public function execute(int $orderId, string $status, ?int $ownerId): void
    {
        if (!in_array($status, ['processing', 'completed', 'cancelled'], true)) throw new DomainException('Status pesanan tidak valid.');

        $this->orders->transactional(function () use ($orderId, $status, $ownerId): void {
            $current = $this->orders->lockOrderStatus($orderId, $ownerId);
            if ($current === null) throw new DomainException('Pesanan tidak ditemukan.');
            if ($current === 'cancelled' && $status !== 'cancelled') throw new DomainException('Pesanan yang dibatalkan tidak dapat diaktifkan kembali.');
            if ($current !== 'cancelled' && $status === 'cancelled') {
                foreach ($this->orders->orderDetailsForStockRestore($orderId) as $line) {
                    if ($line['product_id']) $this->orders->restoreStock((int) $line['product_id'], (int) $line['quantity']);
                }
            }
            $this->orders->updateStatus($orderId, $status);
        });
    }
}
