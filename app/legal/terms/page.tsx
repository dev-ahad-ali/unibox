import type { Metadata } from "next";
import Link from "next/link";

import { Bullets, LegalPage, P, Section } from "@/components/legal/prose";
import {
  POLICY_EFFECTIVE_DATE,
  PRIVACY_PATH,
  legalAddress,
  legalEntity,
  supportEmail
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of service · Unibox",
  description: "The agreement between Unibox and the businesses that use it."
};

export default function TermsPage() {
  const entity = legalEntity();
  const email = supportEmail();
  const address = legalAddress();

  return (
    <LegalPage
      title="Terms of service"
      intro={`The agreement between you and ${entity} for the use of Unibox. Effective ${POLICY_EFFECTIVE_DATE}.`}
    >
      <Section title="Agreement">
        <P>
          By creating a workspace or using Unibox you accept these terms. If you accept them for a
          company, you confirm you are allowed to bind that company, and &quot;you&quot; means the
          company.
        </P>
      </Section>

      <Section title="What you get">
        <P>
          A hosted shared inbox that connects to messaging accounts you own, collects the
          conversations they receive, and lets the people you invite reply. We may change or add
          features. If we remove something you depend on, we will give 30 days&apos; notice.
        </P>
      </Section>

      <Section title="Your account">
        <Bullets
          items={[
            "You are responsible for what happens under your credentials, and for the people you invite into your workspace.",
            "You must give accurate information and keep it current.",
            "Tell us promptly at the support address below if you believe an account has been compromised.",
            "You must be old enough to enter a contract where you live."
          ]}
        />
      </Section>

      <Section title="The accounts you connect">
        <P>
          You may only connect messaging accounts you own or are authorised to operate. You are
          responsible for holding whatever consent the law and the platform require before you
          message someone.
        </P>
        <P>
          Connecting a platform account means you also agree to that platform&apos;s own terms, and
          they apply on top of these. Relevant ones are Meta&apos;s Platform Terms and Developer
          Policies, the WhatsApp Business Messaging Policy, the LINE Messaging API terms, and the
          Telegram Bot terms. A platform can suspend or limit your account for its own reasons, and
          when it does, the parts of Unibox that depend on it stop working. That is outside our
          control.
        </P>
      </Section>

      <Section title="What you may not do">
        <Bullets
          items={[
            "Send unsolicited bulk messages, spam, or anything a connected platform prohibits.",
            "Use Unibox to harass, defraud, or impersonate anyone.",
            "Upload malware, or content that is unlawful where you or the recipient are.",
            "Probe, scan, or attempt to breach the service or another customer's workspace. Good-faith security research reported to us privately is welcome and will not be treated as a breach of this clause.",
            "Resell or sublicense the service without a written agreement with us.",
            "Attempt to extract another customer's data, by any means."
          ]}
        />
      </Section>

      <Section title="Your data">
        <P>
          The conversations, messages, and contact records in your workspace belong to you. We hold
          them to run the service on your behalf, and claim no ownership. You grant us only the
          licence needed to store, process, and transmit them for that purpose.
        </P>
        <P>
          You can export or delete your data at any time. The{" "}
          <Link className="text-primary underline underline-offset-2" href={PRIVACY_PATH}>
            privacy policy
          </Link>{" "}
          explains what is held and for how long.
        </P>
      </Section>

      <Section title="Availability">
        <P>
          We aim to keep Unibox running continuously, but we do not promise uninterrupted service.
          Maintenance, provider outages, and platform-side failures happen. Where the service is
          offered free of charge, it is offered as-is with no availability commitment at all.
        </P>
      </Section>

      <Section title="Suspension and termination">
        <P>
          You may stop using Unibox and delete your workspace whenever you like. We may suspend an
          account that breaches these terms, that puts the service or other customers at risk, or
          that we are legally required to suspend. Except where the breach is serious or a law
          forbids it, we will contact you first and give you a chance to fix the problem.
        </P>
        <P>
          After termination, workspace data is deleted within 30 days. Ask before then if you need
          an export.
        </P>
      </Section>

      <Section title="Warranties and liability">
        <P>
          Unibox is provided without warranties of any kind, express or implied, including
          merchantability and fitness for a particular purpose, to the fullest extent the law allows.
        </P>
        <P>
          Neither party is liable for indirect, incidental, or consequential loss, or for lost
          profits or goodwill. Our total liability across all claims is capped at the greater of the
          fees you paid us in the 12 months before the claim, or one hundred US dollars. Nothing
          here limits liability for fraud, for death or personal injury caused by negligence, or for
          anything else that cannot lawfully be limited.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We will post material changes here and announce them in the application at least 30 days
          before they take effect. Using Unibox after that date means you accept them. If you do not,
          stop using the service and delete your workspace.
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
      </Section>
    </LegalPage>
  );
}
