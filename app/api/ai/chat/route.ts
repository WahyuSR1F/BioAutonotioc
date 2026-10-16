import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getUserFromStore } from '@/lib/auth/me'
import { execute, queryAll, nowIso } from '@/lib/turso/client'
import {
  chatCompletion,
  ensureDefaultAgent,
  isAiConfigured,
  resolveActiveAgent,
  MAX_HISTORY,
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
} from '@/lib/ai'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const postSchema = z.object({
  message: z.string().trim().min(1, 'Pesan kosong').max(MAX_MESSAGE_LENGTH),
  agentId: z.string().trim().min(1).nullable().optional(),
})

/** Ambil riwayat chat terakhir (untuk render awal halaman chat). */
export async function GET() {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await queryAll(
      `SELECT id, agent_id, role, content, created_at
       FROM ai_chat_messages
       WHERE creator_id = ?
       ORDER BY created_at DESC, rowid DESC
       LIMIT 100`,
      [user.id]
    )
    const messages = rows
      .map((r) => ({
        id: String(r.id),
        agentId: r.agent_id ? String(r.agent_id) : null,
        role: String(r.role),
        content: String(r.content),
        createdAt: String(r.created_at),
      }))
      .reverse()

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('List chat messages error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY belum di-set di environment server' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Data tidak valid' },
      { status: 400 }
    )
  }

  try {
    await ensureDefaultAgent(user.id)

    // Routing: agent eksplisit, atau agent default/aktif pertama (mode Auto)
    const agent = await resolveActiveAgent(user.id, parsed.data.agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Tidak ada agent aktif — aktifkan salah satu di menu Agen AI' },
        { status: 400 }
      )
    }

    // Konteks: riwayat terakhir (user + assistant)
    const historyRows = await queryAll(
      `SELECT role, content FROM ai_chat_messages
       WHERE creator_id = ?
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`,
      [user.id, MAX_HISTORY]
    )
    const context: ChatMessage[] = historyRows
      .reverse()
      .map((r) => ({ role: String(r.role) as 'user' | 'assistant', content: String(r.content) }))

    context.push({ role: 'user', content: parsed.data.message })

    const reply = await chatCompletion({
      model: agent.model,
      temperature: agent.temperature,
      messages: [{ role: 'system', content: agent.systemPrompt }, ...context],
    })

    const now = nowIso()
    await execute(
      `INSERT INTO ai_chat_messages (id, creator_id, agent_id, role, content, created_at) VALUES (?, ?, ?, 'user', ?, ?)`,
      [randomUUID(), user.id, agent.id, parsed.data.message, now]
    )
    await execute(
      `INSERT INTO ai_chat_messages (id, creator_id, agent_id, role, content, created_at) VALUES (?, ?, ?, 'assistant', ?, ?)`,
      [randomUUID(), user.id, agent.id, reply, nowIso()]
    )

    return NextResponse.json({ reply, agent: { id: agent.id, name: agent.name } })
  } catch (err) {
    console.error('AI chat error', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Hapus riwayat chat. */
export async function DELETE() {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await execute('DELETE FROM ai_chat_messages WHERE creator_id = ?', [user.id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Clear chat error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
