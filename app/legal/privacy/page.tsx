import type { Metadata } from "next";
import Link from "next/link";

import { Bullets, DataTable, LegalPage, P, Section } from "@/components/legal/prose";
import {
  DATA_DELETION_PATH,
  POLICY_EFFECTIVE_DATE,
  TERMS_PATH,
  legalAddress,
  legalEntity,
  privacyEmail
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy · Unibox",
  description:
    "What Unibox stores, why it stores it, and how to have it deleted, including data received from Meta, LINE, and Telegram."
};

const COLLECTED = [
  {
    what: "Your account",
    why: "Signing in, and deciding what you may see in your workspace.",
    source: "You, at sign-up"
  },
  {
    what: "Workspace and role",
    why: "Keeping each workspace's data separate at the database level.",
    source: "You, or whoever invited you"
  },
  {
    what: "Channel credentials",
    why: "Sending and receiving messages on your behalf. Encrypted at rest.",
    source: "You, or the platform's login flow"
  },
  {
    what: "Message content",
    why: "Showing your team the conversation and letting them reply.",
    source: "The messaging platform's webhook"
  },
  {
    what: "Sender identifiers",
    why: "Threading replies to the right conversation and person.",
    source: "The messaging platform's webhook"
  },
  {
    what: "Contact name and avatar",
    why: "Showing an agent who they are talking to.",
    source: "The messaging platform's profile API"
  },
  {
    what: "Attachments",
    why: "Displaying images, audio, video, and files sent in a conversation.",
    source: "The messaging platform"
  },
  {
    what: "Internal notes",
    why: "Letting your team annotate a conversation. Never sent to the contact.",
    source: "Your team"
  },
  {
    what: "Delivery logs",
    why: "Showing whether a channel is actually receiving events.",
    source: "Generated when a webhook arrives"
  }
] as const;

export default function PrivacyPolicyPage() {
  const entity = legalEntity();
  const email = privacyEmail();
  const address = legalAddress();

  return (
    <LegalPage
      title="Privacy policy"
      intro={`How ${entity} handles the data that passes through this service. Effective ${POLICY_EFFECTIVE_DATE}.`}
    >
      <Section title="What Unibox is">
        <P>
          Unibox is a shared inbox. It connects to messaging accounts you already own on Facebook
          Messenger, Instagram, WhatsApp, LINE, and Telegram, collects the conversations those
          accounts receive into one place, and lets your team reply from there.
        </P>
        <P>
          That means Unibox handles two kinds of people&apos;s data. There is you, the customer who
          signs in. And there are your contacts, the people who message your business. This policy
          covers both, and says which is which wherever the answer differs.
        </P>
      </Section>

      <Section title="Who is responsible for the data">
        <P>
          For your account and billing information, {entity} is the data controller. For the
          conversations inside your workspace, you are the controller and {entity} is a processor
          acting on your instructions. We do not decide what your contacts message you about, and we
          do not use those conversations for our own purposes.
        </P>
      </Section>

      <Section title="What is collected">
        <DataTable rows={COLLECTED} />
        <P>
          Unibox does not ask for and does not store payment card numbers, government identifiers,
          or location beyond what a contact chooses to send in a message.
        </P>
      </Section>

      <Section id="meta" title="Data received from Meta">
        <P>
          When you connect a Facebook Page, an Instagram professional account, or a WhatsApp
          Business number, Meta sends Unibox the following, and nothing else:
        </P>
        <Bullets
          items={[
            "The account's identifier and name, so the channel can be listed and matched to inbound events.",
            "An access token scoped to that account, used only to fetch and send messages for it.",
            "The content of messages sent to that account, including text, attachments, and quick replies.",
            "A per-account identifier for each person who messages you, plus their public profile name and picture where the platform provides it.",
            "Delivery and read receipts for messages your team sends."
          ]}
        />
        <P>
          This data is used for one purpose: showing you the conversation and delivering your reply.
          It is not used for advertising, not used to train models, not sold, and not combined with
          data from any other source. The same applies to data received from LINE and Telegram.
        </P>
      </Section>

      <Section title="Who else sees it">
        <P>
          Members of your own workspace, according to the role you gave them. Beyond that, three
          categories of service provider, each of which is contractually limited to processing data
          on our instructions:
        </P>
        <Bullets
          items={[
            <>
              <strong>Supabase</strong>, which hosts the Postgres database and the authentication
              service.
            </>,
            <>
              <strong>Railway</strong>, which runs the application servers.
            </>,
            <>
              <strong>The messaging platforms themselves</strong>, meaning Meta, LINE, and Telegram.
              Sending a reply necessarily discloses it to the platform that delivers it.
            </>
          ]}
        />
        <P>
          Nothing is sold, rented, or shared with advertisers or data brokers. We disclose data to
          law enforcement only where a valid legal order compels it, and we will tell you unless the
          order forbids it.
        </P>
      </Section>

      <Section title="How it is protected">
        <Bullets
          items={[
            "Access tokens, webhook secrets, and app secrets are encrypted with AES-256-GCM before they are written to the database. They are never displayed back to you after saving.",
            "Every workspace's rows are isolated by Postgres row-level security, so a query made on behalf of one workspace cannot return another's data even if the application has a bug.",
            "Every inbound webhook is verified against the sending platform's signature. Unsigned or wrongly signed deliveries are rejected rather than ingested.",
            "All traffic to and from Unibox uses TLS."
          ]}
        />
      </Section>

      <Section title="How long it is kept">
        <P>
          Conversations and messages are kept until you delete them, and deleting a channel deletes
          its conversations and messages with it. Closing your workspace deletes everything belonging
          to it. Deleted rows may persist in encrypted database backups for up to 30 days before
          those backups expire.
        </P>
        <P>
          Webhook delivery logs, which hold an account identifier and an outcome but no message
          content, are kept as a diagnostic record for the life of the channel.
        </P>
      </Section>

      <Section title="Your rights">
        <P>
          Depending on where you live, you may have the right to access, correct, export, or delete
          your data, to object to processing, and to complain to a supervisory authority. Exercise
          any of them by writing to <a className="text-primary underline underline-offset-2" href={`mailto:${email}`}>{email}</a>. We respond within
          30 days.
        </P>
        <P>
          If you are a contact who messaged a business using Unibox rather than a customer of ours,
          the fastest route is to ask that business directly, since the conversation is theirs. You
          can also use the{" "}
          <Link className="text-primary underline underline-offset-2" href={DATA_DELETION_PATH}>
            data deletion page
          </Link>{" "}
          and we will pass the request on.
        </P>
      </Section>

      <Section title="International transfers">
        <P>
          Our infrastructure providers operate in the United States and the European Union. Where
          data moves out of the region it was collected in, that transfer relies on the European
          Commission&apos;s Standard Contractual Clauses.
        </P>
      </Section>

      <Section title="Children">
        <P>
          Unibox is a business tool and is not directed at children. We do not knowingly hold data
          about anyone under 16. If you believe we have, write to us and it will be removed.
        </P>
      </Section>

      <Section title="Changes">
        <P>
          Material changes are announced in the application at least 30 days before they take
          effect, and the date at the top of this page is updated. Continuing to use Unibox after
          that date means you accept the revised policy.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          {entity}
          {address ? `, ${address}` : ""}.{" "}
          <a className="text-primary underline underline-offset-2" href={`mailto:${email}`}>
            {email}
          </a>
        </P>
        <P>
          See also the{" "}
          <Link className="text-primary underline underline-offset-2" href={TERMS_PATH}>
            terms of service
          </Link>
          .
        </P>
      </Section>
    </LegalPage>
  );
}
