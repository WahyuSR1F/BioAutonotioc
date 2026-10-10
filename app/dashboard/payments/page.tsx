import { getUser } from '@/lib/auth/me';
import { queryAll, num, str, strOrNull } from '@/lib/turso/client';
import { getPaymentSettings, getProviderEnvStatus } from '@/lib/payments';
import PaymentSettingsCard from '@/components/payments/settings-card';
import OrdersTable, { type PaymentRow } from '@/components/payments/orders-table';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Clock3, TrendingUp, Wallet } from 'lucide-react';

const VALID_STATUS = ['pending', 'paid', 'failed', 'expired', 'refunded'];
const VALID_PROVIDERS = ['midtrans', 'xendit'];

interface Props {
  searchParams: { status?: string; provider?: string };
}

export default async function PaymentsPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) return null;

  const statusFilter = VALID_STATUS.includes(searchParams.status ?? '')
    ? String(searchParams.status)
    : '';
  const providerFilter = VALID_PROVIDERS.includes(searchParams.provider ?? '')
    ? String(searchParams.provider)
    : '';

  const [settings, summaryRows] = await Promise.all([
    getPaymentSettings(user.id),
    queryAll(
      `SELECT payment_status, COUNT(*) AS c,
              COALESCE(SUM(amount), 0) AS total,
              COALESCE(SUM(admin_fee), 0) AS fees
       FROM orders
       WHERE creator_id = ?
       GROUP BY payment_status`,
      [user.id]
    ),
  ]);
  const env = getProviderEnvStatus();

  let paidTotal = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let otherCount = 0;
  let collectedFees = 0;
  for (const r of summaryRows) {
    const status = str(r.payment_status);
    const count = num(r.c);
    const total = num(r.total);
    if (status === 'paid') {
      paidTotal += total;
      paidCount += count;
      collectedFees += num(r.fees);
    } else if (status === 'pending') {
      pendingCount += count;
      pendingTotal += total;
    } else {
      otherCount += count;
    }
  }

  const cards = [
    {
      label: 'Total Pendapatan',
      value: formatCurrency(paidTotal),
      sub: `${paidCount} transaksi lunas`,
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Menunggu Bayar',
      value: formatCurrency(pendingTotal),
      sub: `${pendingCount} transaksi pending`,
      icon: Clock3,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: 'Biaya Admin Terkumpul',
      value: formatCurrency(collectedFees),
      sub: 'dari transaksi lunas',
      icon: Wallet,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Gagal / Expired / Refund',
      value: String(otherCount),
      sub: 'transaksi bermasalah',
      icon: CheckCircle2,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  const conditions = ['o.creator_id = ?'];
  const args: Array<string> = [user.id];
  if (statusFilter) {
    conditions.push('o.payment_status = ?');
    args.push(statusFilter);
  }
  if (providerFilter) {
    conditions.push('o.payment_provider = ?');
    args.push(providerFilter);
  }

  const orderRows = await queryAll(
    `SELECT o.id, o.buyer_email, o.buyer_name, o.amount, o.admin_fee, o.currency,
            o.payment_status, o.payment_provider, o.payment_ref, o.created_at,
            p.title AS product_title,
            d.status AS delivery_status, d.attempts AS delivery_attempts
     FROM orders o
     LEFT JOIN products p ON p.id = o.product_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    args
  );

  const rows: PaymentRow[] = orderRows.map((r) => ({
    id: str(r.id),
    buyerName: strOrNull(r.buyer_name),
    buyerEmail: str(r.buyer_email),
    productTitle: strOrNull(r.product_title),
    amount: num(r.amount),
    adminFee: num(r.admin_fee),
    currency: str(r.currency) || 'IDR',
    status: str(r.payment_status),
    provider: str(r.payment_provider),
    paymentRef: strOrNull(r.payment_ref),
    createdAt: str(r.created_at),
    deliveryStatus: strOrNull(r.delivery_status),
    deliveryAttempts: num(r.delivery_attempts),
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pembayaran</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Konfigurasi Midtrans, biaya admin, dan manajemen transaksi
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>
                <c.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <PaymentSettingsCard
        settings={{
          midtransEnabled: settings.midtransEnabled,
          midtransMode: settings.midtransMode,
          midtransChannels: settings.midtransChannels,
          xenditEnabled: settings.xenditEnabled,
          adminFeePercent: settings.adminFeePercent,
          adminFeeFlat: settings.adminFeeFlat,
        }}
        env={env}
      />

      <OrdersTable rows={rows} statusFilter={statusFilter} providerFilter={providerFilter} />
    </div>
  );
}
