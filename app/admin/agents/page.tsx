import { AppShell } from "@/components/shell";
import { InviteForm, RevokeInviteForm, RoleForm } from "./manage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { isInviteUsable, listInvites } from "@/lib/invites";
import { listOrgUsers } from "@/lib/store";
import { formatDateTime, initials } from "@/lib/format";

const ROLE_VARIANT = {
  admin: "default",
  agent: "secondary",
  viewer: "outline"
} as const;

export default async function AgentsPage() {
  const session = await requireRole(["admin"], "/admin/agents");
  const { db, member, organization } = session;

  const [users, invites] = await Promise.all([
    listOrgUsers(db, member.orgId),
    session.isDemo ? Promise.resolve([]) : listInvites(db, member.orgId)
  ]);

  const pendingInvites = invites.filter(isInviteUsable);

  return (
    <AppShell
      title="Agents"
      subtitle="Roles come from org_users and drive what each person can see"
      active="/admin/agents"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
    >
      <div className="flex flex-col gap-6">
        {session.isDemo ? null : <InviteForm />}

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col p-0">
            {users.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-3 border-t border-border/60 p-3 first:border-t-0"
              >
                <Avatar>
                  <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {user.displayName}
                    {user.id === member.id ? (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    Joined {formatDateTime(user.createdAt)}
                  </div>
                </div>
                {session.isDemo ? (
                  <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                ) : (
                  <RoleForm memberId={user.id} role={user.role} disabled={user.id === member.id} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {session.isDemo ? null : (
          <Card>
            <CardHeader>
              <CardTitle>Pending invites</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col p-0">
              {pendingInvites.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No pending invites.</p>
              ) : (
                pendingInvites.map(invite => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 border-t border-border/60 p-3 first:border-t-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{invite.email}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Expires {formatDateTime(invite.expiresAt)}
                      </div>
                    </div>
                    <Badge variant={ROLE_VARIANT[invite.role]}>{invite.role}</Badge>
                    <RevokeInviteForm inviteId={invite.id} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
