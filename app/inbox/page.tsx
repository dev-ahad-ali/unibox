import { AppShell } from "@/components/shell";
import { SocketStatus } from "@/components/socket-status";
import { getConversationBundle, getInboxLists, summarizeInbox } from "@/lib/store";
import { canReply, requireSession } from "@/lib/auth";
import { isPlatform } from "@/lib/types";
import { InboxClient } from "./inbox-client";

type InboxPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParamValue(param?: string | string[]) {
  return typeof param === "string" ? param : undefined;
}

/**
 * Server side of the inbox: resolve the session, fetch the first snapshot, and
 * hand everything to the client component. After this render, filters,
 * conversation switches, and live updates are client state — the server is only
 * consulted again for thread bundles and list refreshes over the API routes.
 */
export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = (await searchParams) ?? {};
  const platform = getParamValue(params.platform);
  const status = getParamValue(params.status);
  const requestedConversationId = getParamValue(params.conversation);

  const session = await requireSession("/inbox");
  const { db, member, organization } = session;

  const activePlatform = isPlatform(platform) ? platform : undefined;
  const [snapshot, summary] = await Promise.all([
    getInboxLists(db, member.orgId),
    summarizeInbox(db, member.orgId)
  ]);

  // Deep links select the requested conversation; otherwise the newest one
  // that survives the initial filters, mirroring what the list will show.
  const visibleConversations = snapshot.conversations.filter(conversation => {
    if (status && conversation.status !== status) {
      return false;
    }
    if (activePlatform) {
      const channel = snapshot.channels.find(entry => entry.id === conversation.channelId);
      return channel?.platform === activePlatform;
    }
    return true;
  });

  const initialConversationId = requestedConversationId ?? visibleConversations[0]?.id;
  const bundle = initialConversationId
    ? await getConversationBundle(db, member.orgId, initialConversationId)
    : null;

  return (
    <AppShell
      title="Inbox"
      subtitle={`${summary.openCount} open · ${summary.pendingCount} pending · ${summary.activeChannels} channels connected`}
      active="/inbox"
      fullBleed
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
      actions={<SocketStatus orgId={member.orgId} />}
    >
      <InboxClient
        initial={{
          conversations: snapshot.conversations,
          channels: snapshot.channels,
          users: snapshot.users,
          activeConversationId: bundle?.conversation.id ?? null,
          initialBundle: bundle ? { messages: bundle.messages, notes: bundle.notes } : null,
          initialStatus: status,
          initialPlatform: activePlatform,
          canReply: canReply(member.role)
        }}
      />
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
