import Link from "next/link";
import type { ReactNode } from "react";

import { DATA_DELETION_PATH, PRIVACY_PATH, TERMS_PATH, legalEntity } from "@/lib/legal";

/**
 * Public shell for the published policies. It deliberately does not use
 * AppShell: these pages have to render for a signed-out Meta reviewer, and
 * AppShell requires a session and an organization.
 */

const LINKS = [
  { href: PRIVACY_PATH, label: "Privacy policy" },
  { href: TERMS_PATH, label: "Terms of service" },
  { href: DATA_DELETION_PATH, label: "Data deletion" }
] as const;

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">Unibox</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-6 py-6 text-xs text-muted-foreground">
          {legalEntity()}
        </div>
      </footer>
    </div>
  );
}
