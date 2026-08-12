import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side client. Kept out of `lib/supabase.ts` because that module
 * imports `next/headers`, which cannot be bundled into a client component.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}
