'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Loader2, Percent, Save, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils';

export interface EnvStatus {
  midtrans: { configured: boolean; environment: string; keyPreview: string | null };
  xendit: { configured: boolean; keyPreview: string | null };
  resend: { configured: boolean };
}

export interface SettingsValue {
  midtransEnabled: boolean;
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

  const providers = [
    {
      id: 'midtrans',
      name: 'Midtrans',
      desc: 'Transfer bank, QRIS, VA, kartu kredit',
      configured: env.midtrans.configured,
      badge: env.midtrans.environment,
      keyPreview: env.midtrans.keyPreview,
      enabled: midtransEnabled,
      setEnabled: setMidtransEnabled,
    },
    {
      id: 'xendit',
      name: 'Xendit',
      desc: 'QRIS, VA, e-wallet',
      configured: env.xendit.configured,
      badge: null as string | null,
      keyPreview: env.xendit.keyPreview,
      enabled: xenditEnabled,
      setEnabled: setXenditEnabled,
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
                  {p.configured ? 'Terkonfigurasi' : 'Belum diatur'}
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
              {p.keyPreview && (
                <p className="text-[11px] font-mono text-muted-foreground mt-1">{p.keyPreview}</p>
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
