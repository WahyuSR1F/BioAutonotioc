import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, str, nowIso } from '@/lib/turso/client';
import { deliverOrder } from '@/lib/deliver';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const callbackToken = req.headers.get('x-callback-token');
    if (callbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
      return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
    }

    const body = await req.json();
    const { id: xenditInvoiceId, status, paid_amount, external_id } = body;

    if (status !== 'PAID') {
      const statusMap: Record<string, string> = {
        EXPIRED: 'expired',
        FAILED: 'failed',
      };
      const payment_status = statusMap[status] ?? 'pending';
      await execute(
        `UPDATE orders SET payment_status = ?, raw_webhook = ?, updated_at = ? WHERE payment_ref = ?`,
        [payment_status, JSON.stringify(body), nowIso(), external_id || xenditInvoiceId]
      );

      return NextResponse.json({ ok: true });
    }

    const order = await queryOne<{ id: string }>(
      `UPDATE orders
       SET payment_status = 'paid', paid_at = ?, raw_webhook = ?, updated_at = ?
       WHERE payment_ref = ?
       RETURNING id`,
      [nowIso(), JSON.stringify(body), nowIso(), external_id || xenditInvoiceId]
    );

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderId = str(order.id);
    await execute(
      `INSERT INTO deliveries (id, order_id, status, updated_at)
       VALUES (?, ?, 'pending', ?)
       ON CONFLICT(order_id) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at`,
      [randomUUID(), orderId, nowIso()]
    );

    await deliverOrder(orderId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Xendit webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
