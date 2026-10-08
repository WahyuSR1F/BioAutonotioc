import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { execute, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, description, price, cover_url } = await req.json()

    const res = await execute(
      `UPDATE products SET title = ?, description = ?, price = ?, cover_url = ?, updated_at = ?
       WHERE id = ? AND creator_id = ?`,
      [title, description || null, Number(price), cover_url || null, nowIso(), params.id, user.id]
    )

    if (res.rowsAffected === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update product error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
