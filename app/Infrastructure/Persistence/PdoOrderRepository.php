<?php
declare(strict_types=1);

namespace Cafe\Infrastructure\Persistence;

use Cafe\Application\Contracts\OrderRepository;
use PDO;
use Throwable;

final class PdoOrderRepository implements OrderRepository
{
    public function __construct(private PDO $pdo) {}

    public function transactional(callable $operation): mixed
    {
        $this->pdo->beginTransaction();
        try { $result=$operation();$this->pdo->commit();return $result; }
        catch(Throwable $error) { if($this->pdo->inTransaction())$this->pdo->rollBack();throw $error; }
    }

    public function lockProducts(array $productIds): array
    {
        $query=$this->pdo->prepare('SELECT p.id,p.name,p.selling_price,p.stock,p.unit,p.status,c.name category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? FOR UPDATE');
        $products=[];
        foreach($productIds as $id){$query->execute([(int)$id]);$row=$query->fetch();if($row)$products[(int)$row['id']]=$row;}
        return $products;
    }

    public function insertOrder(array $o): int
    {
        $s=$this->pdo->prepare('INSERT INTO orders(invoice_number,user_id,order_type,table_number,customer_name,subtotal,discount,tax_amount,service_amount,grand_total,payment_method,amount_paid,change_amount,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $s->execute([$o['invoice_number'],$o['user_id'],$o['order_type'],$o['table_number'],$o['customer_name'],$o['subtotal'],$o['discount'],$o['tax_amount'],$o['service_amount'],$o['grand_total'],$o['payment_method'],$o['amount_paid'],$o['change_amount'],$o['status']]);
        return (int)$this->pdo->lastInsertId();
    }

    public function setInvoiceNumber(int $orderId,string $invoice): void { $s=$this->pdo->prepare('UPDATE orders SET invoice_number=? WHERE id=?');$s->execute([$invoice,$orderId]); }
    public function insertOrderDetail(array $d): void { $s=$this->pdo->prepare('INSERT INTO order_details(order_id,product_id,product_name,unit_label,unit_price,quantity,line_total,notes) VALUES(?,?,?,?,?,?,?,?)');$s->execute([$d['order_id'],$d['product_id'],$d['product_name'],$d['unit_label'],$d['unit_price'],$d['quantity'],$d['line_total'],$d['notes']]); }
    public function decrementStock(int $productId,int $quantity): void { $s=$this->pdo->prepare('UPDATE products SET stock=stock-? WHERE id=?');$s->execute([$quantity,$productId]); }
    public function lockOrderStatus(int $orderId,?int $ownerId): ?string { $sql='SELECT status FROM orders WHERE id=?';$args=[$orderId];if($ownerId!==null){$sql.=' AND user_id=?';$args[]=$ownerId;}$s=$this->pdo->prepare($sql.' FOR UPDATE');$s->execute($args);$status=$s->fetchColumn();return $status===false?null:(string)$status; }
    public function orderDetailsForStockRestore(int $orderId): array { $s=$this->pdo->prepare('SELECT product_id,quantity FROM order_details WHERE order_id=?');$s->execute([$orderId]);return $s->fetchAll(); }
    public function restoreStock(int $productId,int $quantity): void { $s=$this->pdo->prepare('UPDATE products SET stock=stock+? WHERE id=?');$s->execute([$quantity,$productId]); }
    public function updateStatus(int $orderId,string $status): void { $s=$this->pdo->prepare('UPDATE orders SET status=? WHERE id=?');$s->execute([$status,$orderId]); }
}
