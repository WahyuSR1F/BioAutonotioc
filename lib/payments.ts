import { queryOne, execute, str, bool, num, nowIso } from '@/lib/turso/client';
import { MidtransService } from '@/lib/midtrans/service';
import {
  resolveMidtransMode,
  getServerKey,
  detectMidtransKeyEnvironment,
  type MidtransMode,
} from '@/lib/midtrans';
import { deliverOrder } from '@/lib/deliver';

export type PaymentProvider = 'midtrans' | 'xendit';

export {
  MIDTRANS_CHANNEL_OPTIONS,
  filterMidtransChannels,
  type MidtransChannelOption,
} from '@/lib/midtrans-channels';
import { filterMidtransChannels } from '@/lib/midtrans-channels';

function parseMidtransChannels(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return filterMidtransChannels(JSON.parse(value));
  } catch {
    return [];
  }
}

export interface PaymentSettings {
  creatorId: string;
  midtransEnabled: boolean;
  /** Mode Midtrans creator: 'sandbox' | 'production' — menentukan key & endpoint yang dipakai. */
  midtransMode: MidtransMode;
  /**
   * Kanal Snap yang ditampilkan di checkout (enabled_payments).
   * Array kosong = tanpa filter (ikuti semua kanal yang aktif di Midtrans).
   */
  midtransChannels: string[];
  xenditEnabled: boolean;
  adminFeePercent: number;
  adminFeeFlat: number;
}

export interface FeeInput {
  adminFeePercent: number;
  adminFeeFlat: number;
}

export interface FeeBreakdown {
  price: number;
  fee: number;
  total: number;
}

export const DEFAULT_PAYMENT_SETTINGS: FeeInput & {
  midtransEnabled: boolean;
  xenditEnabled: boolean;
} = {
  midtransEnabled: true,
  xenditEnabled: true,
  adminFeePercent: 0,
  adminFeeFlat: 0,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseMidtransMode(value: unknown): MidtransMode | null {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'sandbox' || v === 'production') return v;
  return null;
}

export function normalizeSettings(row: Record<string, unknown> | null, creatorId: string): PaymentSettings {
  const mode = row ? parseMidtransMode(row.midtrans_mode) : null;
  return {
    creatorId,
    midtransEnabled: row
      ? row.midtrans_enabled === undefined
        ? true
        : bool(row.midtrans_enabled)
      : true,
    midtransMode: mode ?? resolveMidtransMode(),
    midtransChannels: row ? parseMidtransChannels(row.midtrans_channels) : [],
    xenditEnabled: row
      ? row.xendit_enabled === undefined
        ? true
        : bool(row.xendit_enabled)
      : true,
    adminFeePercent: row ? clamp(num(row.admin_fee_percent), 0, 100) : 0,
    adminFeeFlat: row ? clamp(num(row.admin_fee_flat), 0, 1_000_000_000) : 0,
  };
}

/** Ambil setelan pembayaran creator; mengembalikan default bila belum pernah disimpan. */
export async function getPaymentSettings(creatorId: string): Promise<PaymentSettings> {
  const row = await queryOne(
    'SELECT * FROM payment_settings WHERE creator_id = ?',
    [creatorId]
  );
  return normalizeSettings(row, creatorId);
}

/** Simpan (upsert) setelan pembayaran creator. */
export async function savePaymentSettings(settings: PaymentSettings): Promise<PaymentSettings> {
  const normalized = normalizeSettings(
    {
      midtrans_enabled: settings.midtransEnabled ? 1 : 0,
      midtrans_mode: settings.midtransMode,
      midtrans_channels: JSON.stringify(filterMidtransChannels(settings.midtransChannels)),
      xendit_enabled: settings.xenditEnabled ? 1 : 0,
      admin_fee_percent: settings.adminFeePercent,
      admin_fee_flat: settings.adminFeeFlat,
    },
    settings.creatorId
  );

  await execute(
    `INSERT INTO payment_settings
       (creator_id, midtrans_enabled, midtrans_mode, midtrans_channels, xendit_enabled, admin_fee_percent, admin_fee_flat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(creator_id) DO UPDATE SET
       midtrans_enabled = excluded.midtrans_enabled,
       midtrans_mode    = excluded.midtrans_mode,
       midtrans_channels = excluded.midtrans_channels,
       xendit_enabled   = excluded.xendit_enabled,
       admin_fee_percent = excluded.admin_fee_percent,
       admin_fee_flat    = excluded.admin_fee_flat,
       updated_at        = excluded.updated_at`,
    [
      normalized.creatorId,
      normalized.midtransEnabled ? 1 : 0,
      normalized.midtransMode,
      JSON.stringify(normalized.midtransChannels),
      normalized.xenditEnabled ? 1 : 0,
      normalized.adminFeePercent,
      normalized.adminFeeFlat,
      nowIso(),
      nowIso(),
    ]
  );

  return normalized;
}

/**
 * Rumus admin fee: persen dari harga produk + nominal tetap, dibulatkan ke rupiah utuh.
 * Hasil selalu >= 0.
 */
export function computeAdminFee(price: number, settings: FeeInput): number {
  const base = Number.isFinite(price) && price > 0 ? price : 0;
  const percent = clamp(settings.adminFeePercent, 0, 100);
  const flat = Number.isFinite(settings.adminFeeFlat) && settings.adminFeeFlat > 0 ? settings.adminFeeFlat : 0;
  const fee = Math.round((base * percent) / 100) + Math.round(flat);
  return Math.max(0, fee);
}

export function computeTotals(price: number, settings: FeeInput): FeeBreakdown {
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const fee = computeAdminFee(safePrice, settings);
  return { price: safePrice, fee, total: safePrice + fee };
}

export interface ProviderEnvStatus {
  midtrans: {
    /** Mode default dari env (MIDTRANS_IS_PRODUCTION) — nilai awal sebelum disimpan per creator. */
    defaultMode: MidtransMode;
    /** Status Server Key per mode; key salah satu mode boleh kosong (cukup satu untuk jalan). */
    modes: Record<MidtransMode, MidtransModeStatus>;
    /** true bila ada minimal satu Server Key terpasang. */
    configured: boolean;
  };
  xendit: { configured: boolean; keyPreview: string | null };
  resend: { configured: boolean };
}

export interface MidtransModeStatus {
  configured: boolean;
  keyPreview: string | null;
  /** Environment asal key (deteksi prefix SB-/VT-); null bila tidak dikenali. */
  keyEnvironment: string | null;
}

function maskKey(value: string): string | null {
  if (!value) return null;
  if (value.length <= 10) return '••••••';
  return `${value.slice(0, 6)}••••••${value.slice(-4)}`;
}

function midtransModeStatus(mode: MidtransMode): MidtransModeStatus {
  const key = getServerKey(mode);
  const env = detectMidtransKeyEnvironment(key);
  return {
    configured: Boolean(key),
    keyPreview: maskKey(key),
    keyEnvironment: env ? env.toUpperCase() : null,
  };
}

/** Status koneksi provider dari environment variable server (tidak pernah membocorkan key utuh). */
export function getProviderEnvStatus(): ProviderEnvStatus {
  const xenditKey = process.env.XENDIT_SECRET_KEY || '';
  const modes = {
    sandbox: midtransModeStatus('sandbox'),
    production: midtransModeStatus('production'),
  };
  return {
    midtrans: {
      defaultMode: resolveMidtransMode(),
      modes,
      configured: modes.sandbox.configured || modes.production.configured,
    },
    xendit: {
      configured: xenditKey.length > 0,
      keyPreview: maskKey(xenditKey),
    },
    resend: { configured: Boolean(process.env.RESEND_API_KEY) },
  };
}

/** Provider yang layak ditampilkan di checkout: aktif di setelan DAN key mode aktif terpasang. */
export function getEnabledProviders(settings: PaymentSettings): PaymentProvider[] {
  const env = getProviderEnvStatus();
  const providers: PaymentProvider[] = [];
  if (settings.midtransEnabled && getServerKey(settings.midtransMode)) providers.push('midtrans');
  if (settings.xenditEnabled && env.xendit.configured) providers.push('xendit');
  return providers;
}

async function ensureDeliveryRow(orderId: string): Promise<void> {
  await execute(
    `INSERT INTO deliveries (id, order_id, status, updated_at)
     VALUES (?, ?, 'pending', ?)
     ON CONFLICT(order_id) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at`,
    [crypto.randomUUID(), orderId, nowIso()]
  );
}

/** Tandai order lunas + kirim file (dipakai webhook, sync, dan aksi manual). */
export async function markOrderPaid(orderId: string): Promise<void> {
  await execute(
    `UPDATE orders
     SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ?
     WHERE id = ?`,
    [nowIso(), nowIso(), orderId]
  );
  await ensureDeliveryRow(orderId);
  await deliverOrder(orderId);
}

function mapMidtransStatus(body: Record<string, any>): 'pending' | 'paid' | 'failed' | 'expired' {
  const tx = String(body.transaction_status || '');
  const fraud = String(body.fraud_status || '');
  if (tx === 'settlement' || tx === 'capture') {
    return fraud === 'deny' ? 'failed' : 'paid';
  }
  if (tx === 'expire') return 'expired';
  if (tx === 'deny' || tx === 'cancel') return 'failed';
  return 'pending';
}

export interface SyncResult {
  ok: boolean;
  previousStatus: string;
  currentStatus: string;
  changed: boolean;
  message: string;
}

/**
 * Tarik status terbaru dari Midtrans lalu sinkronkan ke DB.
 * Mode (sandbox/production) diambil dari setelan creator; bila gagal di mode
 * utama dan key mode lain tersedia, otomatis dicoba ke mode lain (order lama
 * bisa dibuat di mode berbeda sebelum creator ganti switch).
 * Jika gross_amount dari Midtrans tidak cocok dengan amount order, status TIDAK diubah.
 */
export async function syncMidtransOrder(order: {
  id: string;
  creatorId: string;
  paymentRef: string;
  amount: number;
  provider: string;
  currentStatus: string;
}): Promise<SyncResult> {
  if (order.provider !== 'midtrans') {
    return {
      ok: false,
      previousStatus: order.currentStatus,
      currentStatus: order.currentStatus,
      changed: false,
      message: 'Sinkronisasi otomatis hanya tersedia untuk Midtrans',
    };
  }
  if (!order.paymentRef) {
    return {
      ok: false,
      previousStatus: order.currentStatus,
      currentStatus: order.currentStatus,
      changed: false,
      message: 'Order tidak memiliki payment_ref',
    };
  }

  const settings = await getPaymentSettings(order.creatorId);
  const primaryMode = settings.midtransMode;
  const otherMode: MidtransMode = primaryMode === 'sandbox' ? 'production' : 'sandbox';

  if (!getServerKey(primaryMode) && !getServerKey(otherMode)) {
    return {
      ok: false,
      previousStatus: order.currentStatus,
      currentStatus: order.currentStatus,
      changed: false,
      message: 'Midtrans belum dikonfigurasi di server',
    };
  }

  let status: Record<string, any>;
  try {
    status = await MidtransService.getTransactionStatus(order.paymentRef, primaryMode);
  } catch (err: any) {
    if (!getServerKey(otherMode)) {
      return {
        ok: false,
        previousStatus: order.currentStatus,
        currentStatus: order.currentStatus,
        changed: false,
        message: err?.message || 'Gagal mengambil status dari Midtrans',
      };
    }
    try {
      status = await MidtransService.getTransactionStatus(order.paymentRef, otherMode);
    } catch (errOther: any) {
      return {
        ok: false,
        previousStatus: order.currentStatus,
        currentStatus: order.currentStatus,
        changed: false,
        message: errOther?.message || 'Gagal mengambil status dari Midtrans',
      };
    }
  }

  const gross = Number(status.gross_amount);
  if (Number.isFinite(gross) && Math.round(gross) !== Math.round(order.amount)) {
    return {
      ok: false,
      previousStatus: order.currentStatus,
      currentStatus: order.currentStatus,
      changed: false,
      message: `Nominal Midtrans (${gross}) tidak cocok dengan order (${order.amount}) — status tidak diubah`,
    };
  }

  const nextStatus = mapMidtransStatus(status);
  const changed = nextStatus !== order.currentStatus;

  if (changed) {
    if (nextStatus === 'paid') {
      await markOrderPaid(order.id);
    } else {
      await execute(
        `UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`,
        [nextStatus, nowIso(), order.id]
      );
    }
  }

  return {
    ok: true,
    previousStatus: order.currentStatus,
    currentStatus: nextStatus,
    changed,
    message: changed
      ? `Status diperbarui: ${order.currentStatus} → ${nextStatus}`
      : `Status tetap ${nextStatus}`,
  };
}
