import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  title,
  subtitle,
  actions,
  children
}: Readonly<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <main className="container">
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">Unified social inbox</div>
          <h1 className="brand-title">{title}</h1>
          {subtitle ? <p className="brand-subtitle">{subtitle}</p> : null}
        </div>
        <div className="toolbar">
          {actions}
          <Link className="chip" href="/inbox">
            Inbox
          </Link>
          <Link className="chip" href="/admin/channels">
            Admin
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}
