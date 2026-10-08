import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { execute, queryAll, bool, str, strOrNull, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'
import { randomBytes, randomUUID } from 'crypto'

export const runtime = 'nodejs'

function mapRow(r: Record<string, unknown>) {
  let firstPayload: unknown = null
  try {
    const raw = strOrNull(r.first_payload)
    firstPayload = raw ? JSON.parse(raw) : null
  } catch {
    firstPayload = null
  }
  return {
    id: str(r.id),
    creator_id: str(r.creator_id),
    platform: str(r.platform),
    webhook_token: str(r.webhook_token),
    platform_username: strOrNull(r.platform_username),
    is_connected: bool(r.is_connected),
    first_payload: firstPayload,
    connected_at: strOrNull(r.connected_at),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const platform = req.nextUrl.searchParams.get('platform')

  try {
    const rows = platform
      ? await queryAll(
          'SELECT * FROM webhook_integrations WHERE creator_id = ? AND platform = ?',
          [user.id, platform]
        )
      : await queryAll('SELECT * FROM webhook_integrations WHERE creator_id = ?', [user.id])

    return NextResponse.json({ integrations: rows.map(mapRow) })
  } catch (err) {
    console.error('List integrations error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { platform } = await req.json()
    if (!platform) {
      return NextResponse.json({ error: 'platform wajib diisi' }, { status: 400 })
    }

    const token = randomBytes(24).toString('hex')

    await execute(
      `UPDATE webhook_integrations
       SET webhook_token = ?, is_connected = 0, first_payload = NULL, connected_at = NULL,
           platform_username = NULL, updated_at = ?
       WHERE creator_id = ? AND platform = ?`,
      [token, nowIso(), user.id, platform]
    )

    return NextResponse.json({ ok: true, token })
  } catch (err) {
    console.error('Reset integration error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
