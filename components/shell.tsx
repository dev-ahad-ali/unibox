import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Inbox, Radio, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/admin/channels", label: "Channels", Icon: Radio },
  { href: "/admin/agents", label: "Agents", Icon: Users },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 }
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  active,
  fullBleed = false,
  children
}: Readonly<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Path of the nav entry to highlight. */
  active?: string;
  /** Inbox uses the full viewport height; content pages scroll normally. */
  fullBleed?: boolean;
  children: ReactNode;
}>) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <nav className="hidden w-52 shrink-0 flex-col border-r border-border bg-card md:flex">
        <Link href="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Unibox</span>
        </Link>

        <div className="flex flex-col gap-0.5 p-2">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active === href
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-auto p-4 text-[11px] leading-relaxed text-muted-foreground">
          Messenger · Instagram · WhatsApp · LINE
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>

        <main
          className={cn(
            "min-h-0 flex-1",
            fullBleed ? "overflow-hidden" : "scrollbar-slim overflow-y-auto p-4 md:p-6"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
