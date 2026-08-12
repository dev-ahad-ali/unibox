"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { cancelMetaConnect, connectSelectedAssets, type SelectFormState } from "./actions";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Platform } from "@/lib/types";

export type SelectableAsset = {
  key: string;
  platform: Platform;
  displayName: string;
  detail?: string;
  alreadyConnected: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Connecting…" : "Connect selected"}
    </Button>
  );
}

export function SelectForm({
  assets,
  warnings
}: Readonly<{ assets: SelectableAsset[]; warnings: string[] }>) {
  const [state, formAction] = useActionState<SelectFormState, FormData>(connectSelectedAssets, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose what to connect</CardTitle>
        <CardDescription>
          These are the accounts your Meta login can manage. Already-connected accounts are
          re-authorized with a fresh token if you select them again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {warnings.length > 0 ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            {warnings.map(warning => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {assets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No Pages, Instagram accounts, or WhatsApp numbers came back for this login. Check that
            the Meta app has the matching products enabled and that your account administers them.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col rounded-md border border-border">
              {assets.map(asset => (
                <label
                  key={asset.key}
                  className="flex cursor-pointer items-center gap-3 border-b border-border/60 p-3 last:border-0 hover:bg-secondary/40"
                >
                  <input
                    type="checkbox"
                    name="asset"
                    value={asset.key}
                    defaultChecked={!asset.alreadyConnected}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <PlatformIcon platform={asset.platform} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{asset.displayName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {platformLabel(asset.platform)}
                      {asset.detail ? ` · ${asset.detail}` : ""}
                    </span>
                  </span>
                  {asset.alreadyConnected ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">connected</span>
                  ) : null}
                </label>
              ))}
            </div>

            {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

            <div className="flex items-center gap-2">
              <SubmitButton />
              <Button type="submit" variant="ghost" size="sm" formAction={cancelMetaConnect}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
