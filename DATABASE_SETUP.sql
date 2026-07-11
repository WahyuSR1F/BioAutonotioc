-- ============================================================
-- BioAutomate — Database Setup
-- Jalankan SQL ini di Supabase SQL Editor Anda
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email        text NOT NULL,
  bio          text,
  avatar_url   text,
  store_slug   text UNIQUE,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  currency     text NOT NULL DEFAULT 'IDR',
  cover_url    text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_own" ON products FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "products_insert_own" ON products FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "products_update_own" ON products FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "products_delete_own" ON products FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "products_public_read_active" ON products FOR SELECT TO anon USING (is_active = true);

-- 3. PRODUCT FILES
CREATE TABLE IF NOT EXISTS product_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_files_select_own" ON product_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_files.product_id AND products.creator_id = auth.uid()));
CREATE POLICY "product_files_insert_own" ON product_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_files.product_id AND products.creator_id = auth.uid()));
CREATE POLICY "product_files_delete_own" ON product_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_files.product_id AND products.creator_id = auth.uid()));

-- 4. PAYMENT LINKS
CREATE TABLE IF NOT EXISTS payment_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  creator_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        text UNIQUE NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_links_select_own" ON payment_links FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "payment_links_insert_own" ON payment_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "payment_links_update_own" ON payment_links FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "payment_links_delete_own" ON payment_links FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "payment_links_public_read_active" ON payment_links FOR SELECT TO anon USING (is_active = true);

-- 5. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id),
  creator_id        uuid NOT NULL REFERENCES auth.users(id),
  payment_link_id   uuid REFERENCES payment_links(id),
  buyer_email       text NOT NULL,
  buyer_name        text,
  amount            numeric(12,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'IDR',
  payment_provider  text NOT NULL CHECK (payment_provider IN ('midtrans','xendit')),
  payment_ref       text,
  payment_status    text NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed','expired','refunded')),
  paid_at           timestamptz,
  raw_webhook       jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_creator_id_idx ON orders(creator_id);
CREATE INDEX IF NOT EXISTS orders_payment_ref_idx ON orders(payment_ref);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON orders FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "orders_insert_anon" ON orders FOR INSERT TO anon WITH CHECK (payment_status = 'pending');
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT TO authenticated WITH CHECK (true);

-- 6. DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed','retry')),
  resend_email_id text,
  attempts        int NOT NULL DEFAULT 0,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deliveries_order_id_idx ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS deliveries_status_idx ON deliveries(status);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_select_own" ON deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.creator_id = auth.uid()));

-- 7. STORAGE BUCKET (jalankan di Storage > New Bucket: 'product-files', private)
-- Kemudian buat storage policies berikut di Storage > Policies:
--
-- INSERT: bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text
-- SELECT: bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text
-- DELETE: bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text

-- 8. WEBHOOK INTEGRATIONS (Lynk.id, Linktree, Saweria, Sociabuzz, dll)
CREATE TABLE IF NOT EXISTS webhook_integrations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform          text NOT NULL CHECK (platform IN ('lynk','linktree','saweria','sociabuzz')),
  webhook_token     text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  platform_username text,
  is_connected      boolean NOT NULL DEFAULT false,
  first_payload     jsonb,
  connected_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(creator_id, platform)
);
ALTER TABLE webhook_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_integrations_select_own" ON webhook_integrations FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "webhook_integrations_insert_own" ON webhook_integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "webhook_integrations_update_own" ON webhook_integrations FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
