import { NextResponse, type NextRequest } from 'next/server'
import { videoAnalysisEnabled } from '@/lib/features'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (!videoAnalysisEnabled && (pathname === '/clips' || pathname.startsWith('/clips/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (pathname === '/api/team' || pathname.startsWith('/api/team/')) {
    return NextResponse.json({ error: 'Team features are excluded from the self-hosted solo build.' }, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/team/:path*', '/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
