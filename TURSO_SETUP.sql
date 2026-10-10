-- ============================================================
-- BioAutomate — Turso (libSQL) Schema
-- Jalankan: turso db shell <database-name> < TURSO_SETUP.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT NOT NULL,
  bio          TEXT,
  avatar_url   TEXT,
  store_slug   TEXT UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  price       REAL NOT NULL CHECK (price >= 0),
  currency    TEXT NOT NULL DEFAULT 'IDR',
  cover_url   TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS products_creator_id_idx ON products(creator_id);

CREATE TABLE IF NOT EXISTS product_files (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name  TEXT NOT NULL,
  file_size  INTEGER,
  mime_type  TEXT,
  content    BLOB,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS product_files_product_id_idx ON product_files(product_id);

CREATE TABLE IF NOT EXISTS payment_links (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS payment_links_product_id_idx ON payment_links(product_id);
CREATE INDEX IF NOT EXISTS payment_links_creator_id_idx ON payment_links(creator_id);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL REFERENCES products(id),
  creator_id       TEXT NOT NULL REFERENCES users(id),
  payment_link_id  TEXT REFERENCES payment_links(id),
  buyer_email      TEXT NOT NULL,  buyer_name      TEXT,
  amount           REAL NOT NULL,
  admin_fee        REAL NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'IDR',
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('midtrans','xendit')),
  payment_ref      TEXT,
  payment_status   TEXT NOT NULL DEFAULT 'pending'
                   CHECK (payment_status IN ('pending','paid','failed','expired','refunded')),
  paid_at          TEXT,
  raw_webhook      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS orders_creator_id_idx ON orders(creator_id);
CREATE INDEX IF NOT EXISTS orders_payment_ref_idx ON orders(payment_ref);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);

CREATE TABLE IF NOT EXISTS deliveries (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed','retry')),
  resend_email_id TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  sent_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS deliveries_order_id_idx ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS deliveries_status_idx ON deliveries(status);

CREATE TABLE IF NOT EXISTS webhook_integrations (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('lynk','linktree','saweria','sociabuzz')),
  webhook_token     TEXT NOT NULL UNIQUE,
  platform_username TEXT,
  is_connected      INTEGER NOT NULL DEFAULT 0,
  first_payload     TEXT,
  connected_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (creator_id, platform)
);

-- Setelan pembayaran per creator: toggle provider + komponen admin fee
CREATE TABLE IF NOT EXISTS payment_settings (
  creator_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  midtrans_enabled  INTEGER NOT NULL DEFAULT 1,
  -- mode Midtrans creator: 'sandbox' | 'production' (NULL = ikut MIDTRANS_IS_PRODUCTION di env)
  midtrans_mode     TEXT CHECK (midtrans_mode IN ('sandbox','production')),
  xendit_enabled    INTEGER NOT NULL DEFAULT 1,
  admin_fee_percent REAL NOT NULL DEFAULT 0 CHECK (admin_fee_percent >= 0 AND admin_fee_percent <= 100),
  admin_fee_flat    REAL NOT NULL DEFAULT 0 CHECK (admin_fee_flat >= 0),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Asset statis publik (cover produk) — konten file disimpan sebagai BLOB
CREATE TABLE IF NOT EXISTS assets (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name  TEXT,
  mime_type  TEXT,
  file_size  INTEGER,
  content    BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Token download sementara (24 jam) untuk link di email delivery
CREATE TABLE IF NOT EXISTS download_tokens (
  token      TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS download_tokens_order_id_idx ON download_tokens(order_id);
