import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths reachable without a session. Everything else requires one. */
// `/legal` is published for Meta App Review, which reads the privacy policy,
// terms, and deletion instructions while signed out.
const PUBLIC_PREFIXES = ["/login", "/signup", "/join", "/auth", "/legal"];
/** Auth pages a signed-in user should be bounced away from. */
const AUTH_ONLY_PREFIXES = ["/login", "/signup"];

/**
 * The landing page. Signed-in visitors are not bounced away from it — it swaps
 * its own Log in / Register buttons for a link to the dashboard.
 */
const PUBLIC_EXACT = ["/"];

function isPublic(pathname: string) {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase project configured: the app runs on seeded demo data with a
  // stand-in demo session, so there is nothing to gate.
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      }
    }
  });

  // Verifies the JWT locally against the project's JWKS (ES256), so a valid
  // session costs no network round trip here. When the token is close to
  // expiry, getClaims() refreshes the session first and the rotated cookies
  // land on the response via the setAll handler above — which is why this must
  // run before any redirect, so the refresh is not lost.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub;

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // API callers get a machine-readable 401. Redirecting them to the login
    // page would hand a fetch() an HTML body where it expects JSON.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (user && AUTH_ONLY_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    const inbox = request.nextUrl.clone();
    inbox.pathname = "/inbox";
    inbox.search = "";
    return NextResponse.redirect(inbox);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the routes a platform calls directly.
     * Webhooks and the data deletion callback are authenticated by signature,
     * not by session — gating them here would reject every real callback.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/data-deletion|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
