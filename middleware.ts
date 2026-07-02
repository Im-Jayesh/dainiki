import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('dainiki_session');
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const isPublicPath = pathname === '/landing' || pathname === '/login' || pathname === '/register';

  if (!sessionCookie) {
    if (!isPublicPath && pathname !== '/') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    
    // If logged in but NOT verified, and trying to access private paths
    if (!session.isVerified && !isPublicPath && pathname !== '/') {
       // We allow them to stay on the root where they can see the OTP verification if they just registered
       // but for other pages, we redirect to root.
       // Actually, the app logic shows the OTP form on root if unverified.
       return NextResponse.redirect(new URL('/', request.url));
    }
  } catch (e) {
    // If cookie is malformed, clear it and redirect to root
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('dainiki_session');
    return response;
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (Service Worker - must be served without redirect)
     * - manifest.json (PWA manifest - must be served without redirect)
     * - *.png, *.jpg, *.svg, *.ico (public static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)',
  ],
};
