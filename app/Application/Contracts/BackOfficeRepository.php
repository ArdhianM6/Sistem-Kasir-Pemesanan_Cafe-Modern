<?php
declare(strict_types=1);

namespace Cafe\Application\Contracts;

interface BackOfficeRepository
{
    public function dashboard(?int $ownerId, int $lowStockLimit): array;
    public function transactionCatalog(): array;
    public function listOrders(?int $ownerId): array;
    public function receipt(int $orderId, ?int $ownerId): ?array;
    public function activeCategories(): array;
    public function reportRows(array $filters): array;
    public function productPage(): array;
    public function product(int $id): ?array;
    public function category(int $id): ?array;
    public function users(): array;
    public function user(int $id): ?array;
    public function saveProduct(array $product): void;
    public function saveCategory(array $category): void;
    public function deleteCategory(int $categoryId): bool;
    public function saveUser(array $user): void;
}
