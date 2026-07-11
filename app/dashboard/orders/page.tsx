import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusStyles: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
  refunded: 'bg-blue-50 text-blue-700',
};
const statusLabels: Record<string, string> = {
  paid: 'Lunas', pending: 'Pending', failed: 'Gagal', expired: 'Expired', refunded: 'Refund',
};
const deliveryStyles: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  retry: 'bg-blue-50 text-blue-700',
};
const deliveryLabels: Record<string, string> = {
  sent: 'Terkirim', pending: 'Antri', failed: 'Gagal', retry: 'Retry',
};

interface OrderRow {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount: number;
  currency: string;
  payment_status: string;
  payment_provider: string;
  created_at: string;
  products: { title: string } | null;
  deliveries: { status: string }[] | null;
}

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('orders')
    .select(`
      id, buyer_email, buyer_name, amount, currency,
      payment_status, payment_provider, created_at,
      products(title),
      deliveries(status)
    `)
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false });

  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pesanan</h1>
        <p className="text-sm text-muted-foreground mt-1">Semua transaksi masuk</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada pesanan masuk</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pembeli</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Produk</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Jumlah</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Provider</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Bayar</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Kirim</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const delivery = order.deliveries?.[0];
                  return (
                    <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">{order.buyer_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground max-w-[180px] truncate">
                        {order.products?.title ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">
                        {formatCurrency(order.amount, order.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium capitalize text-muted-foreground">
                          {order.payment_provider}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[order.payment_status] ?? ''}`}>
                          {statusLabels[order.payment_status] ?? order.payment_status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {delivery ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${deliveryStyles[delivery.status] ?? ''}`}>
                            {deliveryLabels[delivery.status] ?? delivery.status}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/orders/${order.id}`}>Detail</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
