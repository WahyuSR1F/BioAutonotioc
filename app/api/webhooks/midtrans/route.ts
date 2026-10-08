import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, str, nowIso } from '@/lib/turso/client';
import { deliverOrder } from '@/lib/deliver';
import { createHash, randomUUID } from 'crypto';

export const runtime = 'nodejs';

function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  incomingSignature: string
): boolean {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computed = createHash('sha512').update(raw).digest('hex');
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

    const paidAt = isPaid ? nowIso() : null;

    const order = await queryOne<{ id: string }>(
      `UPDATE orders
       SET payment_status = ?, raw_webhook = ?, updated_at = ?,
           paid_at = COALESCE(?, paid_at)
       WHERE payment_ref = ?
       RETURNING id`,
      [payment_status, JSON.stringify(body), nowIso(), paidAt, order_id]
    );

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (isPaid) {
      const orderId = str(order.id);
      await execute(
        `INSERT INTO deliveries (id, order_id, status, updated_at)
         VALUES (?, ?, 'pending', ?)
         ON CONFLICT(order_id) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at`,
        [randomUUID(), orderId, nowIso()]
      );

      await deliverOrder(orderId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Midtrans webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
