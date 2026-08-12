import { AppShell } from "@/components/shell";
import { ChannelControls, ConnectMetaButton, ManualConnectForm } from "./manage";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { metaConfigured, metaRedirectUri } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { isEncryptionConfigured } from "@/lib/crypto";
import { getSnapshot } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { platforms } from "@/lib/types";

const WEBHOOK_PATH = {
  messenger: "/api/webhooks/messenger",
  instagram: "/api/webhooks/instagram",
  whatsapp: "/api/webhooks/whatsapp",
  line: "/api/webhooks/line"
} as const;

function getParam(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

export default async function ChannelsPage({
  searchParams
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const session = await requireRole(["admin"], "/admin/channels");
  const { db, member, organization } = session;

  const params = (await searchParams) ?? {};
  const errorMessage = getParam(params.error);
  const connectedMessage = getParam(params.connected);

  const snapshot = await getSnapshot(db, member.orgId);
  const connected = new Set(snapshot.channels.map(channel => channel.platform));

  return (
    <AppShell
      title="Channels"
      subtitle="Connect the accounts this workspace answers messages for"
      active="/admin/channels"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
    >
      <div className="flex max-w-3xl flex-col gap-6">
        {connectedMessage ? (
          <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            Connected {connectedMessage}.
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}
        {isEncryptionConfigured() ? null : (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            APP_ENCRYPTION_KEY is not set, so platform tokens cannot be stored. Generate one with{" "}
            <code>openssl rand -hex 32</code>.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Connect with Meta</CardTitle>
            <CardDescription>
              One login covers Messenger, Instagram, and WhatsApp. Pages are subscribed to the
              messaging webhook automatically — without that step Meta accepts the connection but
              never delivers a message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectMetaButton configured={metaConfigured()} />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Add this as a Valid OAuth Redirect URI in the Meta app dashboard:{" "}
              <code className="break-all">{metaRedirectUri()}</code>
            </p>
          </CardContent>
        </Card>

        <ManualConnectForm />

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connected channels
          </h2>

          {snapshot.channels.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  No channels connected yet. Use one of the options above.
                </p>
              </CardContent>
            </Card>
          ) : (
            snapshot.channels.map(channel => (
              <Card key={channel.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformIcon platform={channel.platform} />
                      <span className="truncate text-sm font-medium">{channel.displayName}</span>
                    </div>
                    <Badge
                      variant={
                        channel.status === "active"
                          ? "success"
                          : channel.status === "error"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      <StatusDot status={channel.status} />
                      {channel.status}
                    </Badge>
                  </div>

                  <dl className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Platform</dt>
                      <dd>{platformLabel(channel.platform)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Account id</dt>
                      <dd className="truncate font-mono">{channel.externalAccountId}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Webhook</dt>
                      <dd className="truncate font-mono">{WEBHOOK_PATH[channel.platform]}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Connected</dt>
                      <dd>{formatDateTime(channel.createdAt)}</dd>
                    </div>
                  </dl>

                  <ChannelControls channelId={channel.id} displayName={channel.displayName} />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Not connected
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {platforms
              .filter(platform => !connected.has(platform))
              .map(platform => (
                <span
                  key={platform}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                >
                  <PlatformIcon platform={platform} />
                  {platformLabel(platform)}
                </span>
              ))}
            {platforms.every(platform => connected.has(platform)) ? (
              <span className="text-xs text-muted-foreground">All platforms are connected.</span>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
