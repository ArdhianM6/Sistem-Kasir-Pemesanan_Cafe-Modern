<?php
declare(strict_types=1);

namespace Cafe\Application\Services;

use Cafe\Application\Contracts\BackOfficeRepository;
use DomainException;

final class BackOfficeService
{
    public function __construct(private BackOfficeRepository $repository, private array $config) {}

    public function dashboard(?int $ownerId): array { return $this->repository->dashboard($ownerId, (int) $this->config['low_stock_limit']); }
    public function transactionCatalog(): array { return $this->repository->transactionCatalog(); }
    public function orders(?int $ownerId): array { return $this->repository->listOrders($ownerId); }
    public function receipt(int $id, ?int $ownerId): ?array { return $this->repository->receipt($id, $ownerId); }

    public function report(array $query): array
    {
        $filters = $this->filters($query);
        $rows = $this->repository->reportRows($filters);
        $summary = ['gross'=>0,'subtotal'=>0,'discount'=>0,'tax'=>0,'revenue'=>0,'charged'=>0,'count'=>0];
        foreach ($rows as $row) {
            if ($row['status'] === 'cancelled') continue;
            $summary['gross'] += (int) $row['subtotal'];
            $summary['subtotal'] += (int) $row['subtotal'];
            $summary['discount'] += (int) $row['discount'];
            $summary['tax'] += (int) $row['tax_amount'];
            $summary['revenue'] += (int) $row['subtotal'] - (int) $row['discount'];
            $summary['charged'] += (int) $row['grand_total'];
            $summary['count']++;
        }
        return ['filters'=>$filters,'rows'=>$rows,'summary'=>$summary,'categories'=>$this->repository->activeCategories()];
    }

    public function productPage(array $query): array
    {
        $data = $this->repository->productPage();
        $data['edit'] = $this->repository->product((int) ($query['edit'] ?? 0));
        $data['category_edit'] = $this->repository->category((int) ($query['edit_category'] ?? 0));
        return $data;
    }

    public function userPage(array $query): array
    {
        return ['users'=>$this->repository->users(),'edit'=>$this->repository->user((int) ($query['edit'] ?? 0))];
    }

    public function saveProduct(array $input): void
    {
        $name=trim((string)($input['name']??''));$category=(int)($input['category_id']??0);$unit=trim((string)($input['unit']??''));
        $price=(int)($input['selling_price']??0);$cost=(int)($input['cost_price']??0);$stock=(int)($input['stock']??0);
        if($name===''||$category<1||$unit===''||mb_strlen($unit)>24||$price<1||$cost<0||$stock<0) throw new DomainException('Lengkapi nama, kategori, satuan, harga, dan stok dengan benar.');
        $this->repository->saveProduct(['id'=>(int)($input['id']??0),'name'=>$name,'category_id'=>$category,'unit'=>$unit,'selling_price'=>$price,'cost_price'=>$cost,'stock'=>$stock,'status'=>isset($input['active'])?'active':'inactive']);
    }

    public function saveCategory(array $input): void
    {
        $name=trim((string)($input['name']??''));if($name==='')throw new DomainException('Nama kategori wajib diisi.');
        $slug=strtolower(trim((string)preg_replace('/[^a-z0-9]+/i','-',$name),'-'));
        $id=(int)($input['id']??0);
        $this->repository->saveCategory(['id'=>$id,'name'=>$name,'slug'=>$slug,'status'=>$id?(isset($input['active'])?'active':'inactive'):'active']);
    }

    public function deleteCategory(int $id): bool { return $this->repository->deleteCategory($id); }

    public function saveUser(array $input): void
    {
        $id=(int)($input['id']??0);$username=trim((string)($input['username']??''));$email=trim((string)($input['email']??''));$name=trim((string)($input['full_name']??''));$role=(string)($input['role']??'cashier');$password=(string)($input['password']??'');
        if($username===''||$name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||!in_array($role,['admin','manager','cashier','waiter'],true)||(!$id&&strlen($password)<8)||($password!==''&&strlen($password)<8)) throw new DomainException('Periksa data akun. Password baru harus memiliki minimal 8 karakter.');
        $this->repository->saveUser(['id'=>$id,'username'=>$username,'email'=>$email,'full_name'=>$name,'role'=>$role,'password'=>$password,'status'=>$id?(isset($input['active'])?'active':'inactive'):'active']);
    }

    private function filters(array $query): array
    {
        $from=(string)($query['from']??date('Y-m-01'));$to=(string)($query['to']??date('Y-m-d'));
        if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$from))$from=date('Y-m-01');
        if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$to))$to=date('Y-m-d');
        $payment=(string)($query['payment']??'');
        if(!in_array($payment,['cash','qris','transfer','debit'],true))$payment='';
        return [$from,$to,max(0,(int)($query['category']??0)),$payment];
    }
}
