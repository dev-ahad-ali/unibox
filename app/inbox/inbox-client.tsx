"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Inbox as InboxIcon } from "lucide-react";
import { type Socket } from "socket.io-client";

import { Composer } from "@/components/composer";
import { PlatformBadge, PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusDot } from "@/components/ui/status-dot";
import { formatDateTime, formatTime, initials } from "@/lib/format";
import { isWithinServiceWindow, serviceWindowHoursLeft } from "@/lib/service-window";
import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import {
  platforms,
  type Channel,
  type Conversation,
  type InternalNote,
  type Message,
  type OrgUser,
  type Platform
} from "@/lib/types";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" }
] as const;

type Bundle = { messages: Message[]; notes: InternalNote[] };

export type InboxInitialData = {
  conversations: Conversation[];
  channels: Channel[];
  users: OrgUser[];
  activeConversationId: string | null;
  initialBundle: Bundle | null;
  initialStatus?: string;
  initialPlatform?: Platform;
  canReply: boolean;
};

function syncUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  // Next's App Router picks this up without a server round trip — which is the
  // whole point: filters and selection are client state, the URL just mirrors
  // them so views stay shareable.
  window.history.replaceState(null, "", query ? `/inbox?${query}` : "/inbox");
}

function upsertConversation(list: Conversation[], conversation: Conversation) {
  const rest = list.filter(entry => entry.id !== conversation.id);
  return [conversation, ...rest];
}

function sortByActivity(list: Conversation[]) {
  return [...list].sort((left, right) =>
    (right.lastMessageAt ?? right.createdAt).localeCompare(left.lastMessageAt ?? left.createdAt)
  );
}

export function InboxClient({ initial }: Readonly<{ initial: InboxInitialData }>) {
  const [conversations, setConversations] = useState(initial.conversations);
  const [channels] = useState(initial.channels);
  const [users] = useState(initial.users);
  const [status, setStatus] = useState<string | undefined>(initial.initialStatus);
  const [platform, setPlatform] = useState<Platform | undefined>(initial.initialPlatform);
  const [activeId, setActiveId] = useState(initial.activeConversationId);
  const [bundles, setBundles] = useState<Record<string, Bundle>>(() =>
    initial.activeConversationId && initial.initialBundle
      ? { [initial.activeConversationId]: initial.initialBundle }
      : {}
  );
  const [bundleLoading, setBundleLoading] = useState(false);

  // The socket handlers read current state; a ref avoids re-subscribing the
  // socket on every state change.
  const stateRef = useRef({ conversations, bundles, activeId });
  stateRef.current = { conversations, bundles, activeId };

  const channelById = useMemo(() => new Map(channels.map(entry => [entry.id, entry])), [channels]);
  const usersById = useMemo(() => new Map(users.map(entry => [entry.id, entry])), [users]);

  const fetchBundle = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as Bundle & { conversation?: Conversation };
      setBundles(prev => ({
        ...prev,
        [conversationId]: { messages: data.messages ?? [], notes: data.notes ?? [] }
      }));
      if (data.conversation) {
        setConversations(prev => sortByActivity(upsertConversation(prev, data.conversation!)));
      }
    } catch {
      // Network hiccup: the next socket event or manual switch retries.
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { conversations?: Conversation[] };
      if (data.conversations) {
        setConversations(sortByActivity(data.conversations));
      }
    } catch {
      // Same: transient failures resolve on the next event.
    }
  }, []);

  const selectConversation = useCallback(
    (conversationId: string) => {
      setActiveId(conversationId);
      syncUrl({ conversation: conversationId, status, platform });
      if (!stateRef.current.bundles[conversationId]) {
        setBundleLoading(true);
        void fetchBundle(conversationId).finally(() => setBundleLoading(false));
      }
    },
    [status, platform, fetchBundle]
  );

  // Live updates. The org room is server-assigned from the access token.
  useEffect(() => {
    let client: Socket | null = null;
    let cancelled = false;

    const onNewMessage = (payload: { conversationId?: string; message?: Message }) => {
      const { conversationId, message } = payload ?? {};
      if (!conversationId || !message) {
        return;
      }

      setBundles(prev => {
        const bundle = prev[conversationId];
        if (!bundle || bundle.messages.some(entry => entry.id === message.id)) {
          return prev;
        }
        return { ...prev, [conversationId]: { ...bundle, messages: [...bundle.messages, message] } };
      });

      const known = stateRef.current.conversations.find(entry => entry.id === conversationId);
      if (known) {
        setConversations(prev =>
          sortByActivity(
            prev.map(entry =>
              entry.id === conversationId
                ? {
                    ...entry,
                    lastMessageAt: message.createdAt,
                    lastInboundAt:
                      message.direction === "inbound" ? message.createdAt : entry.lastInboundAt
                  }
                : entry
            )
          )
        );
      } else {
        // A conversation we have never seen — a brand-new contact. The list
        // endpoint applies RLS, so this also quietly drops events for threads
        // this agent is not allowed to see.
        void refreshList();
      }
    };

    const onConversationUpdated = (payload: { conversationId?: string }) => {
      void refreshList();
      if (payload?.conversationId && payload.conversationId === stateRef.current.activeId) {
        void fetchBundle(payload.conversationId);
      }
    };

    const onMessageStatus = (payload: { platformMessageId?: string; status?: Message["status"] }) => {
      const { platformMessageId, status: nextStatus } = payload ?? {};
      if (!platformMessageId || !nextStatus) {
        return;
      }
      setBundles(prev => {
        let changed = false;
        const next: Record<string, Bundle> = {};
        for (const [conversationId, bundle] of Object.entries(prev)) {
          const messages = bundle.messages.map(entry => {
            if (entry.platformMessageId === platformMessageId && entry.status !== nextStatus) {
              changed = true;
              return { ...entry, status: nextStatus };
            }
            return entry;
          });
          next[conversationId] = changed ? { ...bundle, messages } : bundle;
        }
        return changed ? next : prev;
      });
    };

    void getSocket().then(instance => {
      if (cancelled) {
        return;
      }
      client = instance;
      client.on("new_message", onNewMessage);
      client.on("conversation_updated", onConversationUpdated);
      client.on("message_status", onMessageStatus);
    });

    return () => {
      cancelled = true;
      client?.off("new_message", onNewMessage);
      client?.off("conversation_updated", onConversationUpdated);
      client?.off("message_status", onMessageStatus);
    };
  }, [fetchBundle, refreshList]);

  const visibleConversations = useMemo(
    () =>
      conversations.filter(conversation => {
        if (status && conversation.status !== status) {
          return false;
        }
        if (platform) {
          return channelById.get(conversation.channelId)?.platform === platform;
        }
        return true;
      }),
    [conversations, status, platform, channelById]
  );

  const selectedConversation = conversations.find(entry => entry.id === activeId) ?? null;
  const selectedChannel = selectedConversation
    ? (channelById.get(selectedConversation.channelId) ?? null)
    : null;
  const activeBundle = (activeId ? bundles[activeId] : null) ?? null;
  const messages = activeBundle?.messages ?? [];
  const notes = activeBundle?.notes ?? [];

  const assignedAgent = selectedConversation?.assignedAgentId
    ? usersById.get(selectedConversation.assignedAgentId)
    : undefined;

  // WhatsApp only allows free-form replies for 24 hours after the customer's
  // last message. Agents need to see that before they type, not after the send
  // fails.
  const isWhatsApp = selectedChannel?.platform === "whatsapp";
  const windowOpen = isWithinServiceWindow(selectedConversation?.lastInboundAt);
  const hoursLeft = serviceWindowHoursLeft(selectedConversation?.lastInboundAt);

  const onSent = useCallback((message: Message) => {
    const conversationId = message.conversationId;
    setBundles(prev => {
      const bundle = prev[conversationId];
      if (!bundle || bundle.messages.some(entry => entry.id === message.id)) {
        return prev;
      }
      return { ...prev, [conversationId]: { ...bundle, messages: [...bundle.messages, message] } };
    });
    setConversations(prev =>
      sortByActivity(
        prev.map(entry =>
          entry.id === conversationId ? { ...entry, lastMessageAt: message.createdAt } : entry
        )
      )
    );
  }, []);

  const setStatusFilter = (value?: string) => {
    setStatus(value);
    syncUrl({ conversation: activeId ?? undefined, status: value, platform });
  };

  const setPlatformFilter = (value?: Platform) => {
    setPlatform(value);
    syncUrl({ conversation: activeId ?? undefined, status, platform: value });
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
      {/* Conversation list */}
      <aside className="flex min-h-0 flex-col border-r border-border">
        <div className="flex flex-wrap gap-1 border-b border-border p-2">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.label}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                status === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border p-2">
          <button
            type="button"
            onClick={() => setPlatformFilter(undefined)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              !platform
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            All channels
          </button>
          {platforms.map(entry => (
            <button
              key={entry}
              type="button"
              onClick={() => setPlatformFilter(entry)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                platform === entry
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <PlatformIcon platform={entry} className="size-3" />
              {platformLabel(entry)}
            </button>
          ))}
        </div>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          {visibleConversations.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No conversations match this filter.</p>
          ) : (
            visibleConversations.map(conversation => {
              const channel = channelById.get(conversation.channelId);
              const isActive = conversation.id === selectedConversation?.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={cn(
                    "flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors",
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
                </button>
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
                  <span className="truncate">{selectedChannel?.displayName ?? "Unknown channel"}</span>
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
              {bundleLoading && messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading thread…</p>
              ) : messages.length === 0 ? (
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
              {isWhatsApp && initial.canReply ? (
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
              {initial.canReply ? (
                <Composer
                  conversationId={selectedConversation.id}
                  disabled={isWhatsApp && !windowOpen}
                  onSent={onSent}
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
              Conversations appear here once a webhook arrives, or once you seed a row in Supabase.
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
          <p className="text-xs text-muted-foreground">Select a conversation to see contact details.</p>
        )}
      </aside>
    </div>
  );
}
