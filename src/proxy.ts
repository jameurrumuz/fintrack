
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 0. Skip internal Next.js paths and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const userTypeCookie = request.cookies.get('userType')?.value;
  const isPortalPath = pathname.startsWith('/portal');

  // 1. /portal root redirect
  if (pathname === '/portal' || pathname === '/portal/') {
    return NextResponse.redirect(new URL('/portal/login', request.url));
  }
  
  // 2. Auth protection for portal
  if (!userTypeCookie && isPortalPath && !pathname.startsWith('/portal/login') && !pathname.startsWith('/portal/signup')) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
  }

  // 3. User & Staff Routing
  if (userTypeCookie === 'fin-plan-user' || userTypeCookie === 'fin-plan-staff') {
    if (!isPortalPath) {
      const redirectUrl = userTypeCookie === 'fin-plan-user' ? '/portal/user/dashboard' : '/portal/staff/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    if (userTypeCookie === 'fin-plan-user' && !pathname.startsWith('/portal/user')) {
        return NextResponse.redirect(new URL('/portal/user/dashboard', request.url));
    }
    if (userTypeCookie === 'fin-plan-staff' && !pathname.startsWith('/portal/staff')) {
        return NextResponse.redirect(new URL('/portal/staff/dashboard', request.url));
    }
  }

  // 4. Admin Routing
  if (userTypeCookie === 'fin-plan-admin') {
     if (isPortalPath && !pathname.startsWith('/portal/admin')) {
         return NextResponse.redirect(new URL('/portal/admin/dashboard', request.url));
     }
  }

  // 5. Logged-in users trying to access login/signup
  if (pathname.startsWith('/portal/login') || pathname.startsWith('/portal/signup')) {
    if (userTypeCookie === 'fin-plan-admin') return NextResponse.redirect(new URL('/portal/admin/dashboard', request.url));
    if (userTypeCookie === 'fin-plan-user') return NextResponse.redirect(new URL('/portal/user/dashboard', request.url));
    if (userTypeCookie === 'fin-plan-staff') return NextResponse.redirect(new URL('/portal/staff/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|migration-guide.html|pin-login|store).*)',
  ],
};
