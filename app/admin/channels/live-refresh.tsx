"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Socket } from "socket.io-client";

import { getSocket } from "@/lib/socket-client";

/**
 * Re-renders the channels screen when a webhook lands, so the setup checks
 * flip to green the moment the platform's first delivery arrives — the admin
 * watches it happen instead of mashing reload to find out whether their
 * webhook registration worked.
 */
export function LiveSetupRefresh() {
  const router = useRouter();

  useEffect(() => {
    let client: Socket | null = null;
    let cancelled = false;
    const onEvent = () => router.refresh();

    void getSocket().then(instance => {
      if (cancelled) {
        return;
      }
      client = instance;
      client.on("webhook_received", onEvent);
    });

    return () => {
      cancelled = true;
      client?.off("webhook_received", onEvent);
    };
  }, [router]);

  return null;
}
