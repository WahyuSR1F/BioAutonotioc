import midtransClient from 'midtrans-client';

export type MidtransMode = 'sandbox' | 'production';

const {
  NEXT_PUBLIC_APP_URL = 'http://localhost:3000',
  MIDTRANS_SERVER_KEY = '',
  MIDTRANS_CLIENT_KEY = '',
  MIDTRANS_SERVER_KEY_SANDBOX = '',
  MIDTRANS_SERVER_KEY_PRODUCTION = '',
  MIDTRANS_CLIENT_KEY_SANDBOX = '',
  MIDTRANS_CLIENT_KEY_PRODUCTION = '',
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_ENVIRONMENT = 'SANDBOX',
} = process.env;

/**
 * Mode default dari env: `MIDTRANS_IS_PRODUCTION` ('true'/'false') diprioritaskan,
 * fallback ke `MIDTRANS_ENVIRONMENT === 'PRODUCTION'` (konfigurasi lama).
 * Nilai ini hanya default — mode per creator bisa dioverride lewat setelan pembayaran (DB).
 */
export function resolveMidtransIsProduction(): boolean {
  const flag = (MIDTRANS_IS_PRODUCTION || '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return MIDTRANS_ENVIRONMENT === 'PRODUCTION';
}

export function resolveMidtransMode(): MidtransMode {
  return resolveMidtransIsProduction() ? 'production' : 'sandbox';
}

export const isProduction = resolveMidtransIsProduction();
export const isSandbox = !isProduction;

/** Deteksi environment asal key dari prefix-nya: 'SB-' sandbox, 'VT-' production. */
export function detectMidtransKeyEnvironment(key: string): 'sandbox' | 'production' | null {
  const k = key.trim();
  if (k.startsWith('SB-')) return 'sandbox';
  if (k.startsWith('VT-')) return 'production';
  return null;
}

const MAIN_SERVER_KEY = MIDTRANS_SERVER_KEY.trim();
const MAIN_CLIENT_KEY = (MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();

/**
 * Pilih key untuk `mode`: var khusus menang; jika tidak ada, pakai var umum
 * asalkan environment key cocok dengan mode (atau tidak terdeteksi).
 * Mengembalikan '' bila key untuk mode itu belum tersedia.
 */
function pickKey(perMode: string, main: string, mode: MidtransMode): string {
  const dedicated = perMode.trim();
  if (dedicated) return dedicated;
  if (!main) return '';
  const env = detectMidtransKeyEnvironment(main);
  if (env === null || env === mode) return main;
  return '';
}

/** Server key (rahasia) untuk mode tertentu; '' bila belum dikonfigurasi. */
export function getServerKey(mode: MidtransMode): string {
  return pickKey(
    mode === 'production' ? MIDTRANS_SERVER_KEY_PRODUCTION : MIDTRANS_SERVER_KEY_SANDBOX,
    MAIN_SERVER_KEY,
    mode
  );
}

/** Client key (publik, "Mid-…"/"SB-Mid-…") untuk popup Snap.js pada mode tertentu. */
export function getClientKey(mode: MidtransMode): string {
  return pickKey(
    mode === 'production' ? MIDTRANS_CLIENT_KEY_PRODUCTION : MIDTRANS_CLIENT_KEY_SANDBOX,
    MAIN_CLIENT_KEY,
    mode
  );
}

/** Semua server key yang terpasang (untuk verifikasi webhook lintas mode). */
export function getConfiguredServerKeys(): string[] {
  return Array.from(new Set([getServerKey('sandbox'), getServerKey('production')].filter(Boolean)));
}

/** Server key untuk mode default env (kompatibilitas dengan kode lama). */
export const midtransServerKey = getServerKey(resolveMidtransMode());

/** Client key untuk mode default env (kompatibilitas dengan kode lama). */
export const midtransClientKey = getClientKey(resolveMidtransMode());

export interface MidtransMisconfiguration {
  code: 'missing_key' | 'client_key_used' | 'environment_mismatch';
  message: string;
}

/**
 * Validasi konfigurasi SEBELUM memanggil API Midtrans untuk `mode`.
 * null = aman; selain itu berisi pesan jelas (tanpa membocorkan key) —
 * mis. 401 karena key production dipakai di mode sandbox.
 */
export function getMidtransMisconfiguration(mode: MidtransMode = resolveMidtransMode()): MidtransMisconfiguration | null {
  const key = getServerKey(mode);
  if (!key) {
    const otherMode: MidtransMode = mode === 'sandbox' ? 'production' : 'sandbox';
    const otherKey = getServerKey(otherMode);
    if (otherKey) {
      return {
        code: 'environment_mismatch',
        message: `Server Key terpasang adalah key ${otherMode.toUpperCase()}, sedangkan mode aktif ${mode.toUpperCase()}. Midtrans membalas 401 Unauthorized — pilih mode ${
          otherMode === 'production' ? 'Production' : 'Sandbox'
        } di setelan pembayaran, atau isi MIDTRANS_SERVER_KEY_${mode.toUpperCase()}.`,
      };
    }
    return {
      code: 'missing_key',
      message: `MIDTRANS_SERVER_KEY${mode === 'sandbox' ? '_SANDBOX' : ''} belum di-set di environment variable server. Ambil dari dashboard Midtrans → Settings → Access Keys.`,
    };
  }
  if (/^SB-Mid-/.test(key) || /^Mid-/.test(key)) {
    return {
      code: 'client_key_used',
      message:
        'MIDTRANS_SERVER_KEY berisi Client Key (diawali Mid-/SB-Mid-). Ganti dengan Server Key dari dashboard Midtrans → Settings → Access Keys.',
    };
  }
  return null;
}

// Lazy-init per mode: library resmi memvalidasi serverKey di constructor, jadi
// klien dibuat saat pertama dipakai (bukan saat import — aman saat build tanpa key).
const snapInstances = new Map<MidtransMode, InstanceType<typeof midtransClient.Snap>>();
const coreInstances = new Map<MidtransMode, InstanceType<typeof midtransClient.Core>>();

/** Klien Snap resmi (midtrans-client) untuk membuat transaksi/token pada mode tertentu. */
export function getSnap(
  mode: MidtransMode = resolveMidtransMode()
): InstanceType<typeof midtransClient.Snap> {
  let instance = snapInstances.get(mode);
  if (!instance) {
    instance = new midtransClient.Snap({
      isProduction: mode === 'production',
      serverKey: getServerKey(mode),
      clientKey: getClientKey(mode),
    });
    snapInstances.set(mode, instance);
  }
  return instance;
}

/** Klien Core resmi (midtrans-client) untuk cek status transaksi pada mode tertentu. */
export function getCore(
  mode: MidtransMode = resolveMidtransMode()
): InstanceType<typeof midtransClient.Core> {
  let instance = coreInstances.get(mode);
  if (!instance) {
    instance = new midtransClient.Core({
      isProduction: mode === 'production',
      serverKey: getServerKey(mode),
      clientKey: getClientKey(mode),
    });
    coreInstances.set(mode, instance);
  }
  return instance;
}

export const appUrl = NEXT_PUBLIC_APP_URL;
