import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const APP_PREFIXES = [
  '/dashboard',
  '/projects',
  '/onboarding',
  '/roadmaps',
  '/tasks',
  '/content',
  '/approvals',
  '/scheduling',
  '/analytics',
  '/health',
  '/opportunities',
  '/settings',
]

function isAppPath(pathname: string) {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (!isAppPath(pathname)) {
    return NextResponse.next()
  }

  const demoAuth = request.cookies.get('rf_demo_auth')?.value
  if (process.env.NODE_ENV !== 'production' && demoAuth === '1') {
    return NextResponse.next()
  }

  // NextAuth session check (JWT strategy).
  // If NEXTAUTH_SECRET is missing, getToken will always return null.
  return getToken({ req: request })
    .then((token) => {
      if (token) return NextResponse.next()

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(loginUrl)
    })
    .catch(() => {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(loginUrl)
    })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
