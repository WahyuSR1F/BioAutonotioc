import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlatform } from '@/lib/platforms';

export const runtime = 'nodejs';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get('platform');
    const token = req.nextUrl.searchParams.get('token');

    if (!platform || !token) {
      return NextResponse.json({ error: 'Missing platform or token' }, { status: 400 });
    }

    if (!getPlatform(platform)) {
      return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
    }

    const payload = await req.json();
    const supabase = getSupabase();

    const { data: integration, error: findError } = await supabase
      .from('webhook_integrations')
      .select('id, creator_id, is_connected')
      .eq('webhook_token', token)
      .eq('platform', platform)
      .maybeSingle();

    if (findError || !integration) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      first_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (!integration.is_connected) {
      updateData.is_connected = true;
      updateData.connected_at = new Date().toISOString();
      updateData.platform_username = payload.username || payload.buyer_name || null;
    }

    await supabase
      .from('webhook_integrations')
      .update(updateData)
      .eq('id', integration.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Integration webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
