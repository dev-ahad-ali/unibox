"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

let socket: Socket | null = null;

async function getSocket() {
  if (socket) {
    return socket;
  }

  // The server derives the room from this token; it ignores any org id we send.
  const supabase = createBrowserSupabaseClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };

  // Same-origin: the Socket.io server is attached to this app's HTTP server in
  // server.js, so there is no cross-origin URL to configure.
  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: { accessToken: data.session?.access_token }
  });

  return socket;
}

export function SocketStatus({ orgId }: Readonly<{ orgId: string }>) {
  const router = useRouter();
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    let client: Socket | null = null;
    let cancelled = false;

    const onConnect = () => setState("live");
    const onDisconnect = () => setState("offline");
    const onError = () => setState("offline");
    // Server-rendered thread + list, so a refresh is the whole live update.
    const onUpdate = () => router.refresh();

    void getSocket().then(instance => {
      if (cancelled) {
        return;
      }

      client = instance;
      client.on("connect", onConnect);
      client.on("disconnect", onDisconnect);
      client.on("connect_error", onError);
      client.on("new_message", onUpdate);
      client.on("conversation_updated", onUpdate);

      if (client.connected) {
        onConnect();
      }
    });

    return () => {
      cancelled = true;
      client?.off("connect", onConnect);
      client?.off("disconnect", onDisconnect);
      client?.off("connect_error", onError);
      client?.off("new_message", onUpdate);
      client?.off("conversation_updated", onUpdate);
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
