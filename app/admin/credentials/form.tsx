"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, RefreshCw, Trash2 } from "lucide-react";

import {
  removeMetaCredentials,
  saveMetaCredentials,
  type CredentialsActionState
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MetaCredentialsSummary } from "@/lib/types";

function Submit({ label, pendingLabel }: Readonly<{ label: string; pendingLabel: string }>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Field({
  label,
  hint,
  children
}: Readonly<{ label: string; hint?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function MetaCredentialsForm({
  summary
}: Readonly<{ summary: MetaCredentialsSummary }>) {
  const [state, formAction] = useActionState<CredentialsActionState, FormData>(
    saveMetaCredentials,
    {}
  );
  const [verifyToken, setVerifyToken] = useState(summary.verifyToken ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="App ID"
        hint={
          <>
            Meta dashboard → <strong>App settings → Basic</strong>. All digits, and safe to share.
          </>
        }
      >
        <Input name="appId" defaultValue={summary.appId ?? ""} required autoComplete="off" />
      </Field>

      <Field
        label="App secret"
        hint={
          summary.hasAppSecret ? (
            <>
              A secret is already stored. Leave this blank to keep it, or paste a new one to replace
              it. It is checked against Meta before it is saved.
            </>
          ) : (
            <>
              Same page as the app id, behind the <strong>Show</strong> button. Encrypted before it
              is stored, and never shown again.
            </>
          )
        }
      >
        <Input
          name="appSecret"
          type="password"
          autoComplete="off"
          placeholder={summary.hasAppSecret ? "•••••••• (unchanged)" : ""}
          required={!summary.hasAppSecret}
        />
      </Field>

      <Field
        label="Verify token"
        hint={
          <>
            Any string you invent. Paste the identical value into Meta's webhook dialog — it is how
            Meta proves it reached the right server.
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Input
            name="verifyToken"
            value={verifyToken}
            onChange={event => setVerifyToken(event.target.value)}
            required
            autoComplete="off"
            className="min-w-0 flex-1 font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setVerifyToken(crypto.randomUUID().replace(/-/g, ""))}
          >
            <RefreshCw aria-hidden />
            Generate
          </Button>
        </div>
      </Field>

      <Field
        label="Instagram app secret (optional)"
        hint={
          <>
            Only for <strong>Instagram API with Instagram Login</strong>. That product signs its
            webhooks with its own secret, shown on the Instagram product page rather than Basic
            settings. Leave blank if you connect Instagram through a Facebook Page.
          </>
        }
      >
        <Input
          name="instagramAppSecret"
          type="password"
          autoComplete="off"
          placeholder={summary.hasInstagramAppSecret ? "•••••••• (unchanged)" : ""}
        />
      </Field>

      {summary.hasInstagramAppSecret ? (
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" name="clearInstagramAppSecret" className="size-3.5" />
          Remove the stored Instagram app secret
        </label>
      ) : null}

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.notice ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" aria-hidden />
          {state.notice}
        </p>
      ) : null}

      <div>
        <Submit label="Verify and save" pendingLabel="Checking with Meta…" />
      </div>
    </form>
  );
}

export function RemoveCredentialsButton() {
  const [state, formAction] = useActionState<CredentialsActionState, FormData>(
    removeMetaCredentials,
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={event => {
        if (
          !confirm(
            "Remove this workspace's Meta app credentials? New connections and webhook verification stop working until you add them again. Connected channels keep their own tokens."
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-2"
    >
      <Button type="submit" size="sm" variant="ghost" className="text-destructive">
        <Trash2 aria-hidden />
        Remove credentials
      </Button>
      {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
      {state.notice ? <p className="text-[11px] text-primary">{state.notice}</p> : null}
    </form>
  );
}
