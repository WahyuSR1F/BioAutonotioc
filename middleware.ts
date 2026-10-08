import { NextResponse, type NextRequest } from 'next/server'
import { decodeSession } from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  const session = decodeSession(request.cookies.get('ba_session')?.value)

  const { pathname, search } = request.nextUrl
  const isLoginRoute = pathname === '/login' || pathname === '/signup'
  // ?e=1 = escape hatch saat session di cookie valid tapi sudah kedaluwarsa di server
  // (mencegah redirect loop antara /dashboard dan /login)
  const expiredFlag = request.nextUrl.searchParams.get('e') === '1'

  if (!session && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isLoginRoute && !expiredFlag) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
