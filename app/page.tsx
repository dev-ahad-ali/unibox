import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/shell";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { getSnapshot, summarizeInbox } from "@/lib/store";
import { requireSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await requireSession("/");
  const { db, member, organization } = session;
  const [stats, snapshot] = await Promise.all([
    summarizeInbox(db, member.orgId),
    getSnapshot(db, member.orgId)
  ]);

  const metrics = [
    { label: "Open conversations", value: stats.openCount },
    { label: "Pending", value: stats.pendingCount },
    { label: "Connected channels", value: stats.activeChannels },
    { label: "Inbound messages", value: stats.unreadCount }
  ];

  return (
    <AppShell
      title="Overview"
      subtitle={session.isDemo ? "Running on seeded demo data" : organization.name}
      active="/"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
      actions={
        <Button asChild size="sm">
          <Link href="/inbox">
            Open inbox
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
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
            <CardTitle>Channels</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {snapshot.channels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No channels connected yet. Add a row to the <code>channels</code> table to get
                started.
              </p>
            ) : (
              snapshot.channels.map(channel => (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
                >
                  <PlatformIcon platform={channel.platform} />
                  <span className="min-w-0 flex-1 truncate text-sm">{channel.displayName}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {platformLabel(channel.platform)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusDot status={channel.status} />
                    {channel.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
