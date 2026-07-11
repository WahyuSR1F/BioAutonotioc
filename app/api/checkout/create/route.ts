import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { productId, paymentLinkId, buyerName, buyerEmail, paymentProvider } = await req.json();

    if (!productId || !buyerEmail || !paymentProvider) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price, currency, creator_id, is_active')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const paymentRef = `BA-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        product_id: productId,
        creator_id: product.creator_id,
        payment_link_id: paymentLinkId || null,
        buyer_email: buyerEmail,
        buyer_name: buyerName || null,
        amount: product.price,
        currency: product.currency,
        payment_provider: paymentProvider,
        payment_ref: paymentRef,
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 });
    }

    // In production: create payment intent via Midtrans/Xendit SDK and return paymentUrl
    // For now: return the order with a placeholder payment URL
    return NextResponse.json({
      orderId: order.id,
      paymentRef: order.payment_ref,
      // paymentUrl: 'https://...' (returned from payment gateway SDK)
      message: 'Pesanan berhasil dibuat. Integrasi payment gateway diperlukan untuk URL pembayaran.',
    });
  } catch (err) {
    console.error('Checkout create error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
