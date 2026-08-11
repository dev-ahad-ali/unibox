import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = any;

let browserClient: SupabaseClient<Database> | null = null;
let serverClient: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  browserClient ??= createClient<Database>(url, anonKey);
  return browserClient;
}

export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }

  serverClient ??= createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return serverClient;
}
