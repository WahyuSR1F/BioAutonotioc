import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Mail, CreditCard, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import RetryDeliveryButton from '@/components/orders/retry-delivery-button';

interface Props {
  params: { id: string };
}

const payStatusColors: Record<string, string> = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
};
const deliveryStatusColors: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  retry: 'bg-blue-50 text-blue-700',
};

interface OrderDetail {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount: number;
  currency: string;
  payment_status: string;
  payment_provider: string;
  payment_ref: string | null;
  paid_at: string | null;
  created_at: string;
  products: { title: string; description: string | null; cover_url: string | null } | null;
  deliveries: {
    id: string;
    status: string;
    attempts: number;
    sent_at: string | null;
    resend_email_id: string | null;
    last_error: string | null;
  }[] | null;
}

export default async function OrderDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('orders')
    .select(`*, products(title, description, cover_url), deliveries(*)`)
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .maybeSingle();

  const order = data as unknown as OrderDetail | null;
  if (!order) notFound();

  const delivery = order.deliveries?.[0];

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/orders">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Detail Pesanan</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{order.id}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Buyer Info */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Info Pembeli</h2>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Nama" value={order.buyer_name || '—'} />
            <Row label="Email" value={order.buyer_email} />
            <Row label="Waktu Order" value={formatDate(order.created_at)} />
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Info Pembayaran</h2>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Jumlah" value={formatCurrency(order.amount, order.currency)} bold />
            <Row label="Provider" value={order.payment_provider} />
            <Row label="Ref" value={order.payment_ref || '—'} mono />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${payStatusColors[order.payment_status] ?? ''}`}>
                {order.payment_status}
              </span>
            </div>
            {order.paid_at && <Row label="Dibayar" value={formatDate(order.paid_at)} />}
          </div>
        </div>

        {/* Product */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Produk</h2>
          </div>
          <p className="text-sm font-medium text-foreground">{order.products?.title ?? '—'}</p>
          {order.products?.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{order.products.description}</p>
          )}
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">Status Pengiriman</h2>
            {delivery && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${deliveryStatusColors[delivery.status] ?? ''}`}>
                {delivery.status}
              </span>
            )}
          </div>
          {delivery ? (
            <div className="space-y-2 text-sm">
              <Row label="Percobaan" value={delivery.attempts.toString()} />
              {delivery.sent_at && <Row label="Terkirim" value={formatDate(delivery.sent_at)} />}
              {delivery.resend_email_id && <Row label="Email ID" value={delivery.resend_email_id} mono />}
              {delivery.last_error && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg text-xs text-red-700">
                  <p className="font-medium mb-1">Error terakhir:</p>
                  <p className="font-mono">{delivery.last_error}</p>
                </div>
              )}
              {(delivery.status === 'failed' || delivery.status === 'retry') && (
                <RetryDeliveryButton deliveryId={delivery.id} />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {order.payment_status === 'paid' ? 'Menunggu proses pengiriman...' : 'Pengiriman akan dimulai setelah pembayaran dikonfirmasi.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate ${bold ? 'font-semibold text-foreground' : ''} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
