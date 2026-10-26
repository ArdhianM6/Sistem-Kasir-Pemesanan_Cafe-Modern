<?php
declare(strict_types=1);

namespace Cafe\Domain\Order;

final class OrderTotals
{
    /** @return array{subtotal:int,discount:int,tax:int,service:int,total:int} */
    public static function calculate(int $subtotal, int $discount, float $taxRate, float $serviceRate): array
    {
        $discount = min(max(0, $discount), $subtotal);
        $taxable = $subtotal - $discount;
        $tax = (int) round($taxable * $taxRate);
        $service = (int) round($taxable * $serviceRate);

        return [
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'service' => $service,
            'total' => $taxable + $tax + $service,
        ];
    }
}
