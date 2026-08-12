import { AppShell } from "@/components/shell";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { getDemoSnapshot } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { platforms } from "@/lib/types";

const WEBHOOK_PATH = {
  messenger: "/api/webhooks/messenger",
  instagram: "/api/webhooks/instagram",
  whatsapp: "/api/webhooks/whatsapp",
  line: "/api/webhooks/line"
} as const;

export default async function ChannelsPage() {
  const snapshot = await getDemoSnapshot();
  const connected = new Set(snapshot.channels.map(channel => channel.platform));

  return (
    <AppShell
      title="Channels"
      subtitle="Connected social accounts and the webhook URL each platform should call"
      active="/admin/channels"
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 md:grid-cols-2">
          {snapshot.channels.map(channel => (
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
              </CardContent>
            </Card>
          ))}
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
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Connecting a channel is still a manual step: insert a row into <code>channels</code>{" "}
            with the platform account id and an access token encrypted with{" "}
            <code>APP_ENCRYPTION_KEY</code>. The OAuth connect flow is not built yet.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
