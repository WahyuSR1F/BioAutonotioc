import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MidtransService } from '@/lib/midtrans/service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return NextResponse.json({ error: 'Midtrans tidak dikonfigurasi' }, { status: 500 });
  }
  
  try {
    const { productId, paymentLinkId, buyerName, buyerEmail, paymentProvider } = await req.json();

    if (!productId || !buyerEmail || !paymentProvider) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    if (paymentProvider !== 'midtrans' && paymentProvider !== 'xendit') {
      return NextResponse.json({ error: 'Payment provider tidak valid' }, { status: 400 });
    }

    const productResult = await supabase
      .from('products')
      .select('id, title, price, currency, description, creator_id, is_active')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (productResult.error || !productResult.data) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const product = productResult.data;

    let orderResult = null as any;
    
    for (let i = 0; i < 2; i++) {
      try {
        orderResult = await supabase
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
            payment_ref: orderResult?.data?.payment_ref,
            payment_status: 'pending',
          })
          .select()
          .single();
        break;
      } catch (e: any) {
        if (i === 0) {
          const paymentRef = `BA-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          orderResult = await supabase
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
        }
      }
    }

    if (orderResult.error || !orderResult.data) {
      return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 });
    }

    const order = orderResult.data;

    if (paymentProvider === 'midtrans') {
      const paymentResponse = await MidtransService.createSnapTransaction({
        orderId: order.payment_ref,
        grossAmount: order.amount,
        customerName: buyerName || 'ANONYMOUS',
        customerEmail: buyerEmail,
        productName: product.title,
        productDescription: product.description || '',
        productPrice: order.amount,
      });

      if (paymentResponse.status === 'error') {
        console.error('Midtrans payment creation error:', paymentResponse.message);
        return NextResponse.json({ 
          error: 'Gagal membuat transaksi pembayaran', 
          details: paymentResponse.message 
        }, { status: 500 });
      }

      return NextResponse.json({
        orderId: order.id,
        paymentRef: order.payment_ref,
        paymentUrl: paymentResponse.redirect_url,
        redirect: true,
      });
    }

    const orderUpdateResult = await supabase
      .from('orders')
      .update({ payment_ref: order.payment_ref })
      .eq('id', order.id)
      .select()
      .single();

    if (orderUpdateResult.error || !orderUpdateResult.data) {
      return NextResponse.json({ error: 'Gagal memperbarui pesanan' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: orderUpdateResult.data.id,
      paymentRef: orderUpdateResult.data.payment_ref,
      message: `Pesanan berhasil dibuat untuk ${paymentProvider}. URL pembayaran akan dikirim ke email.`,
    });
  } catch (err: any) {
    console.error('Checkout create error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}