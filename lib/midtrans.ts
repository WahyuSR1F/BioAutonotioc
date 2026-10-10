import midtransClient from 'midtrans-client';

const {
  NEXT_PUBLIC_APP_URL = 'http://localhost:3000',
  MIDTRANS_SERVER_KEY = '',
  MIDTRANS_CLIENT_KEY = '',
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_ENVIRONMENT = 'SANDBOX',
} = process.env;

/**
 * Mode Midtrans: env `MIDTRANS_IS_PRODUCTION` ('true'/'false') diprioritaskan,
 * fallback ke `MIDTRANS_ENVIRONMENT === 'PRODUCTION'` (konfigurasi lama).
 */
export function resolveMidtransIsProduction(): boolean {
  const flag = (MIDTRANS_IS_PRODUCTION || '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return MIDTRANS_ENVIRONMENT === 'PRODUCTION';
}

export const isProduction = resolveMidtransIsProduction();
export const isSandbox = !isProduction;

/** Client key (publik, diawal "Mid-…") untuk Snap.js popup. Opsional. */
export const midtransClientKey =
  MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '';

// Lazy-init: library resmi memvalidasi serverKey di constructor, jadi klien
// dibuat saat pertama dipakai (bukan saat import — aman saat build tanpa key).
let snapInstance: InstanceType<typeof midtransClient.Snap> | null = null;
let coreInstance: InstanceType<typeof midtransClient.Core> | null = null;

/** Klien Snap resmi (midtrans-client) untuk membuat transaksi/token. */
export function getSnap(): InstanceType<typeof midtransClient.Snap> {
  if (!snapInstance) {
    snapInstance = new midtransClient.Snap({
      isProduction,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: midtransClientKey,
    });
  }
  return snapInstance;
}

/** Klien Core resmi (midtrans-client) untuk cek status transaksi. */
export function getCore(): InstanceType<typeof midtransClient.Core> {
  if (!coreInstance) {
    coreInstance = new midtransClient.Core({
      isProduction,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: midtransClientKey,
    });
  }
  return coreInstance;
}

export const appUrl = NEXT_PUBLIC_APP_URL;
