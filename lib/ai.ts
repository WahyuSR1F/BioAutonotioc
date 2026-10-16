import { execute, queryAll, queryOne, bool, num, str, strOrNull, nowIso } from '@/lib/turso/client'
import { randomUUID } from 'crypto'

// Re-export agar import server tetap bisa dari '@/lib/ai'
export { AI_MODELS, type AiModel } from '@/lib/ai-models'

export interface AiAgent {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  model: string
  temperature: number
  isActive: boolean
  isDefault: boolean
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

function mapAgent(r: Record<string, unknown>): AiAgent {
  return {
    id: str(r.id),
    name: str(r.name),
    description: strOrNull(r.description),
    systemPrompt: str(r.system_prompt),
    model: str(r.model) || 'gpt-4o-mini',
    temperature: num(r.temperature) || 0.7,
    isActive: bool(r.is_active),
    isDefault: bool(r.is_default),
  }
}

export async function listAgents(creatorId: string): Promise<AiAgent[]> {
  const rows = await queryAll(
    'SELECT * FROM ai_agents WHERE creator_id = ? ORDER BY is_default DESC, created_at ASC',
    [creatorId]
  )
  return rows.map(mapAgent)
}

export async function getAgent(creatorId: string, agentId: string): Promise<AiAgent | null> {
  const row = await queryOne('SELECT * FROM ai_agents WHERE id = ? AND creator_id = ?', [agentId, creatorId])
  return row ? mapAgent(row) : null
}

/**
 * Pastikan creator punya minimal satu agent. Dipanggil saat membuka
 * halaman chat/settings supaya pengguna lama tetap mendapat agent bawaan.
 */
export async function ensureDefaultAgent(creatorId: string): Promise<void> {
  const existing = await queryOne('SELECT id FROM ai_agents WHERE creator_id = ? LIMIT 1', [creatorId])
  if (existing) return

  const now = nowIso()
  await execute(
    `INSERT INTO ai_agents (id, creator_id, name, description, system_prompt, model, temperature, is_active, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
    [
      randomUUID(),
      creatorId,
      'Asisten Utama',
      'Agent bawaan untuk membantu menjalankan BioAutomate.',
      'Kamu adalah asisten AI untuk BioAutomate, platform penjualan produk digital dengan pengiriman otomatis. Jawab dengan bahasa Indonesia yang ringkas dan ramah.',
      'gpt-4o-mini',
      0.7,
      now,
      now,
    ]
  )
}

/**
 * Pilih agent untuk routing chat:
 * - agentId eksplisit → pakai agent itu (harus aktif)
 * - tanpa agentId → agent default yang aktif, fallback ke agent aktif pertama
 */
export async function resolveActiveAgent(creatorId: string, agentId?: string | null): Promise<AiAgent | null> {
  if (agentId) {
    const agent = await getAgent(creatorId, agentId)
    return agent && agent.isActive ? agent : null
  }
  const rows = await queryAll(
    'SELECT * FROM ai_agents WHERE creator_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at ASC LIMIT 1',
    [creatorId]
  )
  return rows[0] ? mapAgent(rows[0]) : null
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Panggil OpenAI chat completions (tanpa SDK, pakai fetch). */
export async function chatCompletion(opts: {
  model: string
  temperature: number
  messages: ChatMessage[]
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY belum di-set di environment')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      messages: opts.messages,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI mengembalikan respons kosong')
  return content
}

export const MAX_HISTORY = 20 // jumlah pesan terakhir yang dikirim sebagai konteks
export const MAX_MESSAGE_LENGTH = 4000
