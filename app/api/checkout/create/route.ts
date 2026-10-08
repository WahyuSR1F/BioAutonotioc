import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, num, str, strOrNull, nowIso } from '@/lib/turso/client';
import { MidtransService } from '@/lib/midtrans/service';
import { randomUUID, randomBytes } from 'crypto';

export const runtime = 'nodejs';

function generatePaymentRef(): string {
  return `BA-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(req: NextRequest) {
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

    const productRow = await queryOne(
      'SELECT id, title, price, currency, description, creator_id, is_active FROM products WHERE id = ? AND is_active = 1',
      [productId]
    );

    if (!productRow) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const paymentRef = generatePaymentRef();
    const orderId = randomUUID();

    await execute(
      `INSERT INTO orders
         (id, product_id, creator_id, payment_link_id, buyer_email, buyer_name,
          amount, currency, payment_provider, payment_ref, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        orderId,
        productId,
        str(productRow.creator_id),
        paymentLinkId || null,
        String(buyerEmail),
        buyerName || null,
        num(productRow.price),
        str(productRow.currency),
        paymentProvider,
        paymentRef,
        nowIso(),
        nowIso(),
      ]
    );

    if (paymentProvider === 'midtrans') {
      const paymentResponse = await MidtransService.createSnapTransaction({
        orderId: paymentRef,
        grossAmount: num(productRow.price),
        customerName: buyerName || 'ANONYMOUS',
        customerEmail: buyerEmail,
        productName: str(productRow.title),
        productDescription: strOrNull(productRow.description) || '',
        productPrice: num(productRow.price),
      });

      if (paymentResponse.status === 'error') {
        console.error('Midtrans payment creation error:', paymentResponse.message);
        return NextResponse.json({
          error: 'Gagal membuat transaksi pembayaran',
          details: paymentResponse.message
        }, { status: 500 });
      }

      return NextResponse.json({
        orderId,
        paymentRef,
        paymentUrl: paymentResponse.redirect_url,
        redirect: true,
      });
    }

    return NextResponse.json({
      orderId,
      paymentRef,
      message: `Pesanan berhasil dibuat untuk ${paymentProvider}. URL pembayaran akan dikirim ke email.`,
    });
  } catch (err: any) {
    console.error('Checkout create error', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
