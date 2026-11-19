import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const isLoginPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/';
  const adminSession = request.cookies.get('agritrack_admin_session')?.value;

  // ========================================================================
  // ULTRA-FAST PATH: If admin session cookie is already active, authenticate
  // in 0ms without waiting for a blocking remote Supabase auth network call.
  // ========================================================================
  if (adminSession) {
    if (isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return response;
  }

  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://agritrack-liberia-demo.supabase.co' &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );

  let hasSupabaseUser = false;

  // Only check remote Supabase session if no local adminSession and not already on login
  if (isConfigured && !isLoginPage) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
              cookiesToSet.forEach(({ name, value }) => {
                request.cookies.set(name, value);
              });
              response = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      // Strict 1.5s timeout prevents navigation hangs on slow/unreachable networks
      const userPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 1500)
      );

      const { data: { user } } = await Promise.race([userPromise, timeoutPromise]) as any;

      if (user) {
        hasSupabaseUser = true;
      }
    } catch {
      // On network timeout or error, continue to login check
    }
  }

  const isAuthenticated = Boolean(hasSupabaseUser || adminSession);

  // If not authenticated and trying to access a protected route
  if (!isAuthenticated && !isLoginPage && !request.nextUrl.pathname.startsWith('/_next') && !request.nextUrl.pathname.startsWith('/api')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If already authenticated and visiting login page, redirect to dashboard
  if (isAuthenticated && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
