CREATE DATABASE IF NOT EXISTS kasir_kafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kasir_kafe;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin','manager','cashier','waiter') NOT NULL DEFAULT 'cashier',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  selling_price INT UNSIGNED NOT NULL,
  cost_price INT UNSIGNED NOT NULL DEFAULT 0,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  unit VARCHAR(24) NOT NULL DEFAULT 'porsi',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY(category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_products_status_stock(status,stock), INDEX idx_products_name(name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  order_type ENUM('dine_in','takeaway') NOT NULL,
  table_number VARCHAR(12) NULL,
  customer_name VARCHAR(120) NULL,
  subtotal INT UNSIGNED NOT NULL,
  discount INT UNSIGNED NOT NULL DEFAULT 0,
  tax_amount INT UNSIGNED NOT NULL DEFAULT 0,
  service_amount INT UNSIGNED NOT NULL DEFAULT 0,
  grand_total INT UNSIGNED NOT NULL,
  payment_method ENUM('cash','qris','transfer','debit') NOT NULL,
  amount_paid INT UNSIGNED NOT NULL,
  change_amount INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('processing','completed','cancelled') NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_orders_created_status(created_at,status), INDEX idx_orders_payment(payment_method)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_details (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_label VARCHAR(24) NOT NULL DEFAULT 'item',
  unit_price INT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  line_total INT UNSIGNED NOT NULL,
  notes VARCHAR(255) NULL,
  CONSTRAINT fk_order_details_order FOREIGN KEY(order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_details_product FOREIGN KEY(product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_order_details_product(product_id)
) ENGINE=InnoDB;
