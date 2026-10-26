USE kasir_kafe;

INSERT IGNORE INTO users(username,email,password_hash,full_name,role,status) VALUES
('admin','admin@titikkopi.local','$2y$10$RSlLk/ngBTi.f32Oaz7WvezOM8aSZajX.WLYP8M43uauWwGFr5eNe','Administrator','admin','active'),
('kasir','kasir@titikkopi.local','$2y$10$RSlLk/ngBTi.f32Oaz7WvezOM8aSZajX.WLYP8M43uauWwGFr5eNe','Kasir Utama','cashier','active'),
('pelayan','pelayan@titikkopi.local','$2y$10$RSlLk/ngBTi.f32Oaz7WvezOM8aSZajX.WLYP8M43uauWwGFr5eNe','Pelayan Kafe','waiter','active');

INSERT IGNORE INTO categories(name,slug,status) VALUES ('Coffee','coffee','active'),('Non-Coffee','non-coffee','active'),('Food','food','active'),('Pastry','pastry','active');
INSERT IGNORE INTO products(category_id,sku,name,selling_price,cost_price,stock,unit,status)
SELECT c.id,p.sku,p.name,p.price,p.cost,p.stock,p.unit,'active' FROM categories c JOIN (
  SELECT 'coffee' slug,'KOP-ESP' sku,'Espresso' name,22000 price,9000 cost,40 stock,'gelas' unit UNION ALL
  SELECT 'coffee','KOP-LAT','Cafe Latte',30000,12000,34,'gelas' UNION ALL
  SELECT 'coffee','KOP-AREN','Kopi Susu Aren',32000,13000,7,'gelas' UNION ALL
  SELECT 'coffee','KOP-V60','V60 Manual Brew',34000,14000,12,'gelas' UNION ALL
  SELECT 'non-coffee','KOP-MAT','Matcha Latte',32000,13000,4,'gelas' UNION ALL
  SELECT 'non-coffee','KOP-CHC','Chocolate',28000,11000,20,'gelas' UNION ALL
  SELECT 'food','KOP-CHK','Chicken Rice Bowl',42000,19000,15,'porsi' UNION ALL
  SELECT 'food','KOP-PASTA','Creamy Mushroom Pasta',45000,20000,3,'porsi' UNION ALL
  SELECT 'pastry','KOP-CRO','Butter Croissant',24000,9000,9,'buah' UNION ALL
  SELECT 'pastry','KOP-CKE','Basque Cheesecake',36000,16000,6,'potong'
) p ON p.slug=c.slug;

-- Semua akun demo memakai password "password". Ganti sebelum dipakai di lingkungan nyata.
