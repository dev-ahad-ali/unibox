import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Inbox, LogOut, Radio, Users } from "lucide-react";

import { signOut } from "@/app/(auth)/login/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const NAV = [
  { href: "/inbox", label: "Inbox", Icon: Inbox, roles: ["admin", "agent", "viewer"] },
  { href: "/admin/channels", label: "Channels", Icon: Radio, roles: ["admin"] },
  { href: "/admin/agents", label: "Agents", Icon: Users, roles: ["admin"] },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3, roles: ["admin", "viewer"] }
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: typeof Inbox;
  roles: readonly Role[];
}>;

export function AppShell({
  title,
  subtitle,
  actions,
  active,
  fullBleed = false,
  viewer,
  children
}: Readonly<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Path of the nav entry to highlight. */
  active?: string;
  /** Inbox uses the full viewport height; content pages scroll normally. */
  fullBleed?: boolean;
  viewer: { displayName: string; role: Role; organizationName: string; isDemo: boolean };
  children: ReactNode;
}>) {
  // Nav is filtered by role so agents never see admin destinations. The pages
  // themselves re-check the role — hiding a link is presentation, not access
  // control.
  const nav = NAV.filter(entry => (entry.roles as readonly Role[]).includes(viewer.role));

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <nav className="hidden w-52 shrink-0 flex-col border-r border-border bg-card md:flex">
        <Link href="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="truncate text-sm font-semibold tracking-tight">
            {viewer.organizationName || "Unibox"}
          </span>
        </Link>

        <div className="flex flex-col gap-0.5 p-2">
          {nav.map(({ href, label, Icon }) => (
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

        <div className="mt-auto border-t border-border p-3">
          {viewer.isDemo ? (
            <p className="mb-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] leading-snug text-warning">
              Demo mode — no Supabase project configured, so nobody is signed in.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px]">
                {initials(viewer.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{viewer.displayName}</div>
              <div className="text-[11px] text-muted-foreground">{viewer.role}</div>
            </div>
            {viewer.isDemo ? null : (
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut />
                </Button>
              </form>
            )}
          </div>
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
