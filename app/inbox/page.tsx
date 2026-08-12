import Link from "next/link";
import { Clock, Inbox as InboxIcon } from "lucide-react";

import { AppShell } from "@/components/shell";
import { Composer } from "@/components/composer";
import { SocketStatus } from "@/components/socket-status";
import { PlatformBadge, PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusDot } from "@/components/ui/status-dot";
import { getConversationBundle, getSnapshot, summarizeInbox } from "@/lib/store";
import { canReply, requireSession } from "@/lib/auth";
import { formatDateTime, formatTime, initials } from "@/lib/format";
import { isWithinServiceWindow, serviceWindowHoursLeft } from "@/lib/service-window";
import { cn } from "@/lib/utils";
import { isPlatform, platforms, type Message } from "@/lib/types";

type InboxPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" }
] as const;

function getParamValue(param?: string | string[]) {
  return typeof param === "string" ? param : undefined;
}

function buildHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `/inbox?${query}` : "/inbox";
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = (await searchParams) ?? {};
  const platform = getParamValue(params.platform);
  const status = getParamValue(params.status);
  const activeConversationId = getParamValue(params.conversation);

  const session = await requireSession("/inbox");
  const { db, member, organization } = session;

  const activePlatform = isPlatform(platform) ? platform : undefined;
  const [snapshot, summary] = await Promise.all([
    getSnapshot(db, member.orgId, activePlatform),
    summarizeInbox(db, member.orgId)
  ]);

  const visibleConversations = snapshot.conversations.filter(
    conversation => !status || conversation.status === status
  );

  const bundle =
    (activeConversationId
      ? await getConversationBundle(db, member.orgId, activeConversationId)
      : null) ?? (await getConversationBundle(db, member.orgId, visibleConversations[0]?.id ?? ""));

  const selectedConversation = bundle?.conversation ?? null;
  const selectedChannel = bundle?.channel ?? null;
  const messages = (bundle?.messages ?? []) as Message[];
  const notes = bundle?.notes ?? [];
  const usersById = new Map((bundle?.users ?? []).map(user => [user.id, user]));
  const channelById = new Map(snapshot.channels.map(channel => [channel.id, channel]));

  const assignedAgent = selectedConversation?.assignedAgentId
    ? usersById.get(selectedConversation.assignedAgentId)
    : undefined;

  // WhatsApp only allows free-form replies for 24 hours after the customer's
  // last message. Agents need to see that before they type, not after the send
  // fails.
  const isWhatsApp = selectedChannel?.platform === "whatsapp";
  const windowOpen = isWithinServiceWindow(selectedConversation?.lastInboundAt);
  const hoursLeft = serviceWindowHoursLeft(selectedConversation?.lastInboundAt);

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
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* Conversation list */}
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            {STATUS_FILTERS.map(filter => (
              <Link
                key={filter.label}
                href={buildHref({ status: filter.value, platform })}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  status === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {filter.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            <Link
              href={buildHref({ status })}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                !activePlatform
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              All channels
            </Link>
            {platforms.map(entry => (
              <Link
                key={entry}
                href={buildHref({ status, platform: entry })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                  activePlatform === entry
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <PlatformIcon platform={entry} className="size-3" />
                {platformLabel(entry)}
              </Link>
            ))}
          </div>

          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
            {visibleConversations.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">
                No conversations match this filter.
              </p>
            ) : (
              visibleConversations.map(conversation => {
                const channel = channelById.get(conversation.channelId);
                const isActive = conversation.id === selectedConversation?.id;

                return (
                  <Link
                    key={conversation.id}
                    href={buildHref({ conversation: conversation.id, status, platform })}
                    className={cn(
                      "flex gap-3 border-b border-border/60 px-3 py-3 transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-secondary/50"
                    )}
                  >
                    <Avatar>
                      {conversation.contactAvatarUrl ? (
                        <AvatarImage src={conversation.contactAvatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback>{initials(conversation.contactName)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {conversation.contactName}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <PlatformIcon platform={channel?.platform} className="size-3" />
                        <span className="truncate text-xs text-muted-foreground">
                          {conversation.externalContactId}
                        </span>
                        <StatusDot status={conversation.status} className="ml-auto" />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-h-0 flex-col">
          {selectedConversation ? (
            <>
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {selectedConversation.contactName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <PlatformIcon platform={selectedChannel?.platform} className="size-3" />
                    <span className="truncate">
                      {selectedChannel?.displayName ?? "Unknown channel"}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={
                    selectedConversation.status === "open"
                      ? "success"
                      : selectedConversation.status === "pending"
                        ? "warning"
                        : "outline"
                  }
                >
                  {selectedConversation.status}
                </Badge>
              </div>

              <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No messages in this thread yet.</p>
                ) : (
                  messages.map(message => (
                    <article
                      key={message.id}
                      className={cn(
                        "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                        message.direction === "outbound"
                          ? "self-end bg-primary text-primary-foreground"
                          : "self-start border border-border bg-card"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.body ?? message.mediaType ?? "Attachment"}
                      </p>
                      {message.mediaUrl ? (
                        <a
                          href={message.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs underline underline-offset-2 opacity-80"
                        >
                          View attachment
                        </a>
                      ) : null}
                      <div
                        className={cn(
                          "mt-1 text-[11px]",
                          message.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDateTime(message.createdAt)} · {message.status}
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-border p-3">
                {isWhatsApp && canReply(member.role) ? (
                  <div
                    className={cn(
                      "mb-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                      windowOpen
                        ? "border-border text-muted-foreground"
                        : "border-warning/30 bg-warning/10 text-warning"
                    )}
                  >
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    {windowOpen
                      ? `WhatsApp service window open — about ${hoursLeft}h left for free-form replies.`
                      : "WhatsApp service window closed — only an approved template can be sent until the customer replies."}
                  </div>
                ) : null}
                {canReply(member.role) ? (
                  <Composer
                    conversationId={selectedConversation.id}
                    disabled={isWhatsApp && !windowOpen}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Your role is read-only, so replies are disabled.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <InboxIcon className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No conversation selected</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Conversations appear here once a webhook arrives, or once you seed a row in
                Supabase.
              </p>
            </div>
          )}
        </section>

        {/* Contact details */}
        <aside className="scrollbar-slim hidden min-h-0 overflow-y-auto border-l border-border p-4 xl:block">
          {selectedConversation ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact
                </h2>
                <div className="mt-2 flex items-center gap-2.5">
                  <Avatar className="size-10">
                    {selectedConversation.contactAvatarUrl ? (
                      <AvatarImage src={selectedConversation.contactAvatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(selectedConversation.contactName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {selectedConversation.contactName}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {selectedConversation.externalContactId}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <dl className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Channel</dt>
                  <dd>
                    <PlatformBadge platform={selectedChannel?.platform} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Assigned</dt>
                  <dd className="truncate">{assignedAgent?.displayName ?? "Unassigned"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Last inbound</dt>
                  <dd>
                    {selectedConversation.lastInboundAt
                      ? formatDateTime(selectedConversation.lastInboundAt)
                      : "—"}
                  </dd>
                </div>
              </dl>

              <Separator />

              <div>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal notes
                </h2>
                <div className="mt-2 flex flex-col gap-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No notes yet. Notes stay internal and are never sent to the customer.
                    </p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="rounded-md border border-border p-2.5">
                        <p className="text-xs leading-relaxed">{note.body}</p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {usersById.get(note.authorId)?.displayName ?? "Unknown"} ·{" "}
                          {formatDateTime(note.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select a conversation to see contact details.
            </p>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
