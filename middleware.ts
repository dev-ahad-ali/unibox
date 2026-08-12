import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths reachable without a session. Everything else requires one. */
const PUBLIC_PREFIXES = ["/login", "/signup", "/join", "/auth"];
/** Auth pages a signed-in user should be bounced away from. */
const AUTH_ONLY_PREFIXES = ["/login", "/signup"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

  // Refreshes an expiring session and writes the rotated cookies onto the
  // response. Must run before any redirect so the refresh is not lost.
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
     * Everything except static assets and the inbound webhook/health routes.
     * Webhooks are authenticated by platform signature, not by session — gating
     * them here would reject every real callback.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
