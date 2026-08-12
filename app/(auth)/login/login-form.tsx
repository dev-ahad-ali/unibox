"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type AuthFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in</CardTitle>
        <CardDescription>Use the email your workspace admin invited.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input name="email" type="email" autoComplete="email" required />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Password</span>
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>

          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

          <SubmitButton />

          <p className="text-center text-xs text-muted-foreground">
            No workspace yet?{" "}
            <Link href="/signup" className="text-primary underline-offset-2 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
