import { AppShell } from "@/components/shell";
import { getDemoSnapshot } from "@/lib/store";
import { formatDateTime } from "@/lib/format";

export default async function ChannelsPage() {
  const snapshot = await getDemoSnapshot();

  return (
    <AppShell
      title="Admin channels"
      subtitle="Channel records map to the connected social accounts table. The page shows live Postgres rows when Supabase is configured."
    >
      <section className="panel-grid">
        {snapshot.channels.map(channel => (
          <article key={channel.id} className="card stat-card">
            <div className="row">
              <h3>{channel.displayName}</h3>
              <span className={`status-pill status-${channel.status}`}>{channel.status}</span>
            </div>
            <div className="muted">{channel.platform}</div>
            <span className="stat-value">{channel.externalAccountId.slice(-4)}</span>
            <div className="detail-value">Connected {formatDateTime(channel.createdAt)}</div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
