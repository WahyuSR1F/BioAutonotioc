import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getUserFromStore } from '@/lib/auth/me'
import { execute, nowIso, queryOne } from '@/lib/turso/client'
import { AI_MODELS, ensureDefaultAgent, isAiConfigured, listAgents } from '@/lib/ai'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama agent wajib diisi').max(80),
  description: z.string().trim().max(300).nullable().optional(),
  systemPrompt: z.string().trim().min(1, 'System prompt wajib diisi').max(4000),
  model: z.enum(AI_MODELS).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
})

export async function GET() {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureDefaultAgent(user.id)
    const agents = await listAgents(user.id)
    return NextResponse.json({ agents, configured: isAiConfigured() })
  } catch (err) {
    console.error('List AI agents error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromStore(cookies())
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Data tidak valid' },
      { status: 400 }
    )
  }

  try {
    const id = randomUUID()
    const now = nowIso()
    const isFirst = !(await queryOne('SELECT id FROM ai_agents WHERE creator_id = ? LIMIT 1', [user.id]))

    await execute(
      `INSERT INTO ai_agents (id, creator_id, name, description, system_prompt, model, temperature, is_active, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        user.id,
        parsed.data.name,
        parsed.data.description || null,
        parsed.data.systemPrompt,
        parsed.data.model || 'gpt-4o-mini',
        parsed.data.temperature ?? 0.7,
        isFirst ? 1 : 0,
        now,
        now,
      ]
    )

    return NextResponse.json({ id })
  } catch (err) {
    console.error('Create AI agent error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
