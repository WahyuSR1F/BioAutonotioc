import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  incomingSignature: string
): boolean {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computed = crypto.createHash('sha512').update(raw).digest('hex');
  return computed === incomingSignature;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      order_id,
      transaction_status,
      fraud_status,
      gross_amount,
      status_code,
      signature_key,
    } = body;

    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    if (!verifyMidtransSignature(order_id, status_code, gross_amount, serverKey, signature_key)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const isPaid =
      (transaction_status === 'settlement' || transaction_status === 'capture') &&
      fraud_status !== 'deny';
    const isExpired = transaction_status === 'expire';
    const isFailed = transaction_status === 'deny' || transaction_status === 'cancel';

    let payment_status: string;
    if (isPaid) payment_status = 'paid';
    else if (isExpired) payment_status = 'expired';
    else if (isFailed) payment_status = 'failed';
    else payment_status = 'pending';

    const updatePayload: Record<string, unknown> = {
      payment_status,
      raw_webhook: body,
      updated_at: new Date().toISOString(),
    };
    if (isPaid) updatePayload.paid_at = new Date().toISOString();

    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('payment_ref', order_id)
      .select('id')
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order update failed', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (isPaid) {
      await supabase.from('deliveries').upsert(
        { order_id: order.id, status: 'pending', updated_at: new Date().toISOString() },
        { onConflict: 'order_id' }
      );

      // Trigger deliver-product edge function
      const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deliver-product`;
      fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Midtrans webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
