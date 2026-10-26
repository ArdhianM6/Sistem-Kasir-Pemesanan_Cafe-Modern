USE kasir_kafe;

-- Jalankan sekali pada database yang dibuat sebelum kolom unit ditambahkan.
ALTER TABLE products ADD COLUMN unit VARCHAR(24) NOT NULL DEFAULT 'porsi' AFTER stock;
ALTER TABLE order_details ADD COLUMN unit_label VARCHAR(24) NOT NULL DEFAULT 'item' AFTER product_name;

UPDATE products SET unit='gelas' WHERE sku IN ('KOP-ESP','KOP-LAT','KOP-AREN','KOP-V60','KOP-MAT','KOP-CHC');
UPDATE products SET unit='porsi' WHERE sku IN ('KOP-CHK','KOP-PASTA');
UPDATE products SET unit='buah' WHERE sku='KOP-CRO';
UPDATE products SET unit='potong' WHERE sku='KOP-CKE';
