import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { execute } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { is_active } = await req.json()

    const res = await execute(
      'UPDATE payment_links SET is_active = ? WHERE id = ? AND creator_id = ?',
      [is_active ? 1 : 0, params.id, user.id]
    )

    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update payment link error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await execute(
      'DELETE FROM payment_links WHERE id = ? AND creator_id = ?',
      [params.id, user.id]
    )

    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete payment link error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
