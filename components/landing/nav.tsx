import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Landing page navigation. The right-hand side is the only part that changes
 * with auth state: a visitor gets Log in and Register, someone already signed
 * in gets a way back into the product.
 */

// Anchors rather than routes: /setup needs a session, so a visitor following it
// would only reach the login page.
const SECTIONS = [
  { href: "#channels", label: "Channels" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" }
] as const;

export function LandingNav({ signedIn }: Readonly<{ signedIn: boolean }>) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Unibox</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {SECTIONS.map(section => (
            <Link
              key={section.href}
              href={section.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                Dashboard
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
