import { AppShell } from "@/components/shell";
import { getDemoSnapshot } from "@/lib/store";

export default async function AgentsPage() {
  const snapshot = await getDemoSnapshot();

  return (
    <AppShell
      title="Admin agents"
      subtitle="Roles are controlled through org_users. Admins can invite, view, and reassign; agents receive only the inbox surfaces they need."
    >
      <section className="panel-grid">
        {snapshot.users.map(user => (
          <article key={user.id} className="card stat-card">
            <div className="row">
              <h3>{user.displayName}</h3>
              <span className="chip">{user.role}</span>
            </div>
            <div className="muted">{user.authUserId}</div>
            <span className="stat-value">{user.displayName.split(" ").map(part => part[0]).join("")}</span>
            <div className="detail-value">Created {new Date(user.createdAt).toLocaleString()}</div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
