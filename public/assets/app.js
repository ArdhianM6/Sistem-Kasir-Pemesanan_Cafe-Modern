(() => {
  const dismissFlash=flash=>{flash.classList.add('flash-out');setTimeout(()=>flash.remove(),260);};
  const notify=(message,type='error')=>{
    const toast=document.createElement('div');toast.className=`flash flash-${type}`;toast.setAttribute('role',type==='error'?'alert':'status');toast.setAttribute('aria-live',type==='error'?'assertive':'polite');
    toast.append(document.createTextNode(message));const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Tutup notifikasi');close.textContent='×';close.addEventListener('click',()=>dismissFlash(toast));toast.append(close);document.body.append(toast);setTimeout(()=>dismissFlash(toast),5200);
  };
  const menu=document.getElementById('menuGrid');
  if(menu){
    const cart=new Map(),money=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
    const search=document.getElementById('menuSearch'),pills=[...document.querySelectorAll('.category-pill')];let category='all';
    function filterMenu(){const term=(search?.value||'').toLocaleLowerCase('id');menu.querySelectorAll('.menu-card').forEach(card=>{card.hidden=!(card.dataset.name.toLocaleLowerCase('id').includes(term)&&(category==='all'||card.dataset.category===category));});}
    search?.addEventListener('input',filterMenu);pills.forEach(b=>b.addEventListener('click',()=>{pills.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');category=b.dataset.category;filterMenu();}));
    menu.addEventListener('click',ev=>{const card=ev.target.closest('.menu-card');if(!card)return;const id=card.dataset.id,item=cart.get(id)||{id,name:card.dataset.name,unit:card.dataset.unit,price:+card.dataset.price,stock:+card.dataset.stock,qty:0,note:''};if(item.qty<item.stock){item.qty++;cart.set(id,item);render();}});
    function render(){const host=document.getElementById('cartItems');host.innerHTML='';let count=0,sub=0;cart.forEach(i=>{count+=i.qty;sub+=i.qty*i.price;const row=document.createElement('div');row.className='cart-row';row.innerHTML=`<div class="cart-row-top"><div><strong>${esc(i.name)}</strong><small>${money(i.price)} / ${esc(i.unit)}</small></div><strong>${money(i.price*i.qty)}</strong></div><div class="cart-row-bottom"><div class="qty-control"><button type="button" data-step="-1" data-id="${i.id}" aria-label="Kurangi">−</button><span>${i.qty} ${esc(i.unit)}</span><button type="button" data-step="1" data-id="${i.id}" aria-label="Tambah">＋</button></div><input class="item-note" data-note="${i.id}" placeholder="Catatan khusus, contoh: less sugar" value="${esc(i.note)}" maxlength="255"></div>`;host.append(row);});if(!count)host.innerHTML='<div class="cart-empty"><span>♧</span><p>Belum ada menu dipilih.</p><small>Ketuk kartu menu untuk mulai.</small></div>';const disc=Math.min(sub,Math.max(0,+document.getElementById('discount').value||0)),tax=Math.round((sub-disc)*.1),service=Math.round((sub-disc)*.05),total=sub-disc+tax+service,paid=+document.getElementById('amountPaid').value||0;document.getElementById('cartCount').textContent=count?`${count} item dalam pesanan`:'Belum ada item';document.getElementById('subtotal').textContent=money(sub);document.getElementById('tax').textContent=money(tax);document.getElementById('service').textContent=money(service);document.getElementById('grandTotal').textContent=money(total);document.getElementById('changeAmount').textContent=money(Math.max(0,paid-total));document.getElementById('paidField').hidden=document.getElementById('paymentMethod').value!=='cash';document.getElementById('submitOrder').disabled=!count;host.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{const i=cart.get(b.dataset.id);i.qty+=+b.dataset.step;if(i.qty<=0)cart.delete(b.dataset.id);render();}));host.querySelectorAll('[data-note]').forEach(el=>el.addEventListener('input',()=>{cart.get(el.dataset.note).note=el.value;}));}
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    document.getElementById('discount').addEventListener('input',render);document.getElementById('amountPaid').addEventListener('input',render);document.getElementById('paymentMethod').addEventListener('change',render);document.getElementById('clearCart').addEventListener('click',()=>{cart.clear();render();});
    const orderTypes=[...document.querySelectorAll('[name="orderType"]')],tableField=document.getElementById('tableField'),orderFields=document.getElementById('orderFields');
    const syncOrderType=()=>{const takeaway=orderTypes.find(r=>r.checked)?.value==='takeaway';tableField.hidden=takeaway;orderFields.classList.toggle('single-field',takeaway);};
    orderTypes.forEach(r=>r.addEventListener('change',syncOrderType));syncOrderType();
    document.getElementById('orderForm').addEventListener('submit',ev=>{if(!cart.size){ev.preventDefault();notify('Pilih minimal satu menu sebelum menyimpan pesanan.');return;}const type=document.querySelector('[name="orderType"]:checked').value,table=document.getElementById('tableNumber').value.trim(),method=document.getElementById('paymentMethod').value,discount=+document.getElementById('discount').value||0,subtotal=[...cart.values()].reduce((s,i)=>s+i.price*i.qty,0),total=subtotal-Math.min(discount,subtotal)+Math.round((subtotal-Math.min(discount,subtotal))*.1)+Math.round((subtotal-Math.min(discount,subtotal))*.05),paid=method==='cash'?(+document.getElementById('amountPaid').value||0):total;if(type==='dine_in'&&!table){ev.preventDefault();document.getElementById('tableNumber').focus();notify('Isi nomor meja untuk pesanan makan di tempat.');return;}if(paid<total){ev.preventDefault();document.getElementById('amountPaid').focus();notify('Uang diterima belum mencukupi total tagihan.');return;}document.getElementById('itemsInput').value=JSON.stringify([...cart.values()].map(i=>({id:i.id,qty:i.qty})));document.getElementById('orderTypeInput').value=type;document.getElementById('tableInput').value=table;document.getElementById('customerInput').value=document.getElementById('customerName').value;document.getElementById('paymentInput').value=method;document.getElementById('discountInput').value=discount;document.getElementById('paidInput').value=paid;const notes=document.getElementById('notesInputs');notes.innerHTML='';cart.forEach(i=>{const el=document.createElement('input');el.type='hidden';el.name=`notes[${i.id}]`;el.value=i.note;notes.append(el);});document.getElementById('submitOrder').disabled=true;});render();
  }
  const tableSearch=document.getElementById('tableSearch');tableSearch?.addEventListener('input',()=>{const term=tableSearch.value.toLocaleLowerCase('id');document.querySelectorAll('[data-search-row]').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('id').includes(term));});
  const statusDialog=document.getElementById('statusDialog');
  if(statusDialog){
    const message=document.getElementById('statusDialogMessage'),title=document.getElementById('statusDialogTitle'),mark=document.getElementById('statusDialogMark');
    const confirmButton=document.getElementById('confirmStatusChange'),cancelButton=document.getElementById('cancelStatusChange');
    let activeSelect=null;
    document.querySelectorAll('[data-status-confirm]').forEach(select=>select.addEventListener('change',()=>{
      if(select.value===select.dataset.currentStatus)return;
      activeSelect=select;
      const labels={processing:'Diproses',completed:'Selesai',cancelled:'Dibatalkan'};
      const cancelled=select.value==='cancelled';
      title.textContent=cancelled?'Batalkan pesanan ini?':`Tandai pesanan sebagai ${labels[select.value]}?`;
      message.textContent=cancelled?'Pesanan akan dibatalkan dan stok menu dikembalikan. Status ini tidak bisa dipulihkan.':'Status pesanan akan diperbarui. Anda masih bisa mengubahnya dari riwayat pesanan.';
      mark.textContent=cancelled?'!':'✓';mark.classList.toggle('is-danger',cancelled);
      confirmButton.textContent=cancelled?'Ya, batalkan':`Ya, tandai ${labels[select.value].toLowerCase()}`;
      confirmButton.classList.toggle('button-danger',cancelled);
      statusDialog.showModal();
    }));
    cancelButton.addEventListener('click',()=>statusDialog.close());
    confirmButton.addEventListener('click',()=>{
      if(!activeSelect)return;
      const form=activeSelect.form;
      activeSelect.dataset.currentStatus=activeSelect.value;
      statusDialog.close();
      form.requestSubmit();
    });
    statusDialog.addEventListener('close',()=>{
      if(activeSelect&&activeSelect.value!==activeSelect.dataset.currentStatus)activeSelect.value=activeSelect.dataset.currentStatus;
      activeSelect=null;
    });
    statusDialog.addEventListener('click',event=>{if(event.target===statusDialog)statusDialog.close();});
  }
  document.getElementById('menuToggle')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
  document.querySelectorAll('.flash').forEach(f=>{f.setAttribute('role',f.classList.contains('flash-error')?'alert':'status');f.setAttribute('aria-live',f.classList.contains('flash-error')?'assertive':'polite');f.querySelector('button')?.addEventListener('click',()=>dismissFlash(f));setTimeout(()=>dismissFlash(f),5200);});
})();
