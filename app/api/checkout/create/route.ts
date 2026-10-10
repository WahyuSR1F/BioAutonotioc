import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, num, str, strOrNull, nowIso } from '@/lib/turso/client';
import { MidtransService } from '@/lib/midtrans/service';
import { getMidtransMisconfiguration } from '@/lib/midtrans';
import { getPaymentSettings, computeTotals, getEnabledProviders } from '@/lib/payments';
import { randomUUID, randomBytes } from 'crypto';

export const runtime = 'nodejs';

function generatePaymentRef(): string {
  return `BA-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(req: NextRequest) {
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

    // Admin fee dihitung ulang di server — tidak pernah dipercaya dari client
    const settings = await getPaymentSettings(str(productRow.creator_id));
    const enabledProviders = getEnabledProviders(settings);
    if (!enabledProviders.includes(paymentProvider)) {
      return NextResponse.json(
        { error: 'Metode pembayaran tidak tersedia' },
        { status: 400 }
      );
    }

    if (paymentProvider === 'midtrans') {
      const misconfig = getMidtransMisconfiguration(settings.midtransMode);
      if (misconfig) {
        return NextResponse.json(
          { error: 'Pembayaran Midtrans belum siap', details: misconfig.message },
          { status: 503 }
        );
      }
    }

    const totals = computeTotals(num(productRow.price), settings);

    const paymentRef = generatePaymentRef();
    const orderId = randomUUID();

    await execute(
      `INSERT INTO orders
         (id, product_id, creator_id, payment_link_id, buyer_email, buyer_name,
          amount, admin_fee, currency, payment_provider, payment_ref, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        orderId,
        productId,
        str(productRow.creator_id),
        paymentLinkId || null,
        String(buyerEmail),
        buyerName || null,
        totals.total,
        totals.fee,
        str(productRow.currency),
        paymentProvider,
        paymentRef,
        nowIso(),
        nowIso(),
      ]
    );

    if (paymentProvider === 'midtrans') {
      const itemDetails: Array<{
        id: string;
        price: number;
        quantity: number;
        name: string;
        brand?: string;
      }> = [
        {
          id: `${orderId}-item`,
          price: totals.price,
          quantity: 1,
          name: str(productRow.title),
          brand: 'BioAutomate',
        },
      ];
      if (totals.fee > 0) {
        itemDetails.push({
          id: `${orderId}-fee`,
          price: totals.fee,
          quantity: 1,
          name: 'Biaya admin',
        });
      }

      const paymentResponse = await MidtransService.createSnapTransaction(
        {
          orderId: paymentRef,
          grossAmount: totals.total,
          customerName: buyerName || 'ANONYMOUS',
          customerEmail: buyerEmail,
          productName: str(productRow.title),
          productDescription: strOrNull(productRow.description) || '',
          productPrice: totals.price,
          adminFee: totals.fee,
          itemDetails,
        },
        settings.midtransMode
      );

      if (paymentResponse.status === 'error') {
        console.error('Midtrans payment creation error:', paymentResponse.message);
        const raw = String(paymentResponse.message || '');
        const details = /401|unauthorized/i.test(raw)
          ? `Midtrans menolak kredensial (401 Unauthorized) pada mode ${settings.midtransMode.toUpperCase()}. Periksa Server Key di dashboard Midtrans → Settings → Access Keys, dan samakan key dengan mode (Sandbox/Production) di setelan pembayaran.`
          : raw;
        return NextResponse.json({
          error: 'Gagal membuat transaksi pembayaran',
          details
        }, { status: 500 });
      }

      // token untuk Snap JS popup, redirect_url untuk buka langsung
      return NextResponse.json({
        orderId,
        paymentRef,
        token: paymentResponse.token ?? null,
        redirect_url: paymentResponse.redirect_url ?? null,
        paymentUrl: paymentResponse.redirect_url, // alias kompatibilitas frontend lama
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
