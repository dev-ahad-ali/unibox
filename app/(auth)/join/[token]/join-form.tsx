"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { acceptInvite, signUpWithInvite, type JoinFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function SubmitButton({ label, pendingLabel }: Readonly<{ label: string; pendingLabel: string }>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function JoinForm({
  token,
  email,
  role,
  organizationName,
  signedIn
}: Readonly<{
  token: string;
  email: string;
  role: string;
  organizationName: string;
  signedIn: boolean;
}>) {
  const [state, formAction] = useActionState<JoinFormState, FormData>(
    signedIn ? acceptInvite : signUpWithInvite,
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Join {organizationName || "this workspace"}
        </CardTitle>
        <CardDescription>
          Invited as <span className="text-foreground">{email}</span> with the{" "}
          <span className="text-foreground">{role}</span> role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />

          {signedIn ? null : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Your name</span>
                <Input name="displayName" autoComplete="name" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Choose a password</span>
                <Input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </>
          )}

          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          {state.notice ? <p className="text-xs text-primary">{state.notice}</p> : null}

          <SubmitButton
            label={signedIn ? "Accept invite" : "Join workspace"}
            pendingLabel="Joining…"
          />
        </form>
      </CardContent>
    </Card>
  );
}
