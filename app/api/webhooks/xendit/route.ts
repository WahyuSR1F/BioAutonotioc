import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabase
        .from('orders')
        .update({ payment_status, raw_webhook: body, updated_at: new Date().toISOString() })
        .eq('payment_ref', external_id || xenditInvoiceId);

      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        raw_webhook: body,
        updated_at: new Date().toISOString(),
      })
      .eq('payment_ref', external_id || xenditInvoiceId)
      .select('id')
      .maybeSingle();

    if (orderError || !order) {
      console.error('Xendit order update failed', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await supabase.from('deliveries').upsert(
      { order_id: order.id, status: 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'order_id' }
    );

    const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deliver-product`;
    fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Xendit webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
