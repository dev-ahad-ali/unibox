"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signUp, type SignupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating…" : "Create workspace"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<SignupFormState, FormData>(signUp, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a workspace</CardTitle>
        <CardDescription>You become its first admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Workspace name</span>
            <Input name="orgName" required placeholder="Japan Airbnb Support" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Your name</span>
            <Input name="displayName" autoComplete="name" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input name="email" type="email" autoComplete="email" required />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Password</span>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          {state.notice ? <p className="text-xs text-primary">{state.notice}</p> : null}

          <SubmitButton />

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
