'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Loader2, Percent, Save, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MIDTRANS_CHANNEL_OPTIONS } from '@/lib/midtrans-channels';
import { formatCurrency } from '@/lib/utils';

type MidtransMode = 'sandbox' | 'production';

export interface EnvStatus {
  midtrans: {
    defaultMode: MidtransMode;
    modes: Record<
      MidtransMode,
      { configured: boolean; keyPreview: string | null; keyEnvironment: string | null }
    >;
    configured: boolean;
  };
  xendit: { configured: boolean; keyPreview: string | null };
  resend: { configured: boolean };
}

export interface SettingsValue {
  midtransEnabled: boolean;
  midtransMode: MidtransMode;
  /** Kode kanal Snap yang ditampilkan di checkout; kosong = ikuti semua kanal aktif di Midtrans. */
  midtransChannels: string[];
  xenditEnabled: boolean;
  adminFeePercent: number;
  adminFeeFlat: number;
}

interface Props {
  settings: SettingsValue;
  env: EnvStatus;
}

const PREVIEW_BASE = 100000;

export default function PaymentSettingsCard({ settings, env }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [midtransEnabled, setMidtransEnabled] = useState(settings.midtransEnabled);
  const [midtransMode, setMidtransMode] = useState<MidtransMode>(settings.midtransMode);
  const [midtransChannels, setMidtransChannels] = useState<string[]>(settings.midtransChannels);
  const [xenditEnabled, setXenditEnabled] = useState(settings.xenditEnabled);
  const [percent, setPercent] = useState(String(settings.adminFeePercent));
  const [flat, setFlat] = useState(String(settings.adminFeeFlat));

  const percentNum = Math.min(100, Math.max(0, Number(percent) || 0));
  const flatNum = Math.max(0, Number(flat) || 0);
  const previewFee = Math.round((PREVIEW_BASE * percentNum) / 100) + Math.round(flatNum);

  async function onSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          midtransEnabled,
          midtransMode,
          midtransChannels,
          xenditEnabled,
          adminFeePercent: percentNum,
          adminFeeFlat: flatNum,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Gagal menyimpan setelan');
        return;
      }
      toast.success('Setelan pembayaran disimpan');
      router.refresh();
    } catch {
      toast.error('Gagal menyimpan setelan');
    } finally {
      setLoading(false);
    }
  }

  const midtransModeStatus = env.midtrans.modes[midtransMode];
  const otherMode: MidtransMode = midtransMode === 'sandbox' ? 'production' : 'sandbox';
  const otherModeStatus = env.midtrans.modes[otherMode];
  // Key terpasang tapi format-nya milik environment lain (mis. key production di var sandbox)
  const midtransKeyMismatch = Boolean(
    midtransModeStatus.configured &&
    midtransModeStatus.keyEnvironment &&
    midtransModeStatus.keyEnvironment !== midtransMode.toUpperCase()
  );

  const midtransWarning = !midtransModeStatus.configured
    ? otherModeStatus.configured
      ? `Server Key untuk mode ${midtransMode.toUpperCase()} belum di-set di env (MIDTRANS_SERVER_KEY${
          midtransMode === 'sandbox' ? '_SANDBOX' : '_PRODUCTION'
        }). Saat ini hanya key ${otherMode.toUpperCase()} yang terpasang — transaksi akan gagal 401.`
      : 'Midtrans belum dikonfigurasi — isi MIDTRANS_SERVER_KEY (dan MIDTRANS_SERVER_KEY_SANDBOX bila ingin mode sandbox).'
    : midtransKeyMismatch
      ? `Key terpasang untuk mode ${midtransMode.toUpperCase()} terdeteksi sebagai key ${midtransModeStatus.keyEnvironment} (${
          midtransModeStatus.keyEnvironment === 'PRODUCTION' ? 'Mid-server-' : 'SB-'
        }…) — endpoint ${midtransMode.toUpperCase()} akan menolaknya (403/401). Ganti dengan key ${midtransMode} yang benar, atau pindah toggle ke ${midtransModeStatus.keyEnvironment}.`
      : null;

  const providers = [
    {
      id: 'midtrans',
      name: 'Midtrans',
      desc: 'Transfer bank, QRIS, VA, kartu kredit',
      configured: midtransModeStatus.configured && !midtransKeyMismatch,
      statusLabel: midtransKeyMismatch ? 'Key tidak cocok' : null as string | null,
      badge: midtransMode.toUpperCase(),
      keyPreview: midtransModeStatus.keyPreview,
      enabled: midtransEnabled,
      setEnabled: setMidtransEnabled,
      showModeToggle: true,
      warning: midtransWarning,
    },
    {
      id: 'xendit',
      name: 'Xendit',
      desc: 'QRIS, VA, e-wallet',
      configured: env.xendit.configured,
      statusLabel: null as string | null,
      badge: null as string | null,
      keyPreview: env.xendit.keyPreview,
      enabled: xenditEnabled,
      setEnabled: setXenditEnabled,
      showModeToggle: false,
      warning: null as string | null,
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-border p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <CreditCard className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Metode Pembayaran</h2>
          <p className="text-xs text-muted-foreground">Koneksi gateway &amp; metode yang ditampilkan di checkout</p>
        </div>
      </div>

      {/* Status koneksi provider */}
      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-secondary/30"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    p.configured ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {p.statusLabel ?? (p.configured ? 'Terkonfigurasi' : 'Belum diatur')}
                </span>
                {p.badge && (
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      p.badge === 'PRODUCTION'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.desc}</p>
              {p.showModeToggle && (
                <div className="mt-2 space-y-1">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={midtransMode}
                    onValueChange={(v) => {
                      if (v === 'sandbox' || v === 'production') setMidtransMode(v);
                    }}
                    aria-label="Mode Midtrans"
                  >
                    <ToggleGroupItem value="sandbox" aria-label="Mode sandbox">
                      Sandbox
                    </ToggleGroupItem>
                    <ToggleGroupItem value="production" aria-label="Mode production">
                      Production
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-[11px] text-muted-foreground">
                    Transaksi memakai key & endpoint sesuai mode ini — tidak perlu ganti env var.
                  </p>
                </div>
              )}
              {p.keyPreview && (
                <p className="text-[11px] font-mono text-muted-foreground mt-1">{p.keyPreview}</p>
              )}
              {p.warning && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                  {p.warning}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {p.enabled ? 'Aktif' : 'Nonaktif'}
              </span>
              <Switch
                checked={p.enabled}
                disabled={!p.configured}
                onCheckedChange={(v) => p.setEnabled(v)}
                aria-label={`Aktifkan ${p.name}`}
              />
            </div>
          </div>
        ))}
        {!env.resend.configured && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            RESEND_API_KEY belum diatur — file produk tidak akan terkirim otomatis ke pembeli.
          </p>
        )}

        {/* Kanal Midtrans (enabled_payments) */}
        {midtransEnabled && (
          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Kanal Pembayaran Midtrans</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Centang kanal yang ditampilkan saat checkout. Kosong = ikuti semua kanal yang
                aktif di dashboard Midtrans.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {MIDTRANS_CHANNEL_OPTIONS.map((ch) => {
                const checked = midtransChannels.includes(ch.code);
                return (
                  <label
                    key={ch.code}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setMidtransChannels((prev) =>
                          v
                            ? prev.includes(ch.code)
                              ? prev
                              : [...prev, ch.code]
                            : prev.filter((c) => c !== ch.code)
                        )
                      }
                      aria-label={ch.label}
                    />
                    {ch.label}
                  </label>
                );
              })}
            </div>
            {midtransChannels.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tanpa filter — pembeli melihat semua kanal yang aktif di Midtrans.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Admin fee */}
      <div className="pt-2 border-t border-border space-y-4">
        <div className="flex items-center gap-3 pt-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Biaya Admin</h3>
            <p className="text-xs text-muted-foreground">
              Ditambahkan ke total saat checkout, dihitung dari harga produk
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="adminFeePercent" className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" /> Persen (%)
            </Label>
            <div className="flex items-center">
              <Input
                id="adminFeePercent"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="rounded-r-none"
              />
              <span className="px-3 h-10 flex items-center text-sm text-muted-foreground bg-secondary border border-l-0 border-border rounded-r-lg">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">0 – 100</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminFeeFlat">Nominal tetap (Rp)</Label>
            <div className="flex items-center">
              <span className="px-3 h-10 flex items-center text-sm text-muted-foreground bg-secondary border border-r-0 border-border rounded-l-lg">
                Rp
              </span>
              <Input
                id="adminFeeFlat"
                type="number"
                min={0}
                step="100"
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
                className="rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">Ditambahkan per transaksi</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-1">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Contoh perhitungan
          </p>
          <p className="text-xs text-muted-foreground">
            Produk {formatCurrency(PREVIEW_BASE)} → biaya admin{' '}
            <span className="font-semibold text-foreground">{formatCurrency(previewFee)}</span> →
            total{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(PREVIEW_BASE + previewFee)}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Rumus: {percentNum}% × harga + {formatCurrency(Math.round(flatNum))}, dibulatkan ke
            rupiah utuh.
          </p>
        </div>

        <Button onClick={onSave} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Simpan Setelan Pembayaran
        </Button>
      </div>
    </section>
  );
}
