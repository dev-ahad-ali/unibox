"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient, createUserClient } from "@/lib/supabase";

export type SignupFormState = { error?: string; notice?: string };

export async function signUp(_state: SignupFormState, formData: FormData): Promise<SignupFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("orgName") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !password || !orgName) {
    return { error: "Email, password, and workspace name are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const db = await createUserClient();
  const service = createServiceClient();
  if (!db || !service) {
    return { error: "Supabase is not configured on this server." };
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  const authUserId = data.user?.id;
  if (!authUserId) {
    return { error: "Sign-up did not return a user." };
  }

  // Supabase returns a user object for an already-registered email rather than
  // an error, to avoid leaking which addresses exist. An empty identities array
  // is the signal that no new account was created.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "That email is already registered. Sign in instead." };
  }

  // The org has to exist before the caller is a member of one, and RLS blocks a
  // non-member from creating it — so this one insert runs on the service client.
  const { data: organization, error: orgError } = await service
    .from("organizations")
    .insert({ name: orgName })
    .select("id")
    .single<{ id: string }>();

  if (orgError || !organization) {
    return { error: orgError?.message ?? "Could not create the workspace." };
  }

  const { error: memberError } = await service.from("org_users").insert({
    org_id: organization.id,
    auth_user_id: authUserId,
    role: "admin",
    display_name: displayName || email.split("@")[0]
  });

  if (memberError) {
    // Roll back the org so a retry does not leave orphans behind.
    await service.from("organizations").delete().eq("id", organization.id);
    return { error: memberError.message };
  }

  // With email confirmation enabled there is no session yet.
  if (!data.session) {
    return {
      notice: `Workspace "${orgName}" created. Check ${email} for a confirmation link, then sign in.`
    };
  }

  revalidatePath("/", "layout");
  redirect("/inbox");
}
