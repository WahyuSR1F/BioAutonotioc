import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, queryOne, str, nowIso } from '@/lib/turso/client'
import { getUserFromStore } from '@/lib/auth/me'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

// Vercel membatasi body request ~4.5MB — file dibatasi 4MB agar aman
const MAX_FILE_SIZE = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file')
    const type = form.get('type') // 'cover' | 'file'
    const productId = form.get('productId')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 4MB (batas Vercel serverless)' },
        { status: 413 }
      )
    }

    const buf = new Uint8Array(await file.arrayBuffer())

    if (type === 'cover') {
      const assetId = randomUUID()
      await db().execute({
        sql: 'INSERT INTO assets (id, owner_id, file_name, mime_type, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [assetId, user.id, file.name || 'cover', file.type || 'image/jpeg', file.size, buf, nowIso()],
      })
      return NextResponse.json({ url: `/api/assets/${assetId}` })
    }

    // type === 'file': lampirkan ke produk
    if (!productId) {
      return NextResponse.json({ error: 'productId wajib diisi' }, { status: 400 })
    }

    const product = await queryOne<{ id: string }>(
      'SELECT id FROM products WHERE id = ? AND creator_id = ?',
      [String(productId), user.id]
    )
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

    const fileId = randomUUID()
    await db().execute({
      sql: 'INSERT INTO product_files (id, product_id, file_name, file_size, mime_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [fileId, str(product.id), file.name, file.size, file.type || null, buf, nowIso()],
    })

    return NextResponse.json({ id: fileId, file_name: file.name, file_size: file.size })
  } catch (err) {
    console.error('Upload error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
