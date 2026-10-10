import { notFound } from 'next/navigation';
import { queryOne, bool, num, str, strOrNull } from '@/lib/turso/client';
import { getPaymentSettings, computeTotals, getEnabledProviders } from '@/lib/payments';
import CheckoutForm from '@/components/checkout/checkout-form';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { Package } from 'lucide-react';
import Image from 'next/image';

interface Props {
  params: { slug: string };
}

export default async function BuyPage({ params }: Props) {
  const link = await queryOne(
    'SELECT id, product_id FROM payment_links WHERE slug = ? AND is_active = 1',
    [params.slug]
  );
  if (!link) notFound();

  const productRow = await queryOne(
    'SELECT id, creator_id, title, description, price, currency, cover_url, is_active FROM products WHERE id = ? AND is_active = 1',
    [str(link.product_id)]
  );
  if (!productRow) notFound();

  // Setelan pembayaran creator: provider aktif + komponen admin fee
  const settings = await getPaymentSettings(str(productRow.creator_id));
  const totals = computeTotals(num(productRow.price), settings);
  const providers = getEnabledProviders(settings);

  // Kunci publik Snap.js (untuk popup Midtrans) — opsional;
  // bila kosong, frontend otomatis redirect ke redirect_url.
  const midtransClientKey =
    process.env.MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '';
  const midtransFlag = (process.env.MIDTRANS_IS_PRODUCTION || '').trim().toLowerCase();
  const midtransIsProduction =
    midtransFlag === 'true' ||
    (midtransFlag !== 'false' && process.env.MIDTRANS_ENVIRONMENT === 'PRODUCTION');

  const product: Product = {
    id: str(productRow.id),
    creator_id: '',
    title: str(productRow.title),
    description: strOrNull(productRow.description),
    price: num(productRow.price),
    currency: str(productRow.currency),
    cover_url: strOrNull(productRow.cover_url),
    is_active: bool(productRow.is_active),
    created_at: '',
    updated_at: '',
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Product Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {product.cover_url ? (
              <div className="relative aspect-video">
                <Image
                  src={product.cover_url}
                  alt={product.title}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-video bg-secondary/50 flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/40" />
              </div>
            )}
            <div className="p-6">
              <h1 className="text-xl font-bold text-foreground">{product.title}</h1>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{product.description}</p>
              )}
              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <span className="text-3xl font-bold text-primary">
                  {formatCurrency(totals.price, product.currency)}
                </span>
                {totals.fee > 0 && (
                  <p className="text-xs text-muted-foreground">
                    + biaya admin {formatCurrency(totals.fee, product.currency)} → total{' '}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(totals.total, product.currency)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-accent rounded-xl p-4">
            <p className="text-xs text-accent-foreground font-medium">Pengiriman Otomatis</p>
            <p className="text-xs text-muted-foreground mt-1">
              File digital akan dikirim ke email Anda dalam beberapa menit setelah pembayaran dikonfirmasi.
            </p>
          </div>
        </div>

        {/* Checkout Form */}
        <div>
          <CheckoutForm
            productId={product.id}
            paymentLinkId={str(link.id)}
            productTitle={product.title}
            price={totals.price}
            adminFee={totals.fee}
            total={totals.total}
            currency={product.currency}
            providers={providers}
            midtransClientKey={midtransClientKey}
            midtransIsProduction={midtransIsProduction}
          />
        </div>
      </div>
    </div>
  );
}
