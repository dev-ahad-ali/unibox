import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, KeyRound, Layers, ShieldCheck, Users } from "lucide-react";

import { LandingNav } from "@/components/landing/nav";
import { InboxPreview } from "@/components/landing/preview";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { DATA_DELETION_PATH, PRIVACY_PATH, TERMS_PATH } from "@/lib/legal";
import { platforms } from "@/lib/types";

export const metadata: Metadata = {
  title: "Unibox — one inbox for every messaging channel",
  description:
    "Messenger, Instagram, WhatsApp, LINE, and Telegram conversations in a single shared inbox your whole team can answer from."
};

const FEATURES = [
  {
    Icon: Layers,
    title: "One thread per person",
    body: "A contact who writes on WhatsApp and again on Instagram stays two threads, each tied to the account it arrived on, so replies never leave through the wrong door."
  },
  {
    Icon: Users,
    title: "Roles that mean something",
    body: "Admins connect channels, agents reply, viewers read. The rules are enforced in the database, not just hidden in the interface."
  },
  {
    Icon: ShieldCheck,
    title: "Signed webhooks, encrypted tokens",
    body: "Every delivery is checked against the platform's signature before it is stored. Access tokens are encrypted with AES-256-GCM and never shown back to you."
  },
  {
    Icon: KeyRound,
    title: "Bring your own Meta app",
    body: "Enter your own app id and secret once and your workspace connects through it. No environment variables, no redeploy, no shared credentials."
  }
] as const;

const STEPS = [
  {
    title: "Create a workspace",
    body: "Register, name your workspace, and invite the people who will be answering."
  },
  {
    title: "Connect your accounts",
    body: "One click for Meta, or paste a token for LINE and Telegram. The setup guide walks through every dashboard."
  },
  {
    title: "Answer from one place",
    body: "New messages land in the shared inbox in real time. Assign, reply, and leave notes your contacts never see."
  }
] as const;

export default async function LandingPage() {
  const session = await getSession();
  const signedIn = Boolean(session);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LandingNav signedIn={signedIn} />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          {/* A single soft wash behind the hero, so the primary reads as light
              rather than as another filled surface. */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-primary/10 blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div className="flex flex-col items-start gap-6">
              <Badge variant="outline">Five platforms, one inbox</Badge>

              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Every customer message,
                <br className="hidden sm:block" /> in one place.
              </h1>

              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Unibox collects Messenger, Instagram, WhatsApp, LINE, and Telegram conversations into
                a single shared inbox. Your team answers from one screen instead of five tabs, and
                nobody has to remember which phone the last reply went out from.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {signedIn ? (
                  <Button asChild size="lg">
                    <Link href="/dashboard">
                      Go to dashboard
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg">
                    <Link href="/signup">
                      Create a workspace
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline">
                  {/* The setup guide is org-scoped and needs a session, so a
                      visitor is sent down the page instead. */}
                  <Link href={signedIn ? "/setup" : "#how"}>
                    {signedIn ? "Read the setup guide" : "See how it works"}
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Connect an account in about ten minutes. No card required.
              </p>
            </div>

            <InboxPreview />
          </div>
        </section>

        <section id="channels" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-6 py-12">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Works with
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {platforms.map(platform => (
                <span
                  key={platform}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <PlatformIcon platform={platform} />
                  {platformLabel(platform)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              Built for teams that answer, not just watch
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(feature => (
                <Card key={feature.title}>
                  <CardContent className="flex flex-col gap-2 p-5">
                    <feature.Icon className="size-5 text-primary" aria-hidden />
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <h2 className="max-w-lg text-2xl font-semibold tracking-tight">
              {signedIn ? "Your inbox is waiting." : "Stop answering from five tabs."}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {signedIn
                ? "Pick up where you left off, or connect another channel from the setup guide."
                : "Create a workspace, connect your first channel, and see how much of the day it gives back."}
            </p>
            <Button asChild size="lg">
              <Link href={signedIn ? "/dashboard" : "/signup"}>
                {signedIn ? "Open dashboard" : "Get started"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            Unibox
          </span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {signedIn ? (
              <Link href="/setup" className="transition-colors hover:text-foreground">
                Setup guide
              </Link>
            ) : null}
            <Link href={PRIVACY_PATH} className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href={TERMS_PATH} className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href={DATA_DELETION_PATH} className="transition-colors hover:text-foreground">
              Data deletion
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export const dynamic = "force-dynamic";
