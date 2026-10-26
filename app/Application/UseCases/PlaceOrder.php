<?php
declare(strict_types=1);

namespace Cafe\Application\UseCases;

use Cafe\Application\Contracts\OrderRepository;
use Cafe\Domain\Order\OrderTotals;
use DomainException;

final class PlaceOrder
{
    public function __construct(private OrderRepository $orders, private array $config) {}

    public function execute(array $input, int $userId): array
    {
        $items = json_decode((string) ($input['items'] ?? '[]'), true);
        $type = (string) ($input['order_type'] ?? '');
        $table = trim((string) ($input['table_number'] ?? ''));
        $customer = trim((string) ($input['customer_name'] ?? ''));
        $payment = (string) ($input['payment_method'] ?? '');
        $discount = max(0, (int) ($input['discount'] ?? 0));

        if (!is_array($items) || !$items || !in_array($type, ['dine_in', 'takeaway'], true)
            || ($type === 'dine_in' && $table === '')
            || !in_array($payment, ['cash', 'qris', 'transfer', 'debit'], true)) {
            throw new DomainException('Lengkapi jenis pesanan, nomor meja, metode pembayaran, dan item menu.');
        }

        $quantities = [];
        foreach ($items as $item) {
            $id = (int) ($item['id'] ?? 0);
            $quantity = (int) ($item['qty'] ?? 0);
            if ($id > 0 && $quantity > 0 && $quantity <= 99) $quantities[$id] = ($quantities[$id] ?? 0) + $quantity;
        }
        if (!$quantities) throw new DomainException('Pilih minimal satu menu.');

        return $this->orders->transactional(function () use ($quantities, $type, $table, $customer, $payment, $discount, $input, $userId): array {
            $products = $this->orders->lockProducts(array_keys($quantities));
            $subtotal = 0;
            $lines = [];
            foreach ($quantities as $productId => $quantity) {
                $product = $products[$productId] ?? null;
                if (!$product || $product['status'] !== 'active') throw new DomainException('Menu tidak tersedia.');
                if ((int) $product['stock'] < $quantity) throw new DomainException('Stok ' . $product['name'] . ' tidak mencukupi.');
                $lineTotal = (int) $product['selling_price'] * $quantity;
                $subtotal += $lineTotal;
                $lines[] = [$product, $quantity, $lineTotal];
            }

            $totals = OrderTotals::calculate($subtotal, $discount, (float) $this->config['tax_rate'], (float) $this->config['service_rate']);
            $paid = (int) ($input['amount_paid'] ?? 0);
            if ($payment === 'cash' && $paid < $totals['total']) throw new DomainException('Nominal pembayaran belum mencukupi.');
            if ($payment !== 'cash') $paid = $totals['total'];

            $orderId = $this->orders->insertOrder([
                'invoice_number' => 'PENDING-' . bin2hex(random_bytes(12)),
                'user_id' => $userId,
                'order_type' => $type,
                'table_number' => $type === 'dine_in' ? $table : null,
                'customer_name' => $customer !== '' ? $customer : null,
                'subtotal' => $totals['subtotal'],
                'discount' => $totals['discount'],
                'tax_amount' => $totals['tax'],
                'service_amount' => $totals['service'],
                'grand_total' => $totals['total'],
                'payment_method' => $payment,
                'amount_paid' => $paid,
                'change_amount' => max(0, $paid - $totals['total']),
                'status' => 'processing',
            ]);

            $invoice = 'INV-POS-' . date('Ymd') . '-' . str_pad((string) $orderId, 4, '0', STR_PAD_LEFT);
            $this->orders->setInvoiceNumber($orderId, $invoice);
            foreach ($lines as [$product, $quantity, $lineTotal]) {
                $note = trim((string) ($input['notes'][$product['id']] ?? ''));
                $this->orders->insertOrderDetail([
                    'order_id' => $orderId, 'product_id' => $product['id'],
                    'product_name' => $product['name'], 'unit_label' => $product['unit'],
                    'unit_price' => $product['selling_price'], 'quantity' => $quantity,
                    'line_total' => $lineTotal, 'notes' => $note !== '' ? $note : null,
                ]);
                $this->orders->decrementStock((int) $product['id'], $quantity);
            }

            return ['id' => $orderId, 'invoice' => $invoice];
        });
    }
}
