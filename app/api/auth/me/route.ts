import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromStore } from '@/lib/auth/me'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getUserFromStore(cookies())
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({ user })
}
