import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { cookies } from 'next/headers'
import { execute, queryOne, nowIso } from '@/lib/turso/client'

export const SESSION_COOKIE = 'ba_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 hari

type CookieStore = ReturnType<typeof cookies>

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function fromBase64Url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

function sign(payload: string): string {
  const key = new TextEncoder().encode(getSecret())
  const msg = new TextEncoder().encode(payload)
  return toBase64Url(hmac(sha256, key, msg))
}

// Constant-time comparison (aman di edge runtime tanpa node:crypto)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function randomId(): string {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

export type SessionPayload = {
  sid: string
  uid: string
  exp: number
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `v1.${body}.${sign(body)}`
}

export function decodeSession(cookieValue: string | undefined | null): SessionPayload | null {
  if (!cookieValue) return null
  const parts = cookieValue.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  const [, body, sig] = parts
  if (!safeEqual(sig, sign(body))) return null
  try {
    const payload = JSON.parse(fromBase64Url(body).toString('utf8')) as SessionPayload
    if (!payload.sid || !payload.uid || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function readSessionPayload(cookieStore?: CookieStore): SessionPayload | null {
  const store = cookieStore ?? cookies()
  return decodeSession(store.get(SESSION_COOKIE)?.value)
}

export async function createSession(userId: string): Promise<string> {
  const sid = randomId()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString()
  await execute(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [sid, userId, expiresAt]
  )
  return sid
}

export function setSessionCookie(sid: string, uid: string, cookieStore?: CookieStore): void {
  const payload: SessionPayload = {
    sid,
    uid,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }
  const store = cookieStore ?? cookies()
  store.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function destroySession(cookieStore?: CookieStore): Promise<void> {
  const payload = readSessionPayload(cookieStore)
  if (payload) {
    await execute('DELETE FROM sessions WHERE id = ?', [payload.sid])
  }
  const store = cookieStore ?? cookies()
  store.delete(SESSION_COOKIE)
}

export async function sessionExists(payload: SessionPayload): Promise<boolean> {
  const row = await queryOne<{ expires_at: string }>(
    'SELECT expires_at FROM sessions WHERE id = ? AND user_id = ?',
    [payload.sid, payload.uid]
  )
  if (!row) return false
  return row.expires_at > nowIso()
}
