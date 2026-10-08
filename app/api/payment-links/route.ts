import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, queryOne, str, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { productId, slug } = await req.json()

    if (!productId || !slug) {
      return NextResponse.json({ error: 'productId dan slug wajib diisi' }, { status: 400 })
    }

    const product = await queryOne<{ id: string }>(
      'SELECT id FROM products WHERE id = ? AND creator_id = ?',
      [productId, user.id]
    )
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

    const id = randomUUID()
    await db().execute({
      sql: 'INSERT INTO payment_links (id, product_id, creator_id, slug, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, productId, user.id, slug, nowIso()],
    })

    return NextResponse.json({ id, slug })
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return NextResponse.json({ error: 'Slug sudah dipakai' }, { status: 400 })
    }
    console.error('Create payment link error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
