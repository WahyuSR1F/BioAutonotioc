import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutForm from '@/components/checkout/checkout-form';
import { formatCurrency } from '@/lib/utils';
import type { PaymentLink, Product } from '@/lib/supabase/types';
import { Package } from 'lucide-react';
import Image from 'next/image';

interface Props {
  params: { slug: string };
}

export default async function BuyPage({ params }: Props) {
  const supabase = createClient();

  const { data } = await supabase
    .from('payment_links')
    .select('id, product_id')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .maybeSingle();

  const link = data as PaymentLink | null;
  if (!link) notFound();

  const { data: productData } = await supabase
    .from('products')
    .select('id, title, description, price, currency, cover_url, is_active')
    .eq('id', link.product_id)
    .eq('is_active', true)
    .maybeSingle();

  const product = productData as Product | null;
  if (!product) notFound();

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
              <div className="mt-4 pt-4 border-t border-border">
                <span className="text-3xl font-bold text-primary">
                  {formatCurrency(product.price, product.currency)}
                </span>
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
            paymentLinkId={link.id}
            productTitle={product.title}
            price={product.price}
            currency={product.currency}
          />
        </div>
      </div>
    </div>
  );
}
