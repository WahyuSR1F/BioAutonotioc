import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deliveryId } = await req.json();
  if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 });

  const { data: delivery, error } = await serviceSupabase
    .from('deliveries')
    .select('id, attempts, order_id, orders!inner(creator_id)')
    .eq('id', deliveryId)
    .maybeSingle();

  if (error || !delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

  const order = delivery.orders as any;
  if (order.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (delivery.attempts >= 5) {
    return NextResponse.json({ error: 'Maksimal 5 percobaan sudah tercapai' }, { status: 400 });
  }

  await serviceSupabase
    .from('deliveries')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', deliveryId);

  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deliver-product`;
  fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ orderId: delivery.order_id }),
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
