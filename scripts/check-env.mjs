#!/usr/bin/env node
/**
 * Check environment variables yang dibutuhkan aplikasi.
 *
 * Jalankan:  node scripts/check-env.mjs
 *            npm run check:env
 *
 * Sumber kebenaran: semua `process.env.X` / `env.X` di source code.
 * File env dibaca dengan prioritas Next.js: .env.local > .env (NODE_ENV dikecualikan).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['app', 'lib', 'components', 'hooks', 'utils', 'types', 'scripts'];
const SCAN_FILES = ['middleware.ts', 'next.config.js'];

const REQUIRED = new Set([
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'AUTH_SECRET',
  'NEXT_PUBLIC_APP_URL',
]);

// Fitur: kosong = fitur nonaktif, bukan error fatal.
const OPTIONAL = new Set([
  'MIDTRANS_ENVIRONMENT',
  'MIDTRANS_IS_PRODUCTION',
  'MIDTRANS_MERCHANT_ID',
  'MIDTRANS_SERVER_KEY_PRODUCTION',
  'MIDTRANS_CLIENT_KEY_PRODUCTION',
  'RESEND_API_KEY',
  'XENDIT_SECRET_KEY',
  'XENDIT_CALLBACK_TOKEN',
  'NODE_ENV',
]);

const PAYMENT_VARS = new Set([
  'MIDTRANS_SERVER_KEY',
  'MIDTRANS_SERVER_KEY_SANDBOX',
  'MIDTRANS_CLIENT_KEY',
  'MIDTRANS_CLIENT_KEY_SANDBOX',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'XENDIT_SECRET_KEY',
  'XENDIT_CALLBACK_TOKEN',
  'RESEND_API_KEY',
]);

// ---------------------------------------------------------------- scan source
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Buang komentar & string literal supaya contoh/komentar tidak dihitung sebagai pemakaian. */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function add(used, name, rel) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return;
  if (!used.has(name)) used.set(name, new Set());
  used.get(name).add(rel);
}

function scanUsedVars() {
  const used = new Map();
  const files = [
    ...SCAN_DIRS.flatMap((d) => walk(path.join(root, d))),
    ...SCAN_FILES.map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)),
  ];
  const patterns = [/process\.env\.([A-Z][A-Z0-9_]*)/g, /(?<![\w.])env\.([A-Z][A-Z0-9_]*)/g];
  for (const file of files) {
    if (path.resolve(file) === fileURLToPath(import.meta.url)) continue;
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const src = strip(fs.readFileSync(file, 'utf8'));
    for (const re of patterns) {
      for (const m of src.matchAll(re)) add(used, m[1], rel);
    }
    // destructuring: const { FOO = '', BAR } = process.env
    for (const m of src.matchAll(/const\s*\{([\s\S]*?)\}\s*=\s*process\.env/g)) {
      for (const v of m[1].matchAll(/([A-Z][A-Z0-9_]*)(?=\s*[,}=])/g)) add(used, v[1], rel);
    }
  }
  return used;
}

// ---------------------------------------------------------------- read env files
function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const base = parseEnvFile(path.join(root, '.env'));
  const local = parseEnvFile(path.join(root, '.env.local'));
  const merged = { ...base, ...local };
  if (merged.NODE_ENV) merged.NODE_ENV = process.env.NODE_ENV || merged.NODE_ENV;
  const origin = {};
  for (const k of Object.keys(base)) origin[k] = '.env';
  for (const k of Object.keys(local)) origin[k] = '.env.local';
  return { merged, origin, hasLocal: fs.existsSync(path.join(root, '.env.local')) };
}

// ---------------------------------------------------------------- helpers
const isPlaceholder = (v = '') => /your[-_]/i.test(v) || /^(vt|sb|mid)-your/i.test(v.trim());
const present = (v) => typeof v === 'string' && v.trim().length > 0 && !isPlaceholder(v);

function detectKeyEnv(key) {
  const k = key.trim();
  if (k.startsWith('SB-')) return 'sandbox';
  if (k.startsWith('VT-') || k.startsWith('Mid-')) return 'production';
  return null;
}

function activeMidtransMode(env) {
  const flag = (env.MIDTRANS_IS_PRODUCTION || '').trim().toLowerCase();
  if (flag === 'true') return 'production';
  if (flag === 'false') return 'sandbox';
  return (env.MIDTRANS_ENVIRONMENT || 'SANDBOX').trim().toUpperCase() === 'PRODUCTION' ? 'production' : 'sandbox';
}

// ---------------------------------------------------------------- main
const used = scanUsedVars();
const { merged: env, origin, hasLocal } = loadEnv();

const all = [...used.keys()].sort();
const missing = [];
const empty = [];
const ok = [];
const warnings = [];

for (const name of all) {
  const raw = env[name];
  const status = raw === undefined ? 'missing' : present(raw) ? 'ok' : 'empty';
  const required = REQUIRED.has(name);
  const files = [...used.get(name)].slice(0, 3).join(', ');
  const row = { name, status, required, from: origin[name] || '-', files };
  if (status === 'ok') ok.push(row);
  else if (required) missing.push(row);
  else empty.push(row);
}

// ---- validasi silang Midtrans (sama dengan lib/midtrans.ts)
const mode = activeMidtransMode(env);
const serverMain = (env.MIDTRANS_SERVER_KEY || '').trim();
const serverMode = (mode === 'sandbox' ? env.MIDTRANS_SERVER_KEY_SANDBOX : env.MIDTRANS_SERVER_KEY_PRODUCTION || '').trim();
const clientMain = (env.MIDTRANS_CLIENT_KEY || env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();
const clientMode = (mode === 'sandbox' ? env.MIDTRANS_CLIENT_KEY_SANDBOX : env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();

function resolveKey(dedicated, main) {
  if (dedicated && !isPlaceholder(dedicated)) return dedicated;
  if (!main || isPlaceholder(main)) return '';
  const k = detectKeyEnv(main);
  return k === null || k === mode ? main : '';
}

const activeServerKey = resolveKey(serverMode, serverMain);
const activeClientKey = resolveKey(clientMode, clientMain);

if (!present(activeServerKey)) {
  const other = mode === 'sandbox' ? 'production' : 'sandbox';
  const otherKey = resolveKey(mode === 'sandbox' ? (env.MIDTRANS_SERVER_KEY_PRODUCTION || '').trim() : (env.MIDTRANS_SERVER_KEY_SANDBOX || '').trim(), serverMain);
  warnings.push(
    otherKey
      ? `Midtrans mode aktif ${mode.toUpperCase()} tidak punya Server Key (key terpasang terdeteksi ${detectKeyEnv(otherKey)?.toUpperCase()} → mismatch, API akan 401). Isi MIDTRANS_SERVER_KEY_${mode.toUpperCase()} dengan key ${mode}.`
      : `MIDTRANS_SERVER_KEY${mode === 'sandbox' ? '_SANDBOX' : ''} belum terisi → checkout Midtrans ${mode.toUpperCase()} akan gagal.`
  );
}
if (!present(activeClientKey)) {
  warnings.push(`Client key Midtrans (${mode}) belum ada → Snap popup tidak bisa dibuka. Isi MIDTRANS_CLIENT_KEY${mode === 'sandbox' ? '_SANDBOX' : ''} atau NEXT_PUBLIC_MIDTRANS_CLIENT_KEY.`);
}
if (present(serverMain) && detectKeyEnv(serverMain) === 'production' && mode === 'sandbox' && !present(serverMode)) {
  warnings.push(`MIDTRANS_SERVER_KEY diisi key production ("Mid-…") tetapi MIDTRANS_ENVIRONMENT=${env.MIDTRANS_ENVIRONMENT || '(default)'} → mode aktif SANDBOX. Set MIDTRANS_IS_PRODUCTION=true ATAU isi MIDTRANS_SERVER_KEY_SANDBOX dengan key "SB-…".`);
}
if (!present(env.RESEND_API_KEY)) {
  warnings.push('RESEND_API_KEY kosong → delivery email produk ke buyer otomatis gagal (status "failed").');
}
if (!present(env.XENDIT_SECRET_KEY) || !present(env.XENDIT_CALLBACK_TOKEN)) {
  warnings.push('XENDIT_SECRET_KEY / XENDIT_CALLBACK_TOKEN kosong → gateway Xendit nonaktif & webhook akan ditolak.');
}
if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
  warnings.push(`AUTH_SECRET hanya ${env.AUTH_SECRET.length} karakter (disarankan min 32) → session cookie rentan.`);
}

// ---------------------------------------------------------------- report
const pad = (s, n) => String(s).padEnd(n);
const mark = (s) => (s === 'ok' ? '[OK]' : s === 'empty' ? '[EMPTY]' : '[MISSING]');

console.log(`\nEnv check — ${all.length} variabel terdeteksi di source code`);
console.log(`File env: .env${fs.existsSync(path.join(root, '.env')) ? '' : ' (tidak ada)'}${hasLocal ? ' + .env.local (menang)' : ''}\n`);

if (missing.length) {
  console.log('WAJIB belum terisi:');
  for (const r of missing) console.log(`  ${pad(mark(r.status), 10)} ${pad(r.name, 30)} di ${r.files}`);
  console.log('');
}

if (empty.length) {
  console.log('Opsional / fitur belum aktif:');
  for (const r of empty) console.log(`  ${pad(mark(r.status), 10)} ${pad(r.name, 30)} di ${r.files}`);
  console.log('');
}

if (warnings.length) {
  console.log('Peringatan:');
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log('');
}

console.log('Terisi OK:');
for (const r of ok) console.log(`  ${pad(mark(r.status), 10)} ${pad(r.name, 30)} (${r.from})`);
console.log('');

const failed = missing.length > 0;
console.log(failed ? `HASIL: GAGAL — ${missing.length} env wajib kosong.` : 'HASIL: Semua env wajib sudah terisi.');
process.exit(failed ? 1 : 0);
