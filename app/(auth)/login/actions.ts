"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase";

export type AuthFormState = { error?: string; notice?: string };

function safeNext(value: FormDataEntryValue | null) {
  // Only same-origin relative paths, so `next` cannot be used as an open redirect.
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/inbox";
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const db = await createUserClient();
  if (!db) {
    return { error: "Supabase is not configured on this server." };
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const db = await createUserClient();
  await db?.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
