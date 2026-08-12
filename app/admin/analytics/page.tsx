import { AppShell } from "@/components/shell";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSnapshot, summarizeInbox } from "@/lib/store";
import { requireRole } from "@/lib/auth";
import { platforms } from "@/lib/types";

export default async function AnalyticsPage() {
  // Agents have no analytics surface in the spec; admins and viewers do.
  const session = await requireRole(["admin", "viewer"], "/admin/analytics");
  const { db, member, organization } = session;
  const [stats, snapshot] = await Promise.all([
    summarizeInbox(db, member.orgId),
    getSnapshot(db, member.orgId)
  ]);

  const channelById = new Map(snapshot.channels.map(channel => [channel.id, channel]));
  const volumeByPlatform = platforms.map(platform => ({
    platform,
    count: snapshot.conversations.filter(
      conversation => channelById.get(conversation.channelId)?.platform === platform
    ).length
  }));
  const maxVolume = Math.max(1, ...volumeByPlatform.map(entry => entry.count));

  const metrics = [
    { label: "Open", value: stats.openCount },
    { label: "Pending", value: stats.pendingCount },
    { label: "Inbound messages", value: stats.unreadCount },
    { label: "Active channels", value: stats.activeChannels }
  ];

  return (
    <AppShell
      title="Analytics"
      subtitle="Live counts for the current organization"
      active="/admin/analytics"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(metric => (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <div className="text-2xl font-semibold tabular-nums">{metric.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{metric.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Conversations by channel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {volumeByPlatform.map(({ platform, count }) => (
              <div key={platform} className="flex items-center gap-3">
                <div className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <PlatformIcon platform={platform} />
                  {platformLabel(platform)}
                </div>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / maxVolume) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          Response-time metrics need a first-response timestamp per conversation, which the schema
          does not record yet.
        </p>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
