import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, ShoppingCart, Send, Package } from 'lucide-react';
import RevenueChart from '@/components/dashboard/revenue-chart';

interface OrderRow {
  amount: number;
  payment_status: string;
  created_at: string;
}
interface RecentOrder {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount: number;
  currency: string;
  payment_status: string;
  created_at: string;
  products: { title: string } | null;
}

async function getStats(userId: string) {
  const supabase = createClient();

  const [ordersRes, deliveriesRes, productsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('amount, payment_status, created_at')
      .eq('creator_id', userId),
    supabase
      .from('deliveries')
      .select('status, order_id, orders!inner(creator_id)')
      .eq('orders.creator_id', userId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .eq('is_active', true),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const deliveries = (deliveriesRes.data ?? []) as unknown as { status: string }[];

  const totalRevenue = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const totalOrders = orders.filter((o) => o.payment_status === 'paid').length;
  const sentDeliveries = deliveries.filter((d) => d.status === 'sent').length;
  const activeProducts = productsRes.count ?? 0;

  const chartData: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const revenue = orders
      .filter((o) => o.payment_status === 'paid' && o.created_at.startsWith(dateStr))
      .reduce((sum, o) => sum + Number(o.amount), 0);
    chartData.push({
      date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      revenue,
    });
  }

  return { totalRevenue, totalOrders, sentDeliveries, activeProducts, chartData };
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const stats = await getStats(user.id);

  const { data } = await supabase
    .from('orders')
    .select('id, buyer_email, buyer_name, amount, currency, payment_status, created_at, products(title)')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentOrders = (data ?? []) as unknown as RecentOrder[];

  const statCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Pesanan Selesai', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-green-600 bg-green-50' },
    { label: 'File Terkirim', value: stats.sentDeliveries.toString(), icon: Send, color: 'text-purple-600 bg-purple-50' },
    { label: 'Produk Aktif', value: stats.activeProducts.toString(), icon: Package, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Pantau performa toko digital Anda</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Revenue 7 Hari Terakhir</h2>
        <p className="text-xs text-muted-foreground mb-4">Berdasarkan pesanan yang sudah dibayar</p>
        <RevenueChart data={stats.chartData} />
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Pesanan Terbaru</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground text-sm">
            Belum ada pesanan
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {order.buyer_name || order.buyer_email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.products?.title ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(order.amount, order.currency)}
                  </span>
                  <StatusBadge status={order.payment_status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-50 text-green-700',
    pending: 'bg-yellow-50 text-yellow-700',
    failed: 'bg-red-50 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    refunded: 'bg-blue-50 text-blue-700',
  };
  const labels: Record<string, string> = {
    paid: 'Lunas', pending: 'Pending', failed: 'Gagal', expired: 'Expired', refunded: 'Refund',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}
