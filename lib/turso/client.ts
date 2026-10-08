import { createClient, type Client, type InValue, type Row, type ResultSet } from '@libsql/client'

let client: Client | null = null

export function db(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN
    if (!url) {
      throw new Error('TURSO_DATABASE_URL is not set')
    }
    client = createClient({ url, authToken })
  }
  return client
}

const MAX_RETRY = 2
const RETRY_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run(sql: string, args: InValue[]): Promise<ResultSet> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      return await db().execute({ sql, args })
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRY) await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastErr
}

function rowToObject(res: ResultSet, row: Row): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const cols = res.columns
  for (let i = 0; i < cols.length; i++) {
    obj[cols[i]] = row[i]
  }
  return obj
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = []
): Promise<T | null> {
  const res = await run(sql, args)
  const row = res.rows[0]
  return row ? (rowToObject(res, row) as T) : null
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = []
): Promise<T[]> {
  const res = await run(sql, args)
  return res.rows.map((row) => rowToObject(res, row) as T)
}

export async function execute(sql: string, args: InValue[] = []) {
  return run(sql, args)
}

export function bool(v: unknown): boolean {
  if (typeof v === 'bigint') return v === BigInt(1)
  return v === 1 || v === true || v === '1'
}

export function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Uint8Array) return Buffer.from(v).toString('utf8')
  if (v instanceof ArrayBuffer) return Buffer.from(v).toString('utf8')
  if (v === null || v === undefined) return ''
  return String(v)
}

export function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return str(v)
}

export function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (v === null || v === undefined) return 0
  return Number(v)
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  return num(v)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function toUint8(v: unknown): Uint8Array | null {
  if (v === null || v === undefined) return null
  if (v instanceof Uint8Array) return v
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  if (typeof v === 'string') return new Uint8Array(Buffer.from(v, 'binary'))
  return null
}
