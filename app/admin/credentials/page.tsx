import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";

import { MetaCredentialsForm, RemoveCredentialsButton } from "./form";
import { AppShell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { appUrl } from "@/lib/app-url";
import { META_CALLBACK_PATH } from "@/lib/adapters/meta-connect";
import { requireRole } from "@/lib/auth";
import { isEncryptionConfigured } from "@/lib/crypto";
import { getMetaCredentialsSummary } from "@/lib/meta-app";
import { formatDateTime } from "@/lib/format";

function getParam(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

export default async function CredentialsPage({
  searchParams
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const session = await requireRole(["admin"], "/admin/credentials");
  const { member, organization } = session;

  const params = (await searchParams) ?? {};
  const errorMessage = getParam(params.error);

  const summary = await getMetaCredentialsSummary(member.orgId);
  const configured = Boolean(summary.appId && summary.hasAppSecret);

  // Webhook callbacks name the workspace, so Meta's verification GET — which
  // carries no account id — resolves to exactly one org's verify token.
  const webhookUrl = (platform: string) =>
    appUrl(`/api/webhooks/${platform}?org=${member.orgId}`);

  return (
    <AppShell
      title="Credentials"
      subtitle="The Meta developer app this workspace connects through"
      active="/admin/credentials"
      viewer={{
        displayName: member.displayName,
        role: member.role,
        organizationName: organization.name,
        isDemo: session.isDemo
      }}
      actions={
        <Badge variant={configured ? "success" : "warning"}>
          {configured ? "Configured" : "Not configured"}
        </Badge>
      }
    >
      <div className="flex max-w-3xl flex-col gap-6">
        {errorMessage ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {isEncryptionConfigured() ? null : (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            APP_ENCRYPTION_KEY is not set, so secrets cannot be stored. Generate one with{" "}
            <code>openssl rand -hex 32</code>.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden />
              Meta app
            </CardTitle>
            <CardDescription>
              Messenger, Instagram, and WhatsApp all run through one Meta developer app. Enter your
              app&apos;s details here once and this workspace connects accounts through it — no
              environment variables, no redeploy. Secrets are encrypted before they are stored and
              are never shown back to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {summary.fromEnvironment ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
                This workspace is currently falling back to the deployment&apos;s own Meta app. Save
                your own credentials below to take it over — everything already connected keeps
                working.
              </p>
            ) : null}

            <MetaCredentialsForm summary={summary} />

            {summary.updatedAt ? (
              <p className="text-[11px] text-muted-foreground">
                Last updated {formatDateTime(summary.updatedAt)}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paste these into Meta</CardTitle>
            <CardDescription>
              Your workspace&apos;s own addresses. The <code>org</code> parameter is what tells
              Unibox which app secret to check a delivery against, so use these rather than the bare
              paths.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CopyField
              label="Valid OAuth redirect URI"
              value={appUrl(META_CALLBACK_PATH)}
              hint="Facebook Login → Settings. Required before Connect with Meta will work."
            />
            <CopyField
              label="Messenger webhook"
              value={webhookUrl("messenger")}
              hint="Subscribe to messages, messaging_postbacks, message_deliveries, message_reads."
            />
            <CopyField
              label="Instagram webhook"
              value={webhookUrl("instagram")}
              hint="Subscribe to messages and messaging_postbacks."
            />
            <CopyField
              label="WhatsApp webhook"
              value={webhookUrl("whatsapp")}
              hint="Subscribe to the messages field — it carries both inbound messages and receipts."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where these values come from</CardTitle>
            <CardDescription>
              The setup guide walks through creating the Meta app and finding each value, with
              screens and troubleshooting for every platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link
              href="/setup"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Open the setup guide
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <span className="text-xs text-muted-foreground">
              · LINE and Telegram need nothing here — their secrets live on the channel.
            </span>
          </CardContent>
        </Card>

        {configured && !summary.fromEnvironment ? (
          <div className="border-t border-border pt-4">
            <RemoveCredentialsButton />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export const dynamic = "force-dynamic";
