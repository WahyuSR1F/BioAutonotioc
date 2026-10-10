// Migrasi Turso (idempoten): tabel payment_settings + kolom orders.admin_fee
// Jalankan: node scripts/migrate-payment-settings.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = {};
for (const file of [path.join(root, '.env.local'), path.join(root, '.env')]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && /^[A-Za-z_]/.test(line)) {
      const k = line.slice(0, i);
      if (!(k in env)) env[k] = line.slice(i + 1);
    }
  }
}

const url = env.TURSO_DATABASE_URL;
const authToken = env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('ABORT: TURSO_DATABASE_URL tidak ditemukan di .env.local/.env');
  process.exit(1);
}

const db = createClient({ url, authToken });
const apply = !process.argv.includes('--check');

const tables = await db.execute(
  `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
);
const tableNames = tables.rows.map((r) => String(r.name));
const ordersCols = await db.execute(`PRAGMA table_info(orders)`);
const colNames = ordersCols.rows.map((r) => String(r.name));

const hasSettings = tableNames.includes('payment_settings');
const hasFee = colNames.includes('admin_fee');
const settingsCols = hasSettings
  ? (await db.execute(`PRAGMA table_info(payment_settings)`)).rows.map((r) => String(r.name))
  : [];
const hasMidtransMode = settingsCols.includes('midtrans_mode');
const hasMidtransChannels = settingsCols.includes('midtrans_channels');
console.log('payment_settings:', hasSettings ? 'ada' : 'TIDAK ADA');
console.log('orders.admin_fee:', hasFee ? 'ada' : 'TIDAK ADA');
console.log('payment_settings.midtrans_mode:', hasMidtransMode ? 'ada' : 'TIDAK ADA');
console.log('payment_settings.midtrans_channels:', hasMidtransChannels ? 'ada' : 'TIDAK ADA');

if (!apply) {
  console.log('mode --check: tidak ada perubahan');
  process.exit(0);
}

if (!hasSettings) {
  await db.execute(`
    CREATE TABLE payment_settings (
      creator_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      midtrans_enabled  INTEGER NOT NULL DEFAULT 1,
      midtrans_mode     TEXT CHECK (midtrans_mode IN ('sandbox','production')),
      xendit_enabled    INTEGER NOT NULL DEFAULT 1,
      admin_fee_percent REAL NOT NULL DEFAULT 0 CHECK (admin_fee_percent >= 0 AND admin_fee_percent <= 100),
      admin_fee_flat    REAL NOT NULL DEFAULT 0 CHECK (admin_fee_flat >= 0),
      created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  console.log('OK: tabel payment_settings dibuat');
} else {
  console.log('SKIP: payment_settings sudah ada');
}

if (hasSettings && !hasMidtransMode) {
  await db.execute(`ALTER TABLE payment_settings ADD COLUMN midtrans_mode TEXT CHECK (midtrans_mode IN ('sandbox','production'))`);
  console.log('OK: kolom payment_settings.midtrans_mode ditambahkan');
} else if (hasMidtransMode) {
  console.log('SKIP: payment_settings.midtrans_mode sudah ada');
}

if (hasSettings && !hasMidtransChannels) {
  // JSON array kode kanal Snap (enabled_payments); NULL/kosong = ikuti semua kanal aktif di Midtrans
  await db.execute(`ALTER TABLE payment_settings ADD COLUMN midtrans_channels TEXT`);
  console.log('OK: kolom payment_settings.midtrans_channels ditambahkan');
} else if (hasMidtransChannels) {
  console.log('SKIP: payment_settings.midtrans_channels sudah ada');
}

if (!hasFee) {
  await db.execute(`ALTER TABLE orders ADD COLUMN admin_fee REAL NOT NULL DEFAULT 0`);
  console.log('OK: kolom orders.admin_fee ditambahkan');
} else {
  console.log('SKIP: orders.admin_fee sudah ada');
}

const after = await db.execute(`PRAGMA table_info(payment_settings)`);
console.log('kolom payment_settings:', after.rows.map((r) => r.name).join(', '));
console.log('MIGRASI SELESAI');
