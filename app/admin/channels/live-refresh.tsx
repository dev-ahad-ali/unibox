"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { onOrgEvent } from "@/lib/realtime-client";

/**
 * Re-renders the channels screen when a webhook lands, so the setup checks
 * flip to green the moment the platform's first delivery arrives — the admin
 * watches it happen instead of mashing reload to find out whether their
 * webhook registration worked.
 */
export function LiveSetupRefresh({ orgId }: Readonly<{ orgId: string }>) {
  const router = useRouter();

  useEffect(() => onOrgEvent(orgId, "webhook_received", () => router.refresh()), [orgId, router]);

  return null;
}
