import Link from "next/link";
import { ArrowRight, KeyRound, Link2, ShieldCheck, UserCheck } from "lucide-react";

import { AppShell } from "@/components/shell";
import { FlowArt } from "@/components/setup/art";
import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appUrl } from "@/lib/app-url";
import { requireSession } from "@/lib/auth";
import { platforms, type Platform } from "@/lib/types";
import { InstagramGuide, LineGuide, MessengerGuide, TelegramGuide, WhatsAppGuide, type SetupUrls } from "./guides";

const GUIDES: Record<Platform, (props: { urls: SetupUrls }) => React.JSX.Element> = {
  messenger: MessengerGuide,
  instagram: InstagramGuide,
  whatsapp: WhatsAppGuide,
  line: LineGuide,
  telegram: TelegramGuide
};

/** Per-platform blurbs for the picker cards. */
const SUMMARY: Record<Platform, { effort: string; blurb: string }> = {
  messenger: { effort: "15 min · Meta app", blurb: "A Facebook Page plus a Meta developer app. One-click connect." },
  instagram: { effort: "20 min · Meta app", blurb: "Professional account, tester invites, then connect via Page or Instagram Login." },
  whatsapp: { effort: "20 min · Meta app", blurb: "Free test number from the Cloud API. Real number and templates later." },
  line: { effort: "10 min · LINE console", blurb: "Messaging API channel, three values, no review." },
  telegram: { effort: "3 min · no dashboard", blurb: "Chat with @BotFather, paste the token. Done." }
};

const ESSENTIALS = [
  {
    Icon: UserCheck,
    title: "An account the API may speak for",
    body: "A Facebook Page, a professional Instagram account, a WhatsApp Business number, a LINE Official Account, a Telegram bot. Personal profiles have no messaging API anywhere."
  },
  {
    Icon: Link2,
    title: "A webhook that is registered and subscribed",
    body: "The platform must know Unibox's address and be told which events to send. On Meta those are two separate clicks."
  },
  {
    Icon: ShieldCheck,
    title: "The signing secret",
    body: "Every delivery is signed. Unibox refuses anything it cannot verify, so the secret has to be stored — on the channel, or in the deployment's environment."
  },
  {
    Icon: KeyRound,
    title: "A channel whose id matches the payload",
    body: "Page id, phone number id, bot user id — never a @handle. Unibox routes each message to a channel by this id."
  }
] as const;

function pickPlatform(value?: string | string[]): Platform {
  const candidate = typeof value === "string" ? value : undefined;
  return (platforms as readonly string[]).includes(candidate ?? "") ? (candidate as Platform) : "messenger";
}

export default async function SetupPage({
  searchParams
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const session = await requireSession("/setup");
  const { member, organization } = session;
  const params = (await searchParams) ?? {};
  const initial = pickPlatform(params.platform);

  const urls: SetupUrls = {
    messenger: appUrl("/api/webhooks/messenger"),
    instagram: appUrl("/api/webhooks/instagram"),
    whatsapp: appUrl("/api/webhooks/whatsapp"),
    line: appUrl("/api/webhooks/line"),
    telegram: appUrl("/api/webhooks/telegram"),
    metaCallback: appUrl("/admin/channels/connect/meta/callback")
  };

  return (
    <AppShell
      title="Setup guide"
      subtitle="Everything to do on each platform before you press Connect"
      active="/setup"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
      actions={
        member.role === "admin" ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/channels">
              Channels
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              Connect a channel in three moves
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every platform works the same way underneath: a customer messages your business account, the platform
              posts that message to Unibox over a <strong className="text-foreground">webhook</strong>, and your reply
              goes back through the platform's API. Setup is just telling the platform where Unibox is, proving it is
              really you, and giving Unibox the credentials to reply.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pick a platform below. Each guide takes you from nothing to a message in the inbox, with the exact values
              to copy and where each one goes.
            </p>
          </div>
          <FlowArt />
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            The four things every channel needs
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {ESSENTIALS.map(({ Icon, title, body }) => (
              <Card key={title}>
                <CardContent className="flex gap-3 p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold leading-tight">{title}</div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Tabs defaultValue={initial} className="gap-6">
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Choose a platform
            </h3>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-3 lg:grid-cols-5">
              {platforms.map(platform => (
                <TabsTrigger
                  key={platform}
                  value={platform}
                  className="flex h-auto flex-col items-start gap-1 whitespace-normal rounded-lg border border-border bg-card px-3 py-3 text-left shadow-xs data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:ring-1 data-[state=active]:ring-primary/40"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <PlatformIcon platform={platform} className="size-4 text-current" />
                    {platformLabel(platform)}
                  </span>
                  <span className="text-[11px] font-medium text-primary">{SUMMARY[platform].effort}</span>
                  <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                    {SUMMARY[platform].blurb}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {platforms.map(platform => {
            const Guide = GUIDES[platform];
            return (
              <TabsContent key={platform} value={platform}>
                <Card>
                  <CardContent className="p-5 md:p-8">
                    <Guide urls={urls} />
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
