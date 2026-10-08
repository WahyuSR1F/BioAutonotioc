import { NextRequest, NextResponse } from 'next/server'
import { queryOne, str, strOrNull } from '@/lib/turso/client'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { token: string; fileId: string } }) {
  try {
    const tokenRow = await queryOne<{ order_id: string; expires_at: string }>(
      'SELECT order_id, expires_at FROM download_tokens WHERE token = ?',
      [params.token]
    )

    if (!tokenRow || str(tokenRow.expires_at) < new Date().toISOString()) {
      return NextResponse.json({ error: 'Link download tidak valid atau sudah kedaluwarsa' }, { status: 403 })
    }

    const file = await queryOne<{ file_name: unknown; mime_type: unknown; content: unknown }>(
      `SELECT pf.file_name, pf.mime_type, pf.content
       FROM product_files pf
       INNER JOIN orders o ON o.product_id = pf.product_id
       WHERE pf.id = ? AND o.id = ?`,
      [params.fileId, str(tokenRow.order_id)]
    )

    if (!file || !file.content) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    const content = file.content instanceof Uint8Array
      ? file.content
      : new Uint8Array(file.content as ArrayBuffer)

    const fileName = str(file.file_name)
    const encodedName = encodeURIComponent(fileName)

    return new NextResponse(Buffer.from(content), {
      headers: {
        'Content-Type': file.mime_type ? strOrNull(file.mime_type) || 'application/octet-stream' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Content-Length': String(content.byteLength),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Download error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
