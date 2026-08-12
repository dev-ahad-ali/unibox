"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

import { cn } from "@/lib/utils";

let socket: Socket | null = null;

function getSocket() {
  // Same-origin: the Socket.io server is attached to this app's HTTP server in
  // server.js, so there is no cross-origin URL to configure.
  socket ??= io({ path: "/socket.io", transports: ["websocket", "polling"] });
  return socket;
}

export function SocketStatus({ orgId }: Readonly<{ orgId: string }>) {
  const router = useRouter();
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    const client = getSocket();

    const onConnect = () => {
      setState("live");
      client.emit("join-org", orgId);
    };
    const onDisconnect = () => setState("offline");
    // Server-rendered thread + list, so a refresh is the whole live update.
    const onUpdate = () => router.refresh();

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    client.on("new_message", onUpdate);
    client.on("conversation_updated", onUpdate);

    if (client.connected) {
      onConnect();
    }

    return () => {
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
      client.off("new_message", onUpdate);
      client.off("conversation_updated", onUpdate);
    };
  }, [orgId, router]);

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
