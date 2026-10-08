import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne, bool, str, strOrNull, nowIso } from '@/lib/turso/client';
import { getPlatform } from '@/lib/platforms';

export const runtime = 'nodejs';

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

    const integration = await queryOne<{ id: string; is_connected: unknown }>(
      'SELECT id, creator_id, is_connected FROM webhook_integrations WHERE webhook_token = ? AND platform = ?',
      [token, platform]
    );

    if (!integration) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const connected = bool(integration.is_connected);
    const username = payload.username || payload.buyer_name || null;

    if (!connected) {
      await execute(
        `UPDATE webhook_integrations
         SET first_payload = ?, updated_at = ?, is_connected = 1, connected_at = ?, platform_username = ?
         WHERE id = ?`,
        [JSON.stringify(payload), nowIso(), nowIso(), username, str(integration.id)]
      );
    } else {
      await execute(
        `UPDATE webhook_integrations SET first_payload = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(payload), nowIso(), str(integration.id)]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Integration webhook error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
