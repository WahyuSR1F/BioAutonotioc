import { NextRequest, NextResponse } from 'next/server'
import { queryOne, str } from '@/lib/turso/client'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }

    const user = await queryOne<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [String(email).toLowerCase().trim()]
    )

    if (!user || !verifyPassword(String(password), str(user.password_hash))) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
    }

    const uid = str(user.id)
    const sid = await createSession(uid)
    const res = NextResponse.json({ user: { id: uid, email: str(user.email) } })

    res.cookies.set(
      SESSION_COOKIE,
      encodeSession({ sid, uid, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
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
    console.error('Login error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
