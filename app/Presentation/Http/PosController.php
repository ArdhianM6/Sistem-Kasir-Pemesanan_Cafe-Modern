<?php
declare(strict_types=1);

namespace Cafe\Presentation\Http;

use Cafe\Application\Services\BackOfficeService;
use Cafe\Application\UseCases\AuthenticateUser;
use Cafe\Application\UseCases\ChangeOrderStatus;
use Cafe\Application\UseCases\PlaceOrder;
use DomainException;
use PDOException;
use Throwable;

final class PosController
{
    public function __construct(
        private array $config,
        private AuthenticateUser $authenticate,
        private PlaceOrder $placeOrder,
        private ChangeOrderStatus $changeOrderStatus,
        private BackOfficeService $backOffice,
    ) {}

    public function dispatch(): void
    {
        $page=(string)($_GET['page']??(\current_user()?'dashboard':'login'));
        $allowed=['login','dashboard','transaction','orders','receipt','reports','products','users'];
        if(!in_array($page,$allowed,true))$page='dashboard';
        if($_SERVER['REQUEST_METHOD']==='POST')$this->handlePost();
        if($page==='login'&&\current_user())\redirect('dashboard');
        if($page!=='login')\require_login();
        if(in_array($page,['reports','products','users'],true))\require_admin();
        if(isset($_GET['export'])&&$_GET['export']==='csv')$this->exportCsv();

        $flash=\take_flash();
        $config=$this->config;
        if($page==='login'){require dirname(__DIR__,2).'/views/login.php';return;}
        $data=$this->pageData($page);
        require dirname(__DIR__,2).'/views/layout.php';
    }

    private function handlePost(): never
    {
        $action=(string)($_POST['action']??'');
        if($action==='login'){
            \verify_csrf();$user=$this->authenticate->execute((string)($_POST['login']??''),(string)($_POST['password']??''));
            if(!$user){\flash('Username/email atau password tidak cocok.','error');\redirect('login');}
            session_regenerate_id(true);$_SESSION['user']=$user;\csrf_token();\flash('Selamat datang, '.$user['name'].'.');\redirect('dashboard');
        }

        \require_login();\verify_csrf();
        if($action==='logout'){$_SESSION=[];session_regenerate_id(true);\flash('Anda sudah keluar.');\redirect('login');}
        if(in_array($action,['save_product','save_category','delete_category','save_user'],true))\require_admin();

        try{
            switch($action){
                case 'save_order':
                    $order=$this->placeOrder->execute($_POST,(int)\current_user()['id']);
                    \flash('Pesanan tersimpan dengan nomor '.$order['invoice'].'.');\redirect('receipt',['id'=>$order['id']]);
                case 'update_status':
                    $ownerId=\is_admin()?null:(int)\current_user()['id'];
                    $this->changeOrderStatus->execute((int)($_POST['id']??0),(string)($_POST['status']??''),$ownerId);
                    \flash('Status pesanan diperbarui.');\redirect('orders');
                case 'save_product':
                    $this->backOffice->saveProduct($_POST);\flash('Menu berhasil disimpan.');\redirect('products');
                case 'save_category':
                    $this->backOffice->saveCategory($_POST);\flash('Kategori berhasil disimpan.');\redirect('products');
                case 'delete_category':
                    $deleted=$this->backOffice->deleteCategory((int)($_POST['id']??0));
                    \flash($deleted?'Kategori dihapus.':'Kategori tidak ditemukan.',$deleted?'success':'error');\redirect('products');
                case 'save_user':
                    $this->backOffice->saveUser($_POST);\flash('Akun berhasil disimpan.');\redirect('users');
                default:
                    \flash('Aksi tidak dikenali.','error');\redirect('dashboard');
            }
        }catch(DomainException $error){
            $target=match($action){'save_order'=>'transaction','update_status'=>'orders','save_product','save_category','delete_category'=>'products','save_user'=>'users',default=>'dashboard'};
            \flash($error->getMessage(),'error');\redirect($target);
        }catch(PDOException $error){
            error_log('Operasi database gagal: '.$error->getMessage());
            $message=match($action){'save_product'=>'Kode atau data menu bentrok dengan data yang sudah ada.','save_category'=>'Nama kategori sudah digunakan atau kategori masih dipakai menu.','delete_category'=>'Kategori masih dipakai menu. Pindahkan atau nonaktifkan menu terlebih dahulu.','save_user'=>'Username atau email sudah digunakan.',default=>'Data belum berhasil disimpan. Silakan coba lagi.'};
            $target=match($action){'save_product','save_category','delete_category'=>'products','save_user'=>'users','save_order'=>'transaction','update_status'=>'orders',default=>'dashboard'};
            \flash($message,'error');\redirect($target);
        }catch(Throwable $error){
            error_log('Use case gagal: '.$error->getMessage());
            \flash($action==='save_order'?'Pesanan belum tersimpan. Silakan coba lagi.':'Perubahan belum berhasil disimpan. Silakan coba lagi.','error');
            \redirect($action==='save_order'?'transaction':'dashboard');
        }
    }

    private function pageData(string $page): array
    {
        $ownerId=\is_admin()?null:(int)\current_user()['id'];
        return match($page){
            'dashboard'=>$this->backOffice->dashboard($ownerId),
            'transaction'=>$this->backOffice->transactionCatalog(),
            'orders'=>['orders'=>$this->backOffice->orders($ownerId)],
            'receipt'=>$this->receiptPage((int)($_GET['id']??0),$ownerId),
            'reports'=>$this->backOffice->report($_GET),
            'products'=>$this->backOffice->productPage($_GET),
            'users'=>$this->backOffice->userPage($_GET),
            default=>[],
        };
    }

    private function receiptPage(int $id,?int $ownerId): array
    {
        $receipt=$this->backOffice->receipt($id,$ownerId);
        if(!$receipt){\flash('Struk tidak ditemukan.','error');\redirect('orders');}
        return $receipt;
    }

    private function exportCsv(): never
    {
        \require_admin();$report=$this->backOffice->report($_GET);$rows=$report['rows'];
        header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="laporan-penjualan-'.date('Ymd-His').'.csv"');
        $out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");
        fputcsv($out,['No. Faktur','Tanggal & Jam','Kasir','Jenis Pesanan','Item Terjual','Subtotal','Pajak','Grand Total','Status']);
        foreach($rows as $row)fputcsv($out,[$row['invoice_number'],$row['created_at'],$row['cashier'],$row['order_type']==='dine_in'?'Dine in':'Takeaway',$row['item_names']??'',$row['subtotal'],$row['tax_amount'],$row['grand_total'],\status_label($row['status'])]);
        fclose($out);exit;
    }
}
