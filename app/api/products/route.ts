import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, str, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'
import { randomUUID } from 'crypto'
import { slugify } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, description, price, cover_url } = await req.json()

    if (!title || price === undefined) {
      return NextResponse.json({ error: 'Judul dan harga wajib diisi' }, { status: 400 })
    }

    const productId = randomUUID()
    const now = nowIso()
    const slug = `${slugify(title)}-${Date.now().toString(36)}`
    const linkId = randomUUID()

    await db().batch(
      [
        {
          sql: `INSERT INTO products (id, creator_id, title, description, price, cover_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [productId, user.id, title, description || null, Number(price), cover_url || null, now, now],
        },
        {
          sql: `INSERT INTO payment_links (id, product_id, creator_id, slug, created_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [linkId, productId, user.id, slug, now],
        },
      ],
      'write'
    )

    return NextResponse.json({ id: productId, slug })
  } catch (err) {
    console.error('Create product error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
