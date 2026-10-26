<?php
declare(strict_types=1);

namespace Cafe\Infrastructure\Persistence;

use Cafe\Application\Contracts\AuthRepository;
use Cafe\Application\Contracts\BackOfficeRepository;
use PDO;

final class PdoBackOfficeRepository implements BackOfficeRepository, AuthRepository
{
    public function __construct(private PDO $pdo) {}

    public function findActiveUserByLogin(string $login): ?array
    {
        $s=$this->pdo->prepare("SELECT id,username,password_hash,full_name,role,status FROM users WHERE (username=? OR email=?) AND status='active' LIMIT 1");$s->execute([$login,$login]);return $s->fetch()?:null;
    }

    public function dashboard(?int $ownerId,int $lowStockLimit): array
    {
        $scope=$ownerId===null?'':' AND user_id=?';$args=[$ownerId===null?date('Y-m-d'):date('Y-m-d')];if($ownerId!==null)$args[]=$ownerId;
        $s=$this->pdo->prepare("SELECT COALESCE(SUM(grand_total),0) revenue,COUNT(*) orders FROM orders WHERE DATE(created_at)=? AND status IN ('processing','completed')".$scope);$s->execute($args);$kpi=$s->fetch();
        $bestScope=$ownerId===null?'':' AND o.user_id=?';$bestArgs=[date('Y-m-d')];if($ownerId!==null)$bestArgs[]=$ownerId;
        $s=$this->pdo->prepare("SELECT p.name,SUM(od.quantity) quantity FROM order_details od JOIN orders o ON o.id=od.order_id JOIN products p ON p.id=od.product_id WHERE DATE(o.created_at)=? AND o.status IN ('processing','completed')".$bestScope.' GROUP BY p.id,p.name ORDER BY quantity DESC LIMIT 1');$s->execute($bestArgs);$best=$s->fetch();
        $chartScope=$ownerId===null?'':' AND user_id=?';$s=$this->pdo->prepare("SELECT DATE(created_at) day,COALESCE(SUM(grand_total),0) total FROM orders WHERE created_at>=DATE_SUB(CURDATE(),INTERVAL 6 DAY) AND status IN ('processing','completed')".$chartScope.' GROUP BY DATE(created_at)');$s->execute($ownerId===null?[]:[$ownerId]);$chart=$s->fetchAll();
        $s=$this->pdo->prepare("SELECT p.name,p.stock,c.name category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.status='active' AND p.stock<=? ORDER BY p.stock,p.name LIMIT 6");$s->execute([$lowStockLimit]);$low=$s->fetchAll();
        $recentScope=$ownerId===null?'':' WHERE o.user_id=?';$s=$this->pdo->prepare('SELECT o.id,o.invoice_number,o.created_at,o.grand_total,o.status,o.order_type,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id'.$recentScope.' ORDER BY o.created_at DESC LIMIT 6');$s->execute($ownerId===null?[]:[$ownerId]);
        return ['kpi'=>$kpi,'best'=>$best,'chart'=>$chart,'low'=>$low,'recent'=>$s->fetchAll()];
    }

    public function transactionCatalog(): array
    {
        $categories=$this->pdo->query("SELECT id,name FROM categories WHERE status='active' ORDER BY name")->fetchAll();
        $products=$this->pdo->query("SELECT p.id,p.name,p.selling_price,p.stock,p.unit,p.category_id,c.name category FROM products p JOIN categories c ON c.id=p.category_id WHERE p.status='active' AND c.status='active' AND p.stock>0 ORDER BY c.name,p.name")->fetchAll();
        return ['categories'=>$categories,'products'=>$products];
    }

    public function listOrders(?int $ownerId): array
    {
        $where=$ownerId===null?'':' WHERE o.user_id=?';$s=$this->pdo->prepare('SELECT o.*,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id'.$where.' ORDER BY o.created_at DESC LIMIT 100');$s->execute($ownerId===null?[]:[$ownerId]);return $s->fetchAll();
    }

    public function receipt(int $orderId,?int $ownerId): ?array
    {
        $where=$ownerId===null?'':' AND o.user_id=?';$args=[$orderId];if($ownerId!==null)$args[]=$ownerId;
        $s=$this->pdo->prepare('SELECT o.*,u.full_name cashier FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?'.$where);$s->execute($args);$order=$s->fetch();if(!$order)return null;
        $s=$this->pdo->prepare('SELECT * FROM order_details WHERE order_id=?');$s->execute([$orderId]);return ['order'=>$order,'details'=>$s->fetchAll()];
    }

    public function activeCategories(): array { return $this->pdo->query("SELECT id,name FROM categories WHERE status='active' ORDER BY name")->fetchAll(); }

    public function reportRows(array $filters): array
    {
        [$from,$to,$category,$payment]=$filters;
        $sql="SELECT o.id,o.invoice_number,o.created_at,o.order_type,o.table_number,o.payment_method,o.status,o.subtotal,o.discount,o.tax_amount,o.grand_total,u.full_name cashier,(SELECT COALESCE(SUM(od.quantity),0) FROM order_details od WHERE od.order_id=o.id) item_quantity,(SELECT GROUP_CONCAT(CONCAT(od.product_name,' ×',od.quantity,' ',od.unit_label) ORDER BY od.id SEPARATOR ', ') FROM order_details od WHERE od.order_id=o.id) item_names FROM orders o JOIN users u ON u.id=o.user_id WHERE DATE(o.created_at) BETWEEN ? AND ?";$args=[$from,$to];
        if($payment!==''){$sql.=' AND o.payment_method=?';$args[]=$payment;}
        if($category>0){$sql.=' AND EXISTS(SELECT 1 FROM order_details od JOIN products p ON p.id=od.product_id WHERE od.order_id=o.id AND p.category_id=?)';$args[]=$category;}
        $s=$this->pdo->prepare($sql.' ORDER BY o.created_at DESC');$s->execute($args);return $s->fetchAll();
    }

    public function productPage(): array { return ['categories'=>$this->pdo->query('SELECT * FROM categories ORDER BY name')->fetchAll(),'products'=>$this->pdo->query('SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.name')->fetchAll()]; }
    public function product(int $id): ?array { if($id<1)return null;$s=$this->pdo->prepare('SELECT * FROM products WHERE id=?');$s->execute([$id]);return $s->fetch()?:null; }
    public function category(int $id): ?array { if($id<1)return null;$s=$this->pdo->prepare('SELECT * FROM categories WHERE id=?');$s->execute([$id]);return $s->fetch()?:null; }
    public function users(): array { return $this->pdo->query('SELECT id,username,email,full_name,role,status,created_at FROM users ORDER BY full_name')->fetchAll(); }
    public function user(int $id): ?array { if($id<1)return null;$s=$this->pdo->prepare('SELECT id,username,email,full_name,role,status FROM users WHERE id=?');$s->execute([$id]);return $s->fetch()?:null; }

    public function saveProduct(array $p): void
    {
        if($p['id']){$s=$this->pdo->prepare('UPDATE products SET category_id=?,name=?,selling_price=?,cost_price=?,stock=?,unit=?,status=? WHERE id=?');$s->execute([$p['category_id'],$p['name'],$p['selling_price'],$p['cost_price'],$p['stock'],$p['unit'],$p['status'],$p['id']]);}
        else{$s=$this->pdo->prepare('INSERT INTO products(category_id,name,selling_price,cost_price,stock,unit,status,sku) VALUES(?,?,?,?,?,?,?,?)');$s->execute([$p['category_id'],$p['name'],$p['selling_price'],$p['cost_price'],$p['stock'],$p['unit'],$p['status'],strtoupper('KOP-'.bin2hex(random_bytes(3)))]);}
    }

    public function saveCategory(array $c): void
    {
        if($c['id']){$s=$this->pdo->prepare('UPDATE categories SET name=?,slug=?,status=? WHERE id=?');$s->execute([$c['name'],$c['slug'],$c['status'],$c['id']]);}
        else{$s=$this->pdo->prepare('INSERT INTO categories(name,slug,status) VALUES(?,?,?)');$s->execute([$c['name'],$c['slug'],$c['status']]);}
    }

    public function deleteCategory(int $categoryId): bool { $s=$this->pdo->prepare('DELETE FROM categories WHERE id=?');$s->execute([$categoryId]);return $s->rowCount()>0; }

    public function saveUser(array $u): void
    {
        if($u['id']&&$u['password']!==''){$s=$this->pdo->prepare('UPDATE users SET username=?,email=?,full_name=?,role=?,status=?,password_hash=? WHERE id=?');$s->execute([$u['username'],$u['email'],$u['full_name'],$u['role'],$u['status'],password_hash($u['password'],PASSWORD_DEFAULT),$u['id']]);}
        elseif($u['id']){$s=$this->pdo->prepare('UPDATE users SET username=?,email=?,full_name=?,role=?,status=? WHERE id=?');$s->execute([$u['username'],$u['email'],$u['full_name'],$u['role'],$u['status'],$u['id']]);}
        else{$s=$this->pdo->prepare('INSERT INTO users(username,email,password_hash,full_name,role,status) VALUES(?,?,?,?,?,?)');$s->execute([$u['username'],$u['email'],password_hash($u['password'],PASSWORD_DEFAULT),$u['full_name'],$u['role'],$u['status']]);}
    }
}
