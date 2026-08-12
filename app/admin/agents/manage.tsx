"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, X } from "lucide-react";

import { changeRole, createInvite, revokeInvite, type AgentActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { roles, type Role } from "@/lib/types";

function Submit({ label, size = "sm" }: Readonly<{ label: string; size?: "sm" | "icon" }>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} disabled={pending}>
      {size === "icon" ? <Check /> : pending ? "Working…" : label}
    </Button>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState<AgentActionState, FormData>(createInvite, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input name="email" type="email" required placeholder="agent@example.com" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Role</span>
            <select
              name="role"
              defaultValue="agent"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {roles.map(role => (
                <option key={role} value={role} className="bg-popover">
                  {role}
                </option>
              ))}
            </select>
          </label>

          <Submit label="Create invite" />
        </form>

        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

        {state.inviteUrl ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {state.notice} No email is sent — copy this link to them.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1.5 text-[11px]">
                {state.inviteUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(state.inviteUrl ?? "")}
              >
                <Copy />
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RoleForm({
  memberId,
  role,
  disabled
}: Readonly<{ memberId: string; role: Role; disabled: boolean }>) {
  const [state, formAction] = useActionState<AgentActionState, FormData>(changeRole, {});

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {roles.map(entry => (
          <option key={entry} value={entry} className="bg-popover">
            {entry}
          </option>
        ))}
      </select>
      {disabled ? null : (
        <Button type="submit" size="icon" variant="ghost" className="size-7" aria-label="Save role">
          <Check />
        </Button>
      )}
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function RevokeInviteForm({ inviteId }: Readonly<{ inviteId: string }>) {
  const [, formAction] = useActionState<AgentActionState, FormData>(revokeInvite, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Revoke invite"
        title="Revoke invite"
      >
        <X />
      </Button>
    </form>
  );
}
