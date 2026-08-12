import Link from "next/link";

import { JoinForm } from "./join-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findInviteByToken, isInviteUsable } from "@/lib/invites";
import { createUserClient } from "@/lib/supabase";

export default async function JoinPage({
  params
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const invite = await findInviteByToken(token);

  if (!invite || !isInviteUsable(invite)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite unavailable</CardTitle>
          <CardDescription>
            This link is invalid, already used, or expired. Ask an admin to send a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-xs text-primary underline-offset-2 hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  const db = await createUserClient();
  const {
    data: { user }
  } = (await db?.auth.getUser()) ?? { data: { user: null } };

  return (
    <JoinForm
      token={token}
      email={invite.email}
      role={invite.role}
      organizationName={invite.organizationName}
      signedIn={Boolean(user)}
    />
  );
}

export const dynamic = "force-dynamic";
