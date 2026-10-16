import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getUserFromStore } from '@/lib/auth/me'
import { execute, nowIso, queryOne } from '@/lib/turso/client'
import { AI_MODELS, getAgent } from '@/lib/ai'

export const runtime = 'nodejs'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  systemPrompt: z.string().trim().min(1).max(4000).optional(),
  model: z.enum(AI_MODELS).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Data tidak valid' },
      { status: 400 }
    )
  }

  try {
    const existing = await getAgent(user.id, params.id)
    if (!existing) return NextResponse.json({ error: 'Agent tidak ditemukan' }, { status: 404 })

    const d = parsed.data
    const nextActive = d.isActive ?? existing.isActive
    const nextDefault = d.isDefault ?? existing.isDefault

    // Tidak boleh menonaktifkan semua agent sekaligus
    if (!nextActive && existing.isActive) {
      const others = await queryOne(
        'SELECT id FROM ai_agents WHERE creator_id = ? AND id != ? AND is_active = 1 LIMIT 1',
        [user.id, params.id]
      )
      if (!others) {
        return NextResponse.json(
          { error: 'Minimal satu agent harus tetap aktif' },
          { status: 400 }
        )
      }
    }

    // Agent nonaktif tidak bisa menjadi default
    const finalDefault = nextActive ? (nextDefault ? 1 : 0) : 0

    if (finalDefault === 1) {
      await execute(
        'UPDATE ai_agents SET is_default = 0 WHERE creator_id = ? AND id != ?',
        [user.id, params.id]
      )
    }

    await execute(
      `UPDATE ai_agents
       SET name = ?, description = ?, system_prompt = ?, model = ?, temperature = ?,
           is_active = ?, is_default = ?, updated_at = ?
       WHERE id = ? AND creator_id = ?`,
      [
        d.name ?? existing.name,
        d.description !== undefined ? d.description : existing.description,
        d.systemPrompt ?? existing.systemPrompt,
        d.model ?? existing.model,
        d.temperature ?? existing.temperature,
        nextActive ? 1 : 0,
        finalDefault,
        nowIso(),
        params.id,
        user.id,
      ]
    )

    // Bila default dimatikan, jadikan agent aktif pertama lain sebagai default
    if (finalDefault === 0 && existing.isDefault) {
      await execute(
        `UPDATE ai_agents SET is_default = 1
         WHERE creator_id = ? AND is_active = 1 AND id = (
           SELECT id FROM ai_agents WHERE creator_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1
         )`,
        [user.id, user.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update AI agent error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await getAgent(user.id, params.id)
    if (!existing) return NextResponse.json({ error: 'Agent tidak ditemukan' }, { status: 404 })

    const others = await queryOne(
      'SELECT id FROM ai_agents WHERE creator_id = ? AND id != ? LIMIT 1',
      [user.id, params.id]
    )
    if (!others) {
      return NextResponse.json(
        { error: 'Tidak bisa menghapus agent terakhir' },
        { status: 400 }
      )
    }

    await execute('DELETE FROM ai_agents WHERE id = ? AND creator_id = ?', [params.id, user.id])

    // Kalau yang dihapus adalah default, pindahkan default ke agent aktif pertama
    if (existing.isDefault) {
      await execute(
        `UPDATE ai_agents SET is_default = 1
         WHERE creator_id = ? AND is_active = 1 AND id = (
           SELECT id FROM ai_agents WHERE creator_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1
         )`,
        [user.id, user.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete AI agent error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
