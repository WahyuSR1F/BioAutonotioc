import { NextRequest, NextResponse } from 'next/server'
import { queryOne, str } from '@/lib/turso/client'

export const runtime = 'nodejs'

// Cover produk bersifat publik (konsisten dengan perilaku getPublicUrl sebelumnya)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const asset = await queryOne<{ mime_type: unknown; content: unknown }>(
      'SELECT mime_type, content FROM assets WHERE id = ?',
      [params.id]
    )

    if (!asset || !asset.content) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const content = asset.content instanceof Uint8Array
      ? asset.content
      : new Uint8Array(asset.content as ArrayBuffer)

    return new NextResponse(Buffer.from(content), {
      headers: {
        'Content-Type': asset.mime_type ? str(asset.mime_type) : 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    console.error('Asset error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
