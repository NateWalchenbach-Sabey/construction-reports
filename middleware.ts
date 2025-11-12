import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Development mode: bypass auth
const useDevMode = process.env.BYPASS_AUTH === 'true'

export function middleware(_request: NextRequest) {
  // In dev mode, just allow everything
  if (useDevMode) {
    return NextResponse.next()
  }
  
  // In production, use real auth (will be handled by withAuth)
  // For now, just allow all in dev
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'],
}
