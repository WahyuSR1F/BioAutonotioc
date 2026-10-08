import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { execute, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { display_name, bio, store_slug } = await req.json()

    const res = await execute(
      'UPDATE profiles SET display_name = ?, bio = ?, store_slug = ?, updated_at = ? WHERE id = ?',
      [display_name || null, bio || null, store_slug || null, nowIso(), user.id]
    )

    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return NextResponse.json({ error: 'Store slug sudah dipakai' }, { status: 400 })
    }
    console.error('Update profile error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
