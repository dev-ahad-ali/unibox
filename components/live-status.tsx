"use client";

import { useEffect, useState } from "react";

import { onLiveState, type LiveState } from "@/lib/realtime-client";
import { cn } from "@/lib/utils";

/**
 * Connection pill only. Applying the events to the UI is the inbox client
 * store's job — this component must not trigger router.refresh(), or every
 * incoming message would force a full server re-render.
 */
export function LiveStatus({ orgId }: Readonly<{ orgId: string }>) {
  const [state, setState] = useState<LiveState>("connecting");

  useEffect(() => onLiveState(orgId, setState), [orgId]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "live" ? "bg-primary" : state === "connecting" ? "bg-warning" : "bg-destructive"
        )}
        aria-hidden
      />
      {state}
    </span>
  );
}
