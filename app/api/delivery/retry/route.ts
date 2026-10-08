import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { execute, queryOne, num, str, nowIso } from '@/lib/turso/client';
import { getUserFromStore } from '@/lib/auth/me';
import { deliverOrder } from '@/lib/deliver';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies());
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deliveryId } = await req.json();
  if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 });

  const delivery = await queryOne<{
    id: string;
    attempts: unknown;
    order_id: string;
    creator_id: string;
  }>(
    `SELECT d.id, d.attempts, d.order_id, o.creator_id
     FROM deliveries d
     INNER JOIN orders o ON o.id = d.order_id
     WHERE d.id = ?`,
    [deliveryId]
  );

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

  if (str(delivery.creator_id) !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (num(delivery.attempts) >= 5) {
    return NextResponse.json({ error: 'Maksimal 5 percobaan sudah tercapai' }, { status: 400 });
  }

  await execute(`UPDATE deliveries SET status = 'pending', updated_at = ? WHERE id = ?`, [
    nowIso(),
    str(delivery.id),
  ]);

  await deliverOrder(str(delivery.order_id));

  return NextResponse.json({ ok: true });
}
