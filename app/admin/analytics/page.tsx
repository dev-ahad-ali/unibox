import { AppShell } from "@/components/shell";
import { summarizeInbox } from "@/lib/store";

export default async function AnalyticsPage() {
  const stats = await summarizeInbox();

  return (
    <AppShell
      title="Admin analytics"
      subtitle="A phase-1 analytics surface backed by live counts from the current organization."
    >
      <section className="panel-grid">
        <article className="card stat-card">
          <div className="muted">Open conversations</div>
          <span className="stat-value">{stats.openCount}</span>
          <div className="stat-chart" />
        </article>
        <article className="card stat-card">
          <div className="muted">Pending conversations</div>
          <span className="stat-value">{stats.pendingCount}</span>
          <div className="stat-chart" />
        </article>
        <article className="card stat-card">
          <div className="muted">Inbound messages</div>
          <span className="stat-value">{stats.unreadCount}</span>
          <div className="stat-chart" />
        </article>
      </section>
    </AppShell>
  );
}
