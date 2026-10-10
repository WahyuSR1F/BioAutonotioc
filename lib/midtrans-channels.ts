export interface MidtransChannelOption {
  /** Kode Snap `enabled_payments` */
  code: string;
  label: string;
}

/**
 * Kanal pembayaran Midtrans yang bisa di on/off dari dashboard.
 * Nilai dikirim ke Snap sebagai `enabled_payments` — hanya kanal yang
 * SUDAH aktif di dashboard Midtrans yang akan tampil.
 */
export const MIDTRANS_CHANNEL_OPTIONS: MidtransChannelOption[] = [
  { code: 'bank_transfer', label: 'Virtual Account (semua bank)' },
  { code: 'qris', label: 'QRIS' },
  { code: 'credit_card', label: 'Kartu Kredit / Debit' },
  { code: 'gopay', label: 'GoPay' },
  { code: 'shopeepay', label: 'ShopeePay' },
  { code: 'echannel', label: 'Mandiri e-Commerce' },
  { code: 'indomaret', label: 'Indomaret' },
  { code: 'alfamart', label: 'Alfamart' },
  { code: 'kredivo', label: 'Kredivo' },
  { code: 'akulaku', label: 'Akulaku' },
];

const MIDTRANS_CHANNEL_CODES = new Set(MIDTRANS_CHANNEL_OPTIONS.map((o) => o.code));

/** Kode kanal yang valid (memfilter input dari client/DB). */
export function filterMidtransChannels(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  return codes.map(String).filter((c) => MIDTRANS_CHANNEL_CODES.has(c));
}
