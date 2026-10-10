import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getUserFromStore } from '@/lib/auth/me';
import { queryOne, execute, num, str, nowIso } from '@/lib/turso/client';
import { markOrderPaid, syncMidtransOrder } from '@/lib/payments';
import { deliverOrder } from '@/lib/deliver';

export const runtime = 'nodejs';

const schema = z.object({
  action: z.enum(['sync', 'mark_paid', 'resend']),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies());
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  }

  const order = await queryOne<{
    id: string;
    creator_id: string;
    payment_ref: string | null;
    amount: unknown;
    payment_provider: string;
    payment_status: string;
  }>(
    `SELECT id, creator_id, payment_ref, amount, payment_provider, payment_status
     FROM orders WHERE id = ?`,
    [params.id]
  );

  if (!order) return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
  if (str(order.creator_id) !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orderId = str(order.id);
  const currentStatus = str(order.payment_status);
  const action = parsed.data.action;

  if (action === 'sync') {
    const result = await syncMidtransOrder({
      id: orderId,
      creatorId: str(order.creator_id),
      paymentRef: str(order.payment_ref),
      amount: num(order.amount),
      provider: str(order.payment_provider),
      currentStatus,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === 'mark_paid') {
    if (currentStatus === 'paid') {
      return NextResponse.json({ ok: true, message: 'Order sudah lunas', changed: false });
    }
    await markOrderPaid(orderId);
    return NextResponse.json({ ok: true, message: 'Order ditandai lunas', changed: true });
  }

  // action === 'resend'
  if (currentStatus !== 'paid') {
    return NextResponse.json(
      { error: 'Order belum lunas — file hanya bisa dikirim untuk order berstatus lunas' },
      { status: 400 }
    );
  }

  const delivery = await queryOne<{ id: string; attempts: unknown }>(
    'SELECT id, attempts FROM deliveries WHERE order_id = ?',
    [orderId]
  );

  if (delivery && num(delivery.attempts) >= 5) {
    return NextResponse.json({ error: 'Maksimal 5 percobaan sudah tercapai' }, { status: 400 });
  }

  if (delivery) {
    await execute(`UPDATE deliveries SET status = 'pending', updated_at = ? WHERE id = ?`, [
      nowIso(),
      str(delivery.id),
    ]);
  } else {
    await execute(
      `INSERT INTO deliveries (id, order_id, status, updated_at)
       VALUES (?, ?, 'pending', ?)
       ON CONFLICT(order_id) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at`,
      [crypto.randomUUID(), orderId, nowIso()]
    );
  }

  const result = await deliverOrder(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Gagal mengirim file' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'File dikirim ulang ke email pembeli' });
}
