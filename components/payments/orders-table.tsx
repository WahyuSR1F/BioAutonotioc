'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface PaymentRow {
  id: string;
  buyerName: string | null;
  buyerEmail: string;
  productTitle: string | null;
  amount: number;
  adminFee: number;
  currency: string;
  status: string;
  provider: string;
  paymentRef: string | null;
  createdAt: string;
  deliveryStatus: string | null;
  deliveryAttempts: number;
}

interface Props {
  rows: PaymentRow[];
  statusFilter: string;
  providerFilter: string;
}

const statusStyles: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
  refunded: 'bg-blue-50 text-blue-700',
};
const statusLabels: Record<string, string> = {
  paid: 'Lunas',
  pending: 'Pending',
  failed: 'Gagal',
  expired: 'Expired',
  refunded: 'Refund',
};

const STATUS_OPTIONS = ['pending', 'paid', 'failed', 'expired', 'refunded'];
const PROVIDER_OPTIONS = ['midtrans', 'xendit'];

export default function OrdersTable({ rows, statusFilter, providerFilter }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  function applyFilter(key: 'status' | 'provider', value: string) {
    const params = new URLSearchParams();
    const nextStatus = key === 'status' ? value : statusFilter;
    const nextProvider = key === 'provider' ? value : providerFilter;
    if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus);
    if (nextProvider && nextProvider !== 'all') params.set('provider', nextProvider);
    const qs = params.toString();
    router.push(`/dashboard/payments${qs ? `?${qs}` : ''}`);
  }

  async function runAction(id: string, action: 'sync' | 'mark_paid' | 'resend') {
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      const res = await fetch(`/api/payments/orders/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || result.message || 'Aksi gagal');
        return;
      }
      toast.success(result.message || 'Selesai');
      router.refresh();
    } catch {
      toast.error('Gagal menjalankan aksi');
    } finally {
      setBusy(null);
    }
  }

  const hasFilter = Boolean(statusFilter || providerFilter);

  return (
    <section className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
        <div className="mr-auto">
          <h2 className="font-semibold text-foreground">Transaksi</h2>
          <p className="text-xs text-muted-foreground">{rows.length} data ditampilkan</p>
        </div>

        <div className="w-40">
          <Select value={statusFilter || 'all'} onValueChange={(v) => applyFilter('status', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Select value={providerFilter || 'all'} onValueChange={(v) => applyFilter('provider', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Semua metode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua metode</SelectItem>
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="capitalize">{p}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilter && (
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/payments')}>
            Reset
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasFilter ? 'Tidak ada transaksi yang cocok dengan filter' : 'Belum ada transaksi'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pembeli</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Produk</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Jumlah</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Metode</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tanggal</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const detailKey = (action: string) => `${row.id}:${action}`;
                return (
                  <tr key={row.id} className="hover:bg-secondary/20 transition-colors align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">{row.buyerName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{row.buyerEmail}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground max-w-[180px] truncate">
                      {row.productTitle ?? '—'}
                      {row.paymentRef && (
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {row.paymentRef}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(row.amount, row.currency)}
                      </p>
                      {row.adminFee > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          termasuk biaya admin {formatCurrency(row.adminFee, row.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground capitalize">
                      {row.provider}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          statusStyles[row.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabels[row.status] ?? row.status}
                      </span>
                      {row.status === 'paid' && row.deliveryStatus && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          kirim: {row.deliveryStatus} ({row.deliveryAttempts}x)
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(row.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.provider === 'midtrans' && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Sinkron status dari Midtrans"
                            onClick={() => runAction(row.id, 'sync')}
                            disabled={busy !== null}
                          >
                            {busy === detailKey('sync') ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}

                        {row.status !== 'paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Tandai lunas manual"
                            onClick={() => runAction(row.id, 'mark_paid')}
                            disabled={busy !== null}
                          >
                            {busy === detailKey('mark_paid') ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}

                        {row.status === 'paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Kirim ulang file ke email pembeli"
                            onClick={() => runAction(row.id, 'resend')}
                            disabled={busy !== null}
                          >
                            {busy === detailKey('resend') ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}

                        <Button variant="ghost" size="sm" title="Detail pesanan" asChild>
                          <Link href={`/dashboard/orders/${row.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
