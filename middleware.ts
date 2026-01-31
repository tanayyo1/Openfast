import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  if (demoAuth === '1') {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
