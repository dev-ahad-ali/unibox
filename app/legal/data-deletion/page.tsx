import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, HelpCircle } from "lucide-react";

import { Bullets, LegalPage, P, Section } from "@/components/legal/prose";
import { PRIVACY_PATH, legalEntity, privacyEmail } from "@/lib/legal";
import { formatDateTime } from "@/lib/format";
import { findDeletionRequest } from "@/lib/store";
import { createServiceClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Data deletion · Unibox",
  description: "How to have your data deleted from Unibox, and how to check on a request."
};

function getParam(value?: string | string[]) {
  return typeof value === "string" ? value.trim() : undefined;
}

/**
 * The status panel Meta's deletion callback links to. The confirmation code is
 * the only credential involved: it is 128 random bits, handed to one requester,
 * and reveals nothing beyond the outcome of their own request.
 */
async function DeletionStatus({ code }: Readonly<{ code: string }>) {
  const record = await findDeletionRequest(createServiceClient(), code);

  if (!record) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
          No request found for that code
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Check that the code was copied in full. Codes are 32 characters. If it still does not
          resolve, write to{" "}
          <a className="text-primary underline underline-offset-2" href={`mailto:${privacyEmail()}`}>
            {privacyEmail()}
          </a>{" "}
          and quote it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-4 text-success" aria-hidden />
        Request completed
      </div>
      <dl className="grid gap-1.5 text-[13px] text-muted-foreground sm:grid-cols-[10rem_1fr]">
        <dt>Confirmation code</dt>
        <dd className="font-mono text-xs">{record.code}</dd>
        <dt>Received</dt>
        <dd>{record.requestedAt ? formatDateTime(record.requestedAt) : "Not recorded"}</dd>
        <dt>Outcome</dt>
        <dd>
          {record.status === "completed"
            ? `${record.conversationsDeleted} conversation${
                record.conversationsDeleted === 1 ? "" : "s"
              } and every message, attachment reference, and note inside them were deleted.`
            : "No data was held under that identifier, so there was nothing to delete."}
        </dd>
      </dl>
    </div>
  );
}

export default async function DataDeletionPage({
  searchParams
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const code = getParam(params.code);
  const entity = legalEntity();
  const email = privacyEmail();

  return (
    <LegalPage
      title="Data deletion"
      intro="How to have data about you deleted from Unibox, whichever side of a conversation you are on."
    >
      {code ? <DeletionStatus code={code} /> : null}

      <Section title="If you messaged a business that uses Unibox">
        <P>
          The conversation belongs to that business, not to {entity}. We store it on their behalf.
          You have two routes, and either works.
        </P>
        <Bullets
          items={[
            <>
              <strong>Ask the business directly.</strong> They can delete the conversation from
              their inbox themselves, which removes it immediately.
            </>,
            <>
              <strong>Remove the app from your account.</strong> On Facebook, go to Settings and
              privacy, then Settings, then Apps and websites, find the business&apos;s app and
              choose Remove. Facebook notifies us automatically and we delete what we hold under
              your identifier for that app. You get a confirmation code and a link back to this page
              to check the outcome.
            </>
          ]}
        />
        <P>
          You can also write to{" "}
          <a className="text-primary underline underline-offset-2" href={`mailto:${email}`}>
            {email}
          </a>
          . Say which business you messaged and on which platform. We reply within 30 days, and we
          pass the request on to the business as well.
        </P>
      </Section>

      <Section title="If you have a Unibox account">
        <P>
          Deleting a channel deletes its conversations, messages, and notes with it. Deleting your
          workspace deletes everything belonging to it, including channel credentials and stored app
          secrets. Both are available in the application under Channels.
        </P>
        <P>
          To have the account itself removed, write to{" "}
          <a className="text-primary underline underline-offset-2" href={`mailto:${email}`}>
            {email}
          </a>{" "}
          from the address you signed up with.
        </P>
      </Section>

      <Section title="What deletion actually removes">
        <Bullets
          items={[
            "The conversation record, including the contact name and profile picture URL stored on it.",
            "Every message in it, inbound and outbound, with their text and attachment references.",
            "Every internal note your team wrote on it.",
            "The sender identifier that linked those records together."
          ]}
        />
        <P>
          Deletion is immediate in the live database. Encrypted backups expire on their own schedule
          and are fully replaced within 30 days. We keep no copy after that.
        </P>
        <P>
          One thing deletion here cannot reach: the copy held by the messaging platform. Meta, LINE,
          and Telegram each retain their own record of a conversation under their own policies, and
          removing data from Unibox does not remove it from them.
        </P>
      </Section>

      <Section title="Checking on a request">
        <P>
          If you were given a confirmation code, add it to this page&apos;s address as
          <code className="mx-1 rounded bg-secondary px-1 py-0.5 font-mono text-xs">?code=</code>
          followed by the code, or use the link you were given. The status appears at the top of the
          page.
        </P>
        <P>
          The{" "}
          <Link className="text-primary underline underline-offset-2" href={PRIVACY_PATH}>
            privacy policy
          </Link>{" "}
          sets out what is stored in the first place.
        </P>
      </Section>
    </LegalPage>
  );
}

export const dynamic = "force-dynamic";
