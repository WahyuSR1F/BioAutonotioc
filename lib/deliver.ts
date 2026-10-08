import { execute, queryAll, queryOne, str, strOrNull, nowIso } from '@/lib/turso/client'
import { randomBytes } from 'crypto'

type DeliverResult = { ok: boolean; emailId?: string; error?: string }

async function updateDelivery(orderId: string, status: string, errorMsg: string) {
  const delivery = await queryOne<{ id: string; attempts: unknown }>(
    'SELECT id, attempts FROM deliveries WHERE order_id = ?',
    [orderId]
  )
  if (delivery) {
    await execute(
      `UPDATE deliveries SET status = ?, last_error = ?, attempts = ?, updated_at = ? WHERE id = ?`,
      [status, errorMsg, Number(delivery.attempts || 0) + 1, nowIso(), str(delivery.id)]
    )
  }
}

export async function deliverOrder(orderId: string): Promise<DeliverResult> {
  const orderRow = await queryOne(
    `SELECT o.id, o.buyer_email, o.buyer_name,
            p.id AS product_id, p.title AS product_title, p.description AS product_description
     FROM orders o
     INNER JOIN products p ON p.id = o.product_id
     WHERE o.id = ? AND o.payment_status = 'paid'`,
    [orderId]
  )

  if (!orderRow) {
    await updateDelivery(orderId, 'failed', 'Order not found or not paid')
    return { ok: false, error: 'Order not found or not paid' }
  }

  const fileRows = await queryAll(
    'SELECT id, file_name FROM product_files WHERE product_id = ?',
    [str(orderRow.product_id)]
  )

  if (fileRows.length === 0) {
    await updateDelivery(orderId, 'failed', 'No product files found')
    return { ok: false, error: 'No product files found' }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    await updateDelivery(orderId, 'failed', 'RESEND_API_KEY not configured')
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  // Token download 24 jam (pengganti signed URL Supabase Storage)
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    await execute('INSERT INTO download_tokens (token, order_id, expires_at) VALUES (?, ?, ?)', [
      token,
      orderId,
      expiresAt,
    ])
  } catch (err) {
    console.error('Token creation error', err)
    await updateDelivery(orderId, 'failed', 'Failed to create download token')
    return { ok: false, error: 'Failed to create download token' }
  }

  const buyerEmail = str(orderRow.buyer_email)
  const buyerName = strOrNull(orderRow.buyer_name)
  const productTitle = str(orderRow.product_title)

  const fileLinksHtml = fileRows
    .map(
      (f) =>
        `<li><a href="${appUrl}/api/download/${token}/${str(f.id)}" style="color:#2563eb">${str(f.file_name)}</a> <span style="color:#6b7280;font-size:12px">(berlaku 24 jam)</span></li>`
    )
    .join('')

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:32px 16px">
  <div style="background:#2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">Pembelian Anda Berhasil!</h1>
  </div>
  <p>Hai <strong>${buyerName || buyerEmail}</strong>,</p>
  <p>Terima kasih telah membeli <strong>${productTitle}</strong>. Berikut link download file Anda:</p>
  <ul style="padding-left:20px;line-height:2">
    ${fileLinksHtml}
  </ul>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:24px 0">
    <p style="margin:0;font-size:13px;color:#6b7280">
      Link download berlaku selama 24 jam. Segera unduh dan simpan file Anda.
    </p>
  </div>
  <p style="font-size:13px;color:#9ca3af">
    Email ini dikirim otomatis oleh BioAutomate. Jangan balas email ini.
  </p>
</body>
</html>`

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'BioAutomate <noreply@bioautomate.id>',
        to: [buyerEmail],
        subject: `File Download: ${productTitle}`,
        html: emailHtml,
      }),
    })

    if (!emailRes.ok) {
      const emailError = await emailRes.text()
      await updateDelivery(orderId, 'failed', `Resend error: ${emailError}`)
      return { ok: false, error: 'Email send failed' }
    }

    const emailData = (await emailRes.json()) as { id: string }

    const delivery = await queryOne<{ id: string; attempts: unknown }>(
      'SELECT id, attempts FROM deliveries WHERE order_id = ?',
      [orderId]
    )

    if (delivery) {
      await execute(
        `UPDATE deliveries
         SET status = 'sent', resend_email_id = ?, sent_at = ?, attempts = ?, last_error = NULL, updated_at = ?
         WHERE id = ?`,
        [
          emailData.id,
          nowIso(),
          Number(delivery.attempts || 0) + 1,
          nowIso(),
          str(delivery.id),
        ]
      )
    }

    return { ok: true, emailId: emailData.id }
  } catch (err) {
    console.error('deliverOrder error', err)
    await updateDelivery(orderId, 'failed', err instanceof Error ? err.message : 'Internal error')
    return { ok: false, error: 'Internal error' }
  }
}
