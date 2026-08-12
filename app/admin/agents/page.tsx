import { AppShell } from "@/components/shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDemoSnapshot } from "@/lib/store";
import { formatDateTime, initials } from "@/lib/format";

const ROLE_VARIANT = {
  admin: "default",
  agent: "secondary",
  viewer: "outline"
} as const;

export default async function AgentsPage() {
  const snapshot = await getDemoSnapshot();

  return (
    <AppShell
      title="Agents"
      subtitle="Roles come from org_users and drive what each person can see"
      active="/admin/agents"
    >
      <Card>
        <CardContent className="flex flex-col p-0">
          {snapshot.users.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-3 border-b border-border/60 p-3 last:border-0"
            >
              <Avatar>
                <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.displayName}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {user.authUserId}
                </div>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {formatDateTime(user.createdAt)}
              </span>
              <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Invites are not wired up yet — roles are assigned by inserting rows into{" "}
        <code>org_users</code>. The RLS policies in <code>supabase/rls.sql</code> enforce these
        roles, but they only take effect once requests use a signed-in user&apos;s token instead of
        the service role key.
      </p>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
