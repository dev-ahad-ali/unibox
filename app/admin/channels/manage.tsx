"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Plug, RefreshCw, Trash2 } from "lucide-react";

import {
  connectChannel,
  disconnectChannel,
  renameChannel,
  testChannel,
  type ChannelActionState
} from "./actions";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { platforms, type Platform } from "@/lib/types";

/**
 * Each platform names its account id differently, and getting the wrong one is
 * the most common setup mistake — so the form relabels itself per platform
 * instead of asking for a generic "account id".
 */
const FIELD_HELP: Record<Platform, { idLabel: string; idHint: string; tokenLabel: string; tokenHint: string }> = {
  messenger: {
    idLabel: "Facebook Page id",
    idHint: "Meta dashboard → your Page → About, or from /me/accounts.",
    tokenLabel: "Page access token",
    tokenHint: "A Page-scoped token. Prefer a System User token so it does not expire in 24 hours."
  },
  instagram: {
    idLabel: "Instagram account id",
    idHint: "The IG Business account id linked to your Page, not the @handle.",
    tokenLabel: "Page access token",
    tokenHint: "Instagram messaging is authorized with the linked Page's token."
  },
  whatsapp: {
    idLabel: "Phone number id",
    idHint: "WhatsApp → API Setup. The numeric id, not the phone number itself.",
    tokenLabel: "WhatsApp access token",
    tokenHint: "Temporary tokens from API Setup expire after 24 hours."
  },
  line: {
    idLabel: "Bot user id",
    idHint: "The `userId` from GET https://api.line.me/v2/bot/info — arrives as `destination` on webhooks.",
    tokenLabel: "Channel access token",
    tokenHint: "LINE Developers console → Messaging API tab."
  }
};

function Submit({ label, pendingLabel }: Readonly<{ label: string; pendingLabel: string }>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ConnectMetaButton({ configured }: Readonly<{ configured: boolean }>) {
  if (!configured) {
    return (
      <p className="text-xs text-muted-foreground">
        Set <code>META_APP_ID</code> and <code>META_APP_SECRET</code> to enable one-click Meta
        connect.
      </p>
    );
  }

  return (
    <Button asChild size="sm">
      {/* A plain link, not a fetch: this starts a full-page OAuth redirect. */}
      <a href="/admin/channels/connect/meta">
        <Plug aria-hidden />
        Connect with Meta
      </a>
    </Button>
  );
}

export function ManualConnectForm() {
  const [state, formAction] = useActionState<ChannelActionState, FormData>(connectChannel, {});
  const [platform, setPlatform] = useState<Platform>("line");
  const help = FIELD_HELP[platform];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect manually</CardTitle>
        <CardDescription>
          For LINE, and for Meta accounts you would rather paste a System User token for. The token
          is verified against the platform before it is saved, then encrypted at rest.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {platforms.map(entry => (
              <button
                key={entry}
                type="button"
                onClick={() => setPlatform(entry)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  platform === entry
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                <PlatformIcon
                  platform={entry}
                  className={platform === entry ? "text-primary-foreground" : undefined}
                />
                {platformLabel(entry)}
              </button>
            ))}
          </div>
          <input type="hidden" name="platform" value={platform} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Display name (optional)</span>
            <Input name="displayName" placeholder="Tokyo Support" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{help.idLabel}</span>
            <Input name="externalAccountId" required />
            <span className="text-[11px] text-muted-foreground">{help.idHint}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{help.tokenLabel}</span>
            <Input name="accessToken" type="password" required autoComplete="off" />
            <span className="text-[11px] text-muted-foreground">{help.tokenHint}</span>
          </label>

          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          {state.notice ? <p className="text-xs text-primary">{state.notice}</p> : null}

          <div>
            <Submit label="Verify and connect" pendingLabel="Verifying…" />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ChannelControls({
  channelId,
  displayName
}: Readonly<{ channelId: string; displayName: string }>) {
  const [testState, testAction] = useActionState<ChannelActionState, FormData>(testChannel, {});
  const [renameState, renameAction] = useActionState<ChannelActionState, FormData>(
    renameChannel,
    {}
  );
  const [disconnectState, disconnectAction] = useActionState<ChannelActionState, FormData>(
    disconnectChannel,
    {}
  );
  const [renaming, setRenaming] = useState(false);

  const message = testState.error ?? disconnectState.error ?? renameState.error;
  const notice = testState.notice ?? disconnectState.notice ?? renameState.notice;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={testAction}>
          <input type="hidden" name="channelId" value={channelId} />
          <Button type="submit" size="sm" variant="outline">
            <RefreshCw aria-hidden />
            Test
          </Button>
        </form>

        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(value => !value)}>
          Rename
        </Button>

        <form action={disconnectAction}>
          <input type="hidden" name="channelId" value={channelId} />
          <input type="hidden" name="mode" value="disable" />
          <Button type="submit" size="sm" variant="ghost">
            Disconnect
          </Button>
        </form>

        <form
          action={disconnectAction}
          onSubmit={event => {
            // Deleting a channel cascades to its conversations and messages.
            if (
              !confirm(
                `Delete "${displayName}"? Its conversations and messages are deleted too. Use Disconnect to keep the history.`
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="channelId" value={channelId} />
          <input type="hidden" name="mode" value="delete" />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive"
            aria-label="Delete channel"
            title="Delete channel and its history"
          >
            <Trash2 />
          </Button>
        </form>
      </div>

      {renaming ? (
        <form action={renameAction} className="flex items-center gap-1.5">
          <input type="hidden" name="channelId" value={channelId} />
          <Input name="displayName" defaultValue={displayName} className="h-8 text-xs" />
          <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="Save name">
            <Check />
          </Button>
        </form>
      ) : null}

      {message ? <p className="text-[11px] text-destructive">{message}</p> : null}
      {notice ? <p className="text-[11px] text-primary">{notice}</p> : null}
    </div>
  );
}
