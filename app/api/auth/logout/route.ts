import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { execute } from '@/lib/turso/client'
import { readSessionPayload, SESSION_COOKIE } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const payload = readSessionPayload()
    if (payload) {
      await execute('DELETE FROM sessions WHERE id = ?', [payload.sid])
    }
  } catch (err) {
    console.error('Logout error', err)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
