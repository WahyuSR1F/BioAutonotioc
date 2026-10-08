import { NextRequest, NextResponse } from 'next/server'
import { db, queryOne, str } from '@/lib/turso/client'
import { hashPassword } from '@/lib/auth/password'
import { createSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }

    const normalizedEmail = String(email).toLowerCase().trim()

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [
      normalizedEmail,
    ])
    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
    }

    const userId = crypto.randomUUID()
    const passwordHash = hashPassword(String(password))

    await db().batch(
      [
        {
          sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
          args: [userId, normalizedEmail, passwordHash],
        },
        {
          sql: 'INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)',
          args: [userId, normalizedEmail, displayName || null],
        },
      ],
      'write'
    )

    const sid = await createSession(userId)
    const res = NextResponse.json({ user: { id: userId, email: normalizedEmail } })

    res.cookies.set(
      SESSION_COOKIE,
      encodeSession({ sid, uid: userId, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      }
    )

    return res
  } catch (err) {
    console.error('Signup error', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
