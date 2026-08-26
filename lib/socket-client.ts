"use client";

import { io, type Socket } from "socket.io-client";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

let socket: Socket | null = null;

/**
 * One Socket.io connection per browser tab, shared by every component that
 * listens for live events. The server derives the org room from the access
 * token in the handshake; it ignores any org id a client might claim.
 */
export async function getSocket(): Promise<Socket> {
  if (socket) {
    return socket;
  }

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
