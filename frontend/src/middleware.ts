import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth disabled — middleware is now a no-op pass-through.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
