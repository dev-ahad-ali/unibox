import { redirect } from "next/navigation";

import { readConnectedUserToken } from "./actions";
import { SelectForm, type SelectableAsset } from "./select-form";
import { AppShell } from "@/components/shell";
import { discoverMetaAssets } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { getSnapshot } from "@/lib/store";

export default async function MetaSelectPage() {
  const session = await requireRole(["admin"], "/admin/channels");
  const { db, member, organization } = session;

  const userToken = await readConnectedUserToken();
  if (!userToken) {
    redirect("/admin/channels?error=The%20Meta%20connection%20expired.%20Try%20again.");
  }

  const [{ assets, warnings }, snapshot] = await Promise.all([
    discoverMetaAssets(userToken),
    getSnapshot(db, member.orgId)
  ]);

  const connectedKeys = new Set(
    snapshot.channels.map(channel => `${channel.platform}:${channel.externalAccountId}`)
  );

  const selectable: SelectableAsset[] = assets.map(asset => {
    const key = `${asset.platform}:${asset.externalAccountId}`;
    return {
      key,
      platform: asset.platform,
      displayName: asset.displayName,
      detail: asset.detail,
      alreadyConnected: connectedKeys.has(key)
    };
  });

  return (
    <AppShell
      title="Connect Meta accounts"
      subtitle="Pages, Instagram accounts, and WhatsApp numbers from your Meta login"
      active="/admin/channels"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
    >
      <div className="max-w-2xl">
        <SelectForm assets={selectable} warnings={warnings} />
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
