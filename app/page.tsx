import Link from "next/link";
import { AppShell } from "@/components/shell";
import { summarizeInbox } from "@/lib/store";

export default async function HomePage() {
  const stats = await summarizeInbox();

  return (
    <AppShell
      title="Unibox"
      subtitle="A phase-1 starter for a multi-channel support inbox with Supabase-backed storage, live event delivery, and platform adapters for Messenger, Instagram, WhatsApp, and LINE."
    >
      <section className="grid landing-grid">
        <div className="hero">
          <div className="hero-grid">
            <div className="metric">
              <span className="value">{stats.openCount}</span>
              <span className="label">Open conversations</span>
            </div>
            <div className="metric">
              <span className="value">{stats.activeChannels}</span>
              <span className="label">Connected channels</span>
            </div>
            <div className="metric">
              <span className="value">{stats.unreadCount}</span>
              <span className="label">Inbound messages</span>
            </div>
          </div>

          <div>
            <h2>What is in this scaffold</h2>
            <p className="muted">
              The repo now includes a functioning inbox UI, admin screens, webhook endpoints, a send-message API, a Supabase-backed
              repository layer with demo fallback, and the schema/RLS SQL needed to connect the database.
            </p>
          </div>

          <div className="hero-actions">
            <Link className="button primary" href="/inbox">
              Open inbox
            </Link>
            <Link className="button" href="/admin/channels">
              Review channel setup
            </Link>
          </div>
        </div>

        <div className="side-stack">
          <section className="panel">
            <h3>Build slice</h3>
            <ul className="mini-list">
              <li>
                <span>Data model</span>
                <span className="muted">organizations, channels, conversations, messages, notes</span>
              </li>
              <li>
                <span>Realtime</span>
                <span className="muted">Socket.io rooms for org and conversation streams</span>
              </li>
              <li>
                <span>Adapters</span>
                <span className="muted">Meta, WhatsApp BSP, and LINE adapters with platform-specific hooks</span>
              </li>
            </ul>
          </section>

          <section className="panel">
            <h3>Runtime mode</h3>
            <p className="muted">
              If Supabase keys are missing, the app falls back to seeded demo data. With valid keys, it reads from Postgres.
            </p>
            <div className="filters">
              <span className="chip">Demo-ready</span>
              <span className="chip">Phase 1 scaffold</span>
              <span className="chip">Next.js App Router</span>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
