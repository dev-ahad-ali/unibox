import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type Database = any;

export type Db = SupabaseClient<Database> | null;

function config() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = config();
  return Boolean(url && anonKey);
}

/**
 * Request-scoped client carrying the signed-in user's JWT. Every query made
 * through it is subject to the RLS policies in `supabase/rls.sql` — this is the
 * client that pages, server actions, and user-facing API routes must use.
 */
export async function createUserClient(): Promise<Db> {
  const { url, anonKey } = config();
  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so it is safe to ignore here.
        }
      }
    }
  });
}

/**
 * Bypasses RLS. Only for work that has no signed-in user behind it: inbound
 * webhooks, and the signup path that has to create an organization before the
 * caller is a member of one. Never hand this to a page.
 */
export function createServiceClient(): Db {
  const { url, serviceRoleKey } = config();
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
