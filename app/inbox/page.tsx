import Link from "next/link";
import { AppShell } from "@/components/shell";
import { Composer } from "@/components/composer";
import { SocketStatus } from "@/components/socket-status";
import { getConversationBundle, getDemoSnapshot, summarizeInbox } from "@/lib/store";
import { formatDateTime, formatTime, initials } from "@/lib/format";
import { isPlatform, type Message } from "@/lib/types";

type InboxPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParamValue(param?: string | string[]) {
    return typeof param === "string" ? param : undefined;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
    const params = (await searchParams) ?? {};
    const platform = getParamValue(params?.platform);
    const status = getParamValue(params?.status);
    const activeConversationId = getParamValue(params?.conversation);
    const snapshot = await getDemoSnapshot(isPlatform(platform) ? platform : undefined);
    const summary = await summarizeInbox();
    const bundle =
        (activeConversationId ? await getConversationBundle(activeConversationId) : null) ??
        (await getConversationBundle(snapshot.conversations[0]?.id ?? ""));

    const selectedConversation = bundle?.conversation ?? null;
    const selectedChannel = bundle?.channel ?? null;
    const messages = (bundle?.messages ?? []) as Message[];
    const channelById = new Map(snapshot.channels.map((channel) => [channel.id, channel]));
    const visibleConversations = snapshot.conversations.filter((conversation) => {
        if (status && conversation.status !== status) {
            return false;
        }
        return true;
    });

    return (
        <AppShell
            title="Inbox"
            subtitle="A live-coupled queue with filters for channel, status, and assignment. It reads from Supabase when configured and falls back to seeded data otherwise."
            actions={<SocketStatus orgId={snapshot.organization.id} />}
        >
            <section className="dashboard">
                <aside className="card conversation-list">
                    <div className="row">
                        <div>
                            <h2>Conversations</h2>
                            <div className="muted">
                                {summary.openCount} open · {summary.pendingCount} pending
                            </div>
                        </div>
                        <Link className="panel-link" href="/admin/channels">
                            Channels
                        </Link>
                    </div>

                    <div className="filters">
                        <Link className="chip" href="/inbox">
                            All
                        </Link>
                        <Link className="chip" href="/inbox?status=open">
                            Open
                        </Link>
                        <Link className="chip" href="/inbox?status=pending">
                            Pending
                        </Link>
                        <Link className="chip" href="/inbox?status=closed">
                            Closed
                        </Link>
                    </div>

                    <div className="conversation-stack">
                        {visibleConversations.map((conversation) => {
                            const channel = channelById.get(conversation.channelId);
                            return (
                                <Link
                                    key={conversation.id}
                                    className={`conversation-item ${conversation.id === selectedConversation?.id ? "active" : ""}`}
                                    href={`/inbox?conversation=${conversation.id}${status ? `&status=${status}` : ""}${platform ? `&platform=${platform}` : ""}`}
                                >
                                    <div className="avatar">
                                        {initials(conversation.contactName)}
                                    </div>
                                    <div>
                                        <div className="conversation-meta">
                                            <div>
                                                <div className="conversation-title">
                                                    {conversation.contactName}
                                                </div>
                                                <div className="conversation-snippet">
                                                    {channel?.platform ?? "unknown"} ·{" "}
                                                    {conversation.externalContactId}
                                                </div>
                                            </div>
                                            <span
                                                className={`status-pill status-${conversation.status}`}
                                            >
                                                {conversation.status}
                                            </span>
                                        </div>
                                        <div
                                            className="conversation-snippet"
                                            style={{ marginTop: 8 }}
                                        >
                                            {formatTime(conversation.lastMessageAt)}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </aside>

                <section className="card thread">
                    {selectedConversation ? (
                        <>
                            <div className="thread-header">
                                <div className="conversation-topline">
                                    <div>
                                        <h2>{selectedConversation.contactName}</h2>
                                        <div className="thread-meta">
                                            {selectedChannel?.displayName ?? "Unknown channel"} · updated{" "}
                                            {formatTime(selectedConversation.lastMessageAt)}
                                        </div>
                                    </div>
                                    <span className={`status-pill status-${selectedConversation.status}`}>
                                        {selectedConversation.status}
                                    </span>
                                </div>
                            </div>

                            <div className="thread-scroll">
                                {messages.map((message) => (
                                    <article key={message.id} className={`message ${message.direction}`}>
                                        <div>{message.body ?? message.mediaType ?? "Attachment"}</div>
                                        <span className="stamp">
                                            {formatDateTime(message.createdAt)} · {message.senderType}
                                        </span>
                                    </article>
                                ))}
                            </div>

                            <div className="composer">
                                <Composer conversationId={selectedConversation.id} />
                            </div>
                        </>
                    ) : (
                        <div className="thread-scroll">
                            <article className="message system">
                                <div>No conversation is available yet for this organization.</div>
                                <span className="stamp">
                                    Add a seed conversation in Supabase, or send a webhook payload to create one automatically.
                                </span>
                            </article>
                        </div>
                    )}
                </section>

                <aside className="card sidebar">
                    <h3>Conversation details</h3>
                    {selectedConversation ? (
                        <div className="details-grid">
                            <div className="detail-card">
                                <span className="detail-label">Contact</span>
                                <div>{selectedConversation.contactName}</div>
                                <div className="detail-value">
                                    {selectedConversation.externalContactId}
                                </div>
                            </div>
                            <div className="detail-card">
                                <span className="detail-label">Channel</span>
                                <div>{selectedChannel?.platform ?? "n/a"}</div>
                                <div className="detail-value">
                                    {selectedChannel?.displayName ?? "No channel resolved"}
                                </div>
                            </div>
                            <div className="detail-card">
                                <span className="detail-label">Assignments</span>
                                <div>
                                    {selectedConversation.assignedAgentId ? "Assigned" : "Unassigned"}
                                </div>
                                <div className="detail-value">
                                    Phase 1 keeps assignment read-only in the demo store.
                                </div>
                            </div>
                            <div className="detail-card">
                                <span className="detail-label">Internal notes</span>
                                <div className="detail-value">
                                    Notes are persisted in Postgres and map to the `internal_notes`
                                    table.
                                </div>
                                <Link className="button" href="/admin/agents">
                                    Manage agents
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="detail-card">
                            <span className="detail-label">Setup needed</span>
                            <div className="detail-value">
                                The inbox route is reachable. It just needs at least one conversation row to show a thread.
                            </div>
                        </div>
                    )}
                </aside>
            </section>
        </AppShell>
    );
}
