"use client";

import { useEffect, useState } from "react";
import { type Socket } from "socket.io-client";

import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

/**
 * Connection pill only. Applying the events to the UI is the inbox client
 * store's job — this component must not trigger router.refresh(), or every
 * incoming message would force a full server re-render.
 */
export function SocketStatus({ orgId }: Readonly<{ orgId: string }>) {
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    let client: Socket | null = null;
    let cancelled = false;

    const onConnect = () => setState("live");
    const onDisconnect = () => setState("offline");
    const onError = () => setState("offline");

    void getSocket().then(instance => {
      if (cancelled) {
        return;
      }

      client = instance;
      client.on("connect", onConnect);
      client.on("disconnect", onDisconnect);
      client.on("connect_error", onError);

      if (client.connected) {
        onConnect();
      }
    });

    return () => {
      cancelled = true;
      client?.off("connect", onConnect);
      client?.off("disconnect", onDisconnect);
      client?.off("connect_error", onError);
    };
  }, [orgId]);

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
