import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { Send } from 'lucide-react';

const statusStyles: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  retry: 'bg-blue-50 text-blue-700',
};
const statusLabels: Record<string, string> = {
  sent: 'Terkirim', pending: 'Antri', failed: 'Gagal', retry: 'Retry',
};

interface DeliveryRow {
  id: string;
  status: string;
  attempts: number;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  orders: {
    id: string;
    buyer_email: string;
    buyer_name: string | null;
    products: { title: string } | null;
  } | null;
}

export default async function DeliveriesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('deliveries')
    .select(`
      id, status, attempts, sent_at, last_error, created_at,
      orders!inner(
        id, buyer_email, buyer_name, creator_id,
        products(title)
      )
    `)
    .eq('orders.creator_id', user.id)
    .order('created_at', { ascending: false });

  const deliveries = (data ?? []) as unknown as DeliveryRow[];

  const counts = {
    total: deliveries.length,
    sent: deliveries.filter((d) => d.status === 'sent').length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    failed: deliveries.filter((d) => d.status === 'failed').length,
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengiriman</h1>
        <p className="text-sm text-muted-foreground mt-1">Log pengiriman file digital ke pembeli</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-foreground' },
          { label: 'Terkirim', value: counts.sent, color: 'text-green-600' },
          { label: 'Antri', value: counts.pending, color: 'text-yellow-600' },
          { label: 'Gagal', value: counts.failed, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {deliveries.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada riwayat pengiriman</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pembeli</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Produk</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Percobaan</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Terkirim</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">{d.orders?.buyer_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{d.orders?.buyer_email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground max-w-[160px] truncate">
                      {d.orders?.products?.title ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[d.status] ?? ''}`}>
                        {statusLabels[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground text-center">{d.attempts}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {d.sent_at ? formatDate(d.sent_at) : '—'}
                    </td>
                    <td className="px-5 py-4 max-w-[200px]">
                      {d.last_error ? (
                        <p className="text-xs text-red-600 truncate">{d.last_error}</p>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
