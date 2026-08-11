"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAppUrl } from "@/lib/env";

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(getAppUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"]
    });
  }
  return socket;
}

export function SocketStatus({ orgId }: Readonly<{ orgId: string }>) {
  const [state, setState] = useState<"connecting" | "connected" | "offline">("connecting");

  useEffect(() => {
    const client = getSocket();

    const onConnect = () => {
      setState("connected");
      client.emit("join-org", orgId);
    };
    const onDisconnect = () => setState("offline");

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);

    if (client.connected) {
      onConnect();
    }

    return () => {
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
    };
  }, [orgId]);

  return <span className={`status-pill ${state === "connected" ? "status-open" : "status-pending"}`}>Socket {state}</span>;
}
