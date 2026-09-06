import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Callout,
  CopyField,
  GuideHeader,
  Prereqs,
  SectionTitle,
  Step,
  Steps,
  Troubleshooting,
  UiPath,
  ValueTable
} from "./blocks";
import {
  FlowArt,
  HandshakeArt,
  IdVsHandleArt,
  MockChat,
  MockConsole,
  TokenAnatomy
} from "@/components/setup/art";
import { Button } from "@/components/ui/button";

export type SetupUrls = {
  messenger: string;
  instagram: string;
  whatsapp: string;
  line: string;
  telegram: string;
  metaCallback: string;
};

function GoConnect({ children = "Open Channels and connect" }: Readonly<{ children?: string }>) {
  return (
    <Button asChild size="sm">
      <Link href="/admin/channels">
        {children}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

/* ------------------------------------------------------------------------ */
/* Messenger                                                                */
/* ------------------------------------------------------------------------ */

export function MessengerGuide({ urls }: Readonly<{ urls: SetupUrls }>) {
  return (
    <div className="space-y-6">
      <GuideHeader title="Facebook Messenger" time="≈ 15 minutes" approval="No review needed to test">
        Messenger works through a <strong>Facebook Page</strong>, never a personal profile. Meta lets a
        Page talk to your own account immediately; talking to the general public needs Meta's app review,
        which you can start in parallel. Everything below is free.
      </GuideHeader>

      <FlowArt platform="Messenger" />

      <SectionTitle>Before you start</SectionTitle>
      <Prereqs
        items={[
          <>
            A <strong>Facebook Page</strong> you administer. Create one from facebook.com → Pages in two minutes; it does
            not need to be published or verified.
          </>,
          <>
            A <strong>Meta developer app</strong> at developers.facebook.com with the <strong>Messenger</strong> product
            added. If Unibox is hosted for you, the deployment already has one — you just need a role on it.
          </>,
          <>
            While the app is in <strong>development mode</strong>, only people with a role on the app (admin, developer,
            tester) can message the Page through it. Add teammates under <UiPath parts={["App roles", "Roles"]} />.
          </>,
          <>
            Unibox's public address. Meta must be able to reach it over HTTPS — a laptop on localhost will not work
            without a tunnel.
          </>
        ]}
      />

      <Steps>
        <Step
          number={1}
          title="Tell Meta where Unibox lives"
          art={
            <MockConsole
              title="Meta for Developers — your app"
              nav={["Dashboard", "Use cases", "App settings", "App roles", "Webhooks"]}
              activeNav="App settings"
              fields={[
                { label: "App ID", value: "1234567890123456" },
                { label: "App secret", value: "••••••••••••  Show", highlight: true },
                { label: "Valid OAuth redirect URIs", value: urls.metaCallback, highlight: true }
              ]}
              caption="App settings → Basic holds the app id and secret. The redirect URI lives under Facebook Login → Settings."
            />
          }
        >
          <p>
            Open your app at developers.facebook.com. Under <UiPath parts={["Facebook Login", "Settings"]} /> (or{" "}
            <UiPath parts={["Facebook Login for Business", "Settings"]} />), add this address to{" "}
            <strong>Valid OAuth Redirect URIs</strong> and save:
          </p>
          <CopyField label="OAuth redirect URI" value={urls.metaCallback} />
          <Callout tone="operator" title="set the app credentials">
            Copy <strong>App ID</strong> and <strong>App secret</strong> from <UiPath parts={["App settings", "Basic"]} /> into{" "}
            <code>META_APP_ID</code> and <code>META_APP_SECRET</code>, invent any string for <code>META_VERIFY_TOKEN</code>,
            and redeploy. The app secret is what proves a webhook really came from Meta — without it Unibox rejects
            every delivery.
          </Callout>
        </Step>

        <Step
          number={2}
          title="Register the webhook"
          art={<HandshakeArt />}
        >
          <p>
            Newer apps use the use-case layout: <UiPath parts={["Use cases", "Engage with customers on Messenger", "Customize"]} />.
            Older apps: <UiPath parts={["Products", "Messenger", "Settings"]} />. Either way, find the{" "}
            <strong>Webhooks</strong> card and enter:
          </p>
          <CopyField label="Callback URL" value={urls.messenger} />
          <p>
            <strong>Verify token:</strong> the deployment's <code>META_VERIFY_TOKEN</code>. Press{" "}
            <strong>Verify and save</strong>. Meta calls Unibox with a challenge, Unibox echoes it back, and the dialog
            turns green.
          </p>
          <p>
            Then, on the same card, <strong>subscribe to fields</strong>: <code>messages</code>,{" "}
            <code>messaging_postbacks</code>, <code>message_deliveries</code>, <code>message_reads</code>. Registering the
            URL and subscribing to fields are two separate clicks — forgetting the second is the most common reason
            a verified webhook stays silent.
          </p>
        </Step>

        <Step
          number={3}
          title="Connect the Page in Unibox"
          art={
            <MockConsole
              title="Unibox — Channels"
              nav={["Inbox", "Setup guide", "Channels", "Agents"]}
              activeNav="Channels"
              fields={[
                { label: "Connect with Meta", value: "Connect with Meta", button: true, highlight: true },
                { label: "Pick assets", value: "☑ My Shop (Page)   ☐ @myshop (Instagram)" }
              ]}
              caption="One Facebook login lists every Page, Instagram account, and WhatsApp number you can attach."
            />
          }
        >
          <p>
            Go to <Link href="/admin/channels" className="text-primary underline underline-offset-2">Channels</Link> and press{" "}
            <strong>Connect with Meta</strong>. Log in with the Facebook account that administers the Page, grant the
            permissions, tick the Page, submit.
          </p>
          <p>
            Behind the scenes Unibox exchanges the login for a long-lived Page token, stores it encrypted, and calls
            Meta's <code>subscribed_apps</code> endpoint — the step that makes Meta actually deliver this Page's messages
            to your webhook.
          </p>
          <Callout tone="tip" title="Prefer pasting a token?">
            The manual form also works: platform Messenger, the <strong>Page id</strong> (from your Page's About section) as
            the account id, and a Page access token. A System User token from Business Settings never expires; tokens
            from the Graph Explorer die within hours.
          </Callout>
        </Step>

        <Step number={4} title="Send yourself a test message">
          <p>
            Open the inbox in one tab. In another, go to <code>m.me/&lt;your-page-username&gt;</code> while logged in as
            the app admin and say hello. It should appear in the inbox within a second or two. Reply from the composer;
            it lands in your Messenger.
          </p>
          <p>
            Back on Channels, the Page's setup checks turn green as each stage succeeds: credentials verified, webhook
            receiving, first message ingested.
          </p>
          <GoConnect />
        </Step>
      </Steps>

      <ValueTable
        caption="Values you will handle"
        rows={[
          { value: "Page id", where: <>Your Page → <strong>About</strong> → Page transparency, or the Meta dashboard's Page picker</>, goes: "Account id in the manual form (OAuth fills it for you)" },
          { value: "Page access token", where: "Generated by Connect with Meta, or Business Settings → System users", goes: "Stored encrypted on the channel" },
          { value: <>App secret</>, where: <UiPath parts={["App settings", "Basic"]} />, goes: <><code>META_APP_SECRET</code> on the deployment</> },
          { value: "Verify token", where: "Any string you invent", goes: <><code>META_VERIFY_TOKEN</code> and Meta's webhook dialog</> }
        ]}
      />

      <Troubleshooting
        rows={[
          { symptom: "The webhook dialog says verification failed", fix: <>Unibox is not reachable at that URL, there is a typo, or the verify token differs from <code>META_VERIFY_TOKEN</code>.</> },
          { symptom: "Verified, but no messages arrive", fix: <>Fields are not subscribed, or the Page is not subscribed to the app. Reconnect with Meta — it re-runs the subscription.</> },
          { symptom: "A friend's messages never show up", fix: "They have no role on the app. Add them as a tester (App roles → Roles) while the app is in development mode, and they must accept the invite." },
          { symptom: <>Reply fails with <code>(#10) outside of allowed window</code></>, fix: "More than 24 hours since the customer last wrote. Meta only allows free-form replies inside that window." },
          { symptom: <>Reply fails with <code>(#200)</code></>, fix: <>The token lacks <code>pages_messaging</code>. Reconnect to regenerate it.</> }
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Instagram                                                                */
/* ------------------------------------------------------------------------ */

export function InstagramGuide({ urls }: Readonly<{ urls: SetupUrls }>) {
  return (
    <div className="space-y-6">
      <GuideHeader title="Instagram DMs" time="≈ 20 minutes" approval="No review needed to test">
        Instagram messaging needs a <strong>professional account</strong> (Business or Creator — free, switched on in
        the Instagram app). Meta offers two ways to authorise it, and Unibox supports both: through a linked Facebook
        Page, or with Meta's newer Instagram Login.
      </GuideHeader>

      <FlowArt platform="Instagram" />

      <SectionTitle>Before you start</SectionTitle>
      <Prereqs
        items={[
          <>
            An Instagram account switched to <strong>Professional</strong>: Instagram app →{" "}
            <UiPath parts={["Settings", "Account type and tools", "Switch to professional account"]} />.
          </>,
          <>
            <strong>Allow access to messages</strong> turned on: <UiPath parts={["Settings", "Messages and story replies", "Message controls", "Connected tools"]} />.
            Without this, Meta hides your DMs from every API.
          </>,
          <>
            The same Meta developer app as Messenger, with the <strong>Instagram</strong> product added.
          </>,
          <>
            While the app is in development mode, <strong>both</strong> your professional account and any account you DM
            from need the <strong>Instagram tester</strong> role — being the app's Facebook admin does not cover Instagram.
          </>
        ]}
      />

      <SectionTitle>Pick your path</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="info" title="Path A — via a Facebook Page (one-click)">
          Link the Instagram account to a Facebook Page you administer (Page → Settings → Linked accounts), then press{" "}
          <strong>Connect with Meta</strong> on Channels and tick the Instagram account. Uses the Page's token; no extra
          secrets.
        </Callout>
        <Callout tone="info" title="Path B — Instagram Login (no Page needed)">
          Use Meta's <strong>Instagram API with Instagram Login</strong> product and paste its <code>IGAA…</code> token
          into the manual form. Its webhooks are signed with a separate Instagram app secret.
        </Callout>
      </div>

      <Steps>
        <Step
          number={1}
          title="Add testers and accept the invites"
          art={
            <MockConsole
              title="Meta for Developers — Instagram"
              nav={["Dashboard", "Use cases", "App roles", "Instagram", "Webhooks"]}
              activeNav="App roles"
              fields={[
                { label: "Instagram testers", value: "Add Instagram testers", button: true, highlight: true },
                { label: "Pending", value: "@myshop  ·  invite sent" }
              ]}
              caption="Then, in the Instagram app: Settings → Website permissions → Tester invites → Accept."
            />
          }
        >
          <p>
            In the Meta dashboard, <UiPath parts={["App roles", "Roles", "Add Instagram testers"]} /> — enter the
            professional account's username and, separately, the username of the account you will test-DM from.
          </p>
          <p>
            Each invited account must accept: Instagram app →{" "}
            <UiPath parts={["Settings", "Website permissions", "Tester invites"]} />. Skipping this is the number one reason
            Instagram "does nothing".
          </p>
        </Step>

        <Step
          number={2}
          title="Register the webhook"
          art={<HandshakeArt />}
        >
          <p>
            Under <UiPath parts={["Use cases", "Instagram", "Customize"]} /> (or <UiPath parts={["Products", "Instagram", "Webhooks"]} />), enter:
          </p>
          <CopyField label="Callback URL" value={urls.instagram} />
          <p>
            Verify token: the deployment's <code>META_VERIFY_TOKEN</code>. After it verifies, subscribe to{" "}
            <code>messages</code> and <code>messaging_postbacks</code>.
          </p>
          <Callout tone="operator" title="Path B needs one more secret">
            The Instagram-Login product signs webhooks with its <strong>Instagram app secret</strong>, shown on the Instagram
            product page (not the app's Basic Settings). Set it as <code>INSTAGRAM_APP_SECRET</code> alongside{" "}
            <code>META_APP_SECRET</code>, then redeploy.
          </Callout>
        </Step>

        <Step
          number={3}
          title="Find the account id (not the @handle)"
          art={<IdVsHandleArt wrong="@myshop" right="17841400000000000" rightLabel="Professional account id — what webhooks carry" />}
        >
          <p>
            Unibox routes each incoming DM by the numeric professional account id that Meta puts in the webhook. The
            @handle is never accepted.
          </p>
          <p>
            <strong>Path A:</strong> Connect with Meta discovers it for you. <strong>Path B:</strong> call{" "}
            <code>GET https://graph.instagram.com/me?fields=user_id,username</code> with your <code>IGAA…</code> token;{" "}
            <code>user_id</code> is the value. If you paste the wrong id, the connect check tells you the right one.
          </p>
        </Step>

        <Step
          number={4}
          title="Connect it in Unibox"
          art={
            <MockConsole
              title="Unibox — Connect manually"
              nav={["Messenger", "Instagram", "WhatsApp", "LINE", "Telegram"]}
              activeNav="Instagram"
              fields={[
                { label: "Instagram account id", value: "17841400000000000", highlight: true },
                { label: "Access token", value: "IGAA…  or  EAA…", highlight: true },
                { label: "", value: "Verify and connect", button: true }
              ]}
              caption="The token's prefix tells Unibox which Meta host to talk to."
            />
          }
        >
          <p>
            <strong>Path A:</strong> Channels → <strong>Connect with Meta</strong> → tick the Instagram account.
          </p>
          <p>
            <strong>Path B:</strong> Channels → manual form → Instagram, paste the account id and the <code>IGAA…</code>{" "}
            token. Unibox verifies it against Meta before storing it encrypted.
          </p>
          <GoConnect />
        </Step>

        <Step number={5} title="Test it">
          <p>
            From the tester account, open the professional account's profile in the Instagram app and send a DM. It
            appears under the Instagram filter in the inbox; replying from the composer delivers back to Instagram.
          </p>
        </Step>
      </Steps>

      <ValueTable
        caption="Values you will handle"
        rows={[
          { value: "Professional account id", where: <>Path A: discovered by Connect with Meta. Path B: <code>user_id</code> from <code>graph.instagram.com/me</code></>, goes: "Account id on the channel" },
          { value: "Access token", where: "Path A: the linked Page's token. Path B: the Instagram Login token (IGAA…)", goes: "Stored encrypted on the channel" },
          { value: "Instagram app secret", where: "Instagram product page in the Meta dashboard (Path B only)", goes: <><code>INSTAGRAM_APP_SECRET</code> on the deployment</> }
        ]}
      />

      <Troubleshooting
        rows={[
          { symptom: "Connect says the token belongs to a different account id", fix: "Use the id from the error message — that is the professional account id Meta signs webhooks with." },
          { symptom: "Webhook verified, DMs never arrive", fix: "Tester invite not accepted, Allow access to messages is off, or the account is still Personal rather than Professional." },
          { symptom: <>Webhook returns <code>401</code> in the logs (Path B)</>, fix: <><code>INSTAGRAM_APP_SECRET</code> is missing or wrong. It is a different value from the app's Basic Settings secret.</> },
          { symptom: "Cannot parse access token", fix: "An older build sent Instagram Login tokens to the wrong host. This build routes by token prefix — make sure the deployment is current." }
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* WhatsApp                                                                 */
/* ------------------------------------------------------------------------ */

export function WhatsAppGuide({ urls }: Readonly<{ urls: SetupUrls }>) {
  return (
    <div className="space-y-6">
      <GuideHeader title="WhatsApp Business" time="≈ 20 minutes" approval="Free test number, no payment to try">
        WhatsApp uses Meta's <strong>Cloud API</strong>. Adding WhatsApp to your Meta app gives you a free test number
        and a test business account straight away — no payment method, no business verification. A real number and
        paid outbound templates come later, and none of the steps below change when you add them.
      </GuideHeader>

      <FlowArt platform="WhatsApp" />

      <SectionTitle>Before you start</SectionTitle>
      <Prereqs
        items={[
          <>The same Meta developer app, with the <strong>WhatsApp</strong> product added.</>,
          <>
            Your own phone with WhatsApp installed, to receive the test number's messages and reply to them.
          </>,
          <>
            Know the 24-hour rule: after a customer writes, you can reply freely for <strong>24 hours</strong>. Outside
            that window only paid template messages go through (not yet supported in Unibox).
          </>,
          <>
            The test number can only <em>send</em> to up to five allow-listed numbers. It can <em>receive</em> from anyone.
          </>
        ]}
      />

      <Steps>
        <Step
          number={1}
          title="Collect the two ids and a token"
          art={
            <MockConsole
              title="Meta for Developers — WhatsApp"
              nav={["Quickstart", "API Setup", "Configuration", "Templates"]}
              activeNav="API Setup"
              fields={[
                { label: "Temporary access token", value: "EAAG…  (expires in 24h)", highlight: true },
                { label: "Phone number ID", value: "1191055487432454", highlight: true },
                { label: "WhatsApp Business Account ID", value: "2010…" },
                { label: "From", value: "+1 555 0100  (test number)" }
              ]}
              caption="API Setup (or Use cases → WhatsApp → Customize → Test settings in the newer layout)."
            />
          }
        >
          <p>
            Open <UiPath parts={["WhatsApp", "API Setup"]} />. Copy the <strong>Phone number ID</strong> — the long
            number under the test number, <em>not</em> the phone number itself — and the{" "}
            <strong>temporary access token</strong>. Note the WhatsApp Business Account (WABA) id too; you may need it in
            step 2.
          </p>
          <Callout tone="warning" title="Temporary tokens die after 24 hours">
            Fine for a first test. For anything that should keep working, create a System User in{" "}
            <UiPath parts={["Business Settings", "Users", "System users"]} />, assign it the app and the WhatsApp account,
            and generate a token with <code>whatsapp_business_messaging</code> and{" "}
            <code>whatsapp_business_management</code>. That token does not expire.
          </Callout>
        </Step>

        <Step
          number={2}
          title="Register the webhook"
          art={
            <MockConsole
              title="Meta for Developers — WhatsApp"
              nav={["Quickstart", "API Setup", "Configuration", "Templates"]}
              activeNav="Configuration"
              fields={[
                { label: "Callback URL", value: urls.whatsapp, highlight: true },
                { label: "Verify token", value: "your META_VERIFY_TOKEN", highlight: true },
                { label: "Webhook fields", value: "messages", toggle: "on", highlight: true }
              ]}
              caption="One field — messages — carries both inbound messages and delivery receipts."
            />
          }
        >
          <p>
            Under <UiPath parts={["WhatsApp", "Configuration"]} />, Webhooks card:
          </p>
          <CopyField label="Callback URL" value={urls.whatsapp} />
          <p>
            Verify token: the deployment's <code>META_VERIFY_TOKEN</code>. Verify, then subscribe to the{" "}
            <code>messages</code> field.
          </p>
          <Callout tone="tip" title="Dashboard asks for a payment method first?">
            Meta's newer layout sometimes hides the webhook form inside a Production setup wizard that wants a card.
            The card is for a real number, not for webhooks. Skip the wizard by subscribing over the API instead:
            <pre className="mt-2 overflow-x-auto rounded-md bg-secondary p-2 font-mono text-[11px] leading-relaxed text-foreground">{`curl -X POST "https://graph.facebook.com/v26.0/<WABA_ID>/subscribed_apps" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -d "override_callback_uri=${urls.whatsapp}" \\
  -d "verify_token=<META_VERIFY_TOKEN>"`}</pre>
            A <code>{'{"success":true}'}</code> reply means Meta already called Unibox and accepted the verification.
          </Callout>
        </Step>

        <Step
          number={3}
          title="Allow-list your phone and open the conversation"
          art={
            <MockConsole
              title="Meta for Developers — WhatsApp"
              nav={["Quickstart", "API Setup", "Configuration", "Templates"]}
              activeNav="API Setup"
              fields={[
                { label: "To", value: "Manage phone number list", button: true, highlight: true },
                { label: "Recipient", value: "+880 19…  ✓ verified" },
                { label: "", value: "Send message  (hello_world)", button: true, highlight: true }
              ]}
              caption="Up to five recipients, verified by a code sent to WhatsApp. No review."
            />
          }
        >
          <p>
            On API Setup, under <strong>To</strong> → <UiPath parts={["Manage phone number list"]} />, add your own number.
            Meta sends it a code on WhatsApp. Then press <strong>Send message</strong> to deliver the{" "}
            <code>hello_world</code> template to your phone — that opens a chat with the test number.
          </p>
        </Step>

        <Step
          number={4}
          title="Connect it in Unibox"
          art={
            <MockConsole
              title="Unibox — Connect manually"
              nav={["Messenger", "Instagram", "WhatsApp", "LINE", "Telegram"]}
              activeNav="WhatsApp"
              fields={[
                { label: "Phone number id", value: "1191055487432454", highlight: true },
                { label: "WhatsApp access token", value: "EAAG…", highlight: true },
                { label: "", value: "Verify and connect", button: true }
              ]}
              caption="Unibox checks the credential against Meta before saving it."
            />
          }
        >
          <p>
            Channels → manual form → WhatsApp. Account id is the <strong>Phone number ID</strong>; token is the access
            token. <strong>Connect with Meta</strong> also lists WhatsApp numbers if your app holds the WhatsApp
            permissions.
          </p>
          <GoConnect />
        </Step>

        <Step number={5} title="Reply from your phone">
          <p>
            Answer the <code>hello_world</code> message on your phone. It shows up under the WhatsApp filter; the
            composer displays how much of the 24-hour reply window remains. Reply — it lands on your phone.
          </p>
        </Step>
      </Steps>

      <ValueTable
        caption="Values you will handle"
        rows={[
          { value: "Phone number ID", where: <UiPath parts={["WhatsApp", "API Setup"]} />, goes: "Account id on the channel" },
          { value: "Access token", where: "API Setup (temporary) or Business Settings → System users (permanent)", goes: "Stored encrypted on the channel" },
          { value: "WABA id", where: "API Setup", goes: "Only the curl fallback in step 2" },
          { value: "Verify token", where: "The deployment's META_VERIFY_TOKEN", goes: "Meta's webhook dialog" }
        ]}
      />

      <Troubleshooting
        rows={[
          { symptom: <><code>(#131030) Recipient phone number not in allowed list</code></>, fix: "Test-number restriction. Add the recipient under Manage phone number list, or register a real number. Inbound from anyone still arrives; only sending is blocked." },
          { symptom: <><code>(#190)</code> or "Session has expired"</>, fix: "The 24-hour temporary token died. Generate a new one and reconnect the channel — or switch to a System User token." },
          { symptom: "Webhook returns 200 but the inbox stays empty", fix: "No channel whose account id matches the phone_number_id in the payload. Check for a typo in the Phone number ID." },
          { symptom: "Composer disabled with an amber notice", fix: "The customer last wrote more than 24 hours ago. Wait for their next message, or send a template (not yet supported)." }
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* LINE                                                                     */
/* ------------------------------------------------------------------------ */

export function LineGuide({ urls }: Readonly<{ urls: SetupUrls }>) {
  return (
    <div className="space-y-6">
      <GuideHeader title="LINE Official Account" time="≈ 10 minutes" approval="No review, free plan works">
        LINE has no app review and no business verification. You create a <strong>Messaging API channel</strong> in
        the LINE Developers console, which also creates the LINE Official Account your customers add as a friend.
        Everything runs on the free plan.
      </GuideHeader>

      <FlowArt platform="LINE" />

      <SectionTitle>Before you start</SectionTitle>
      <Prereqs
        items={[
          <>A LINE account, and a login at <strong>developers.line.biz</strong> (sign in with the same LINE account).</>,
          <>A <strong>provider</strong> — just a name for your company in the console. Create it on first login.</>,
          <>The LINE app on your phone, to add the Official Account and send test messages.</>,
          <>Unibox's public HTTPS address — LINE's Verify button calls it immediately.</>
        ]}
      />

      <Steps>
        <Step
          number={1}
          title="Create a Messaging API channel"
          art={
            <MockConsole
              title="LINE Developers console"
              nav={["Providers", "My Company", "Channels"]}
              activeNav="Channels"
              fields={[
                { label: "Create a new channel", value: "Messaging API", button: true, highlight: true },
                { label: "Channel name", value: "Tokyo Support" },
                { label: "Category", value: "Customer service" }
              ]}
              caption="Creating the channel also creates the Official Account behind it."
            />
          }
        >
          <p>
            In the console, open your provider and choose <UiPath parts={["Create a new channel", "Messaging API"]} />.
            Fill in the name, category, and description, agree to the terms, and create it.
          </p>
        </Step>

        <Step
          number={2}
          title="Copy the channel secret and issue an access token"
          art={
            <MockConsole
              title="LINE Developers — Tokyo Support"
              nav={["Basic settings", "Messaging API", "Roles", "Security"]}
              activeNav="Basic settings"
              fields={[
                { label: "Channel ID", value: "2001234567" },
                { label: "Channel secret", value: "9f1c…e2a7", highlight: true }
              ]}
              caption="Channel secret: Basic settings tab. Access token: Messaging API tab → Channel access token → Issue."
            />
          }
        >
          <p>
            <strong>Basic settings</strong> tab → copy the <strong>Channel secret</strong>. It signs every webhook LINE sends
            you; Unibox uses it to reject forgeries.
          </p>
          <p>
            <strong>Messaging API</strong> tab → scroll to <strong>Channel access token (long-lived)</strong> → <strong>Issue</strong>.
            Copy it. Issuing a new one later invalidates the old, so reconnect the channel if you ever reissue.
          </p>
        </Step>

        <Step
          number={3}
          title="Point the webhook at Unibox and turn it on"
          art={
            <MockConsole
              title="LINE Developers — Messaging API"
              nav={["Basic settings", "Messaging API", "Roles", "Security"]}
              activeNav="Messaging API"
              fields={[
                { label: "Webhook URL", value: urls.line, highlight: true },
                { label: "Use webhook", value: "on", toggle: "on", highlight: true },
                { label: "", value: "Verify", button: true, highlight: true },
                { label: "Auto-reply messages", value: "off", toggle: "off", highlight: true },
                { label: "Greeting messages", value: "off", toggle: "off", highlight: true }
              ]}
              caption="Use webhook on, Verify pressed, and both auto-messages off."
            />
          }
        >
          <CopyField label="Webhook URL" value={urls.line} />
          <p>
            Switch <strong>Use webhook</strong> on. Press <strong>Verify</strong> — LINE sends a signed empty event and Unibox
            answers 200. A failure here almost always means the channel secret does not match the one you will enter in
            step 5, or Unibox is not deployed yet.
          </p>
          <p>
            Further down, under <strong>LINE Official Account features</strong>, turn <strong>off</strong> both{" "}
            <em>Auto-reply messages</em> and <em>Greeting messages</em>. Left on, the Official Account answers your
            customers before Unibox does.
          </p>
          <Callout tone="tip" title="Verify before connecting?">
            Verify passes only if Unibox already knows the secret. Either connect first (step 5) and then press Verify,
            or have the deployment owner set <code>LINE_CHANNEL_SECRET</code> as a fallback.
          </Callout>
        </Step>

        <Step
          number={4}
          title="Get the bot user id (not the @handle)"
          art={<IdVsHandleArt wrong="@338wqhgr" right="U67890abcdef1234…" rightLabel="Bot user id — arrives as destination on every webhook" />}
        >
          <p>
            LINE labels each webhook with the bot's <code>userId</code>, which begins with <code>U</code>. That is how
            Unibox knows which channel a message belongs to. The <code>@handle</code> shown on the Official Account is
            a different thing and will not route.
          </p>
          <p>Fetch it with the access token from step 2:</p>
          <pre className="overflow-x-auto rounded-md bg-secondary p-2 font-mono text-[11px] leading-relaxed text-foreground">{`curl -H "Authorization: Bearer <CHANNEL_ACCESS_TOKEN>" https://api.line.me/v2/bot/info`}</pre>
          <p>
            The response's <code>userId</code> is your bot user id.
          </p>
        </Step>

        <Step
          number={5}
          title="Connect it in Unibox"
          art={
            <MockConsole
              title="Unibox — Connect manually"
              nav={["Messenger", "Instagram", "WhatsApp", "LINE", "Telegram"]}
              activeNav="LINE"
              fields={[
                { label: "Bot user id", value: "U67890abcdef1234…", highlight: true },
                { label: "Channel access token", value: "eyJhbGciOi…", highlight: true },
                { label: "Channel secret", value: "9f1c…e2a7", highlight: true },
                { label: "", value: "Verify and connect", button: true }
              ]}
              caption="All three values, stored encrypted after a live check against LINE."
            />
          }
        >
          <p>
            Channels → manual form → LINE. Bot user id, channel access token, and channel secret. Unibox checks the
            token against LINE before saving. If you pressed Verify in step 3 before this, go back and press it again now.
          </p>
          <GoConnect />
        </Step>

        <Step number={6} title="Add the account as a friend and say hi">
          <p>
            On the Messaging API tab there is a QR code. Scan it with the LINE app, add the Official Account, and send
            a message. It appears under the LINE filter; replies go out through LINE's push API.
          </p>
          <Callout tone="info" title="Free-plan limit">
            LINE's free plan caps outbound push messages at a few hundred per month. Inbound is unlimited.
          </Callout>
        </Step>
      </Steps>

      <ValueTable
        caption="Values you will handle"
        rows={[
          { value: "Bot user id", where: <><code>GET https://api.line.me/v2/bot/info</code> → <code>userId</code></>, goes: "Account id on the channel" },
          { value: "Channel access token", where: "Messaging API tab → Issue", goes: "Stored encrypted on the channel" },
          { value: "Channel secret", where: "Basic settings tab", goes: "Stored encrypted on the channel (or LINE_CHANNEL_SECRET as a fallback)" }
        ]}
      />

      <Troubleshooting
        rows={[
          { symptom: "Verify button fails", fix: "Channel secret mismatch, or the channel is not connected in Unibox yet, or Unibox is not deployed at that URL." },
          { symptom: "A canned reply beats you to every message", fix: "Auto-reply or greeting messages are still on under LINE Official Account features." },
          { symptom: "Nothing arrives", fix: "Use webhook is off, or the channel's account id is the @handle instead of the U… bot user id." },
          { symptom: "Sending fails with 401", fix: "The access token was reissued in the console. Reconnect the channel with the new one." }
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Telegram                                                                 */
/* ------------------------------------------------------------------------ */

export function TelegramGuide({ urls }: Readonly<{ urls: SetupUrls }>) {
  return (
    <div className="space-y-6">
      <GuideHeader title="Telegram" time="≈ 3 minutes" approval="No dashboard, no review">
        The easiest channel by far. You create a bot by chatting with <strong>@BotFather</strong> inside Telegram,
        paste the token it gives you into Unibox, and you are done — Unibox registers the webhook with Telegram for
        you. Customers message the bot; you reply from the inbox.
      </GuideHeader>

      <FlowArt platform="Telegram" />

      <SectionTitle>Before you start</SectionTitle>
      <Prereqs
        items={[
          <>A Telegram account (the app on your phone or desktop).</>,
          <>Unibox's public HTTPS address — Telegram will only deliver to HTTPS.</>,
          <>
            Know the rule: a bot can only message people who have <strong>pressed Start</strong> on it first. It cannot
            reach out cold.
          </>
        ]}
      />

      <Steps>
        <Step
          number={1}
          title="Create a bot with @BotFather"
          art={
            <MockChat
              title="@BotFather"
              messages={[
                { from: "you", text: "/newbot" },
                { from: "them", text: "Alright, a new bot. How are we going to call it? Please choose a name for your bot." },
                { from: "you", text: "Tokyo Support" },
                { from: "them", text: "Good. Now let's choose a username for your bot. It must end in `bot`." },
                { from: "you", text: "tokyo_support_bot" },
                {
                  from: "them",
                  highlight: true,
                  text: (
                    <>
                      Done! Use this token to access the HTTP API:
                      <br />
                      <code className="font-mono text-[10px]">7000000001:AAExampleBotToken…</code>
                    </>
                  )
                }
              ]}
              caption="Keep the token private — anyone holding it controls the bot."
            />
          }
        >
          <p>
            In Telegram, search for <strong>@BotFather</strong> (the one with the blue verification check) and send{" "}
            <code>/newbot</code>. It asks for a display name, then a username ending in <code>bot</code>, and replies
            with a token.
          </p>
          <p>
            Optional polish while you are there: <code>/setuserpic</code> for an avatar, <code>/setdescription</code> for
            the text people see before pressing Start.
          </p>
        </Step>

        <Step number={2} title="Read the token" art={<TokenAnatomy />}>
          <p>
            The token has two parts separated by a colon. The number before the colon is the <strong>bot id</strong>; the
            whole string is the <strong>bot token</strong>. The connect form asks for both.
          </p>
        </Step>

        <Step
          number={3}
          title="Connect it in Unibox"
          art={
            <MockConsole
              title="Unibox — Connect manually"
              nav={["Messenger", "Instagram", "WhatsApp", "LINE", "Telegram"]}
              activeNav="Telegram"
              fields={[
                { label: "Bot id", value: "7000000001", highlight: true },
                { label: "Bot token", value: "7000000001:AAExampleBotToken…", highlight: true },
                { label: "", value: "Verify and connect", button: true }
              ]}
              caption="On submit Unibox calls Telegram's setWebhook for you. No webhook form anywhere."
            />
          }
        >
          <p>
            Channels → manual form → Telegram. Paste the bot id and the token, press <strong>Verify and connect</strong>.
            Unibox confirms the token with Telegram (and tells you the right bot id if they disagree), generates a
            webhook secret, and registers this address with Telegram:
          </p>
          <CopyField label="Webhook (registered automatically)" value={`${urls.telegram}?account=<bot id>`} hint="Shown for reference only — you never paste this anywhere." />
          <GoConnect />
        </Step>

        <Step number={4} title="Press Start and say hello">
          <p>
            Open <code>t.me/&lt;your_bot_username&gt;</code>, press <strong>Start</strong>, and send a message. It appears
            under the Telegram filter in the inbox. Reply from the composer and it arrives in Telegram.
          </p>
        </Step>
      </Steps>

      <ValueTable
        caption="Values you will handle"
        rows={[
          { value: "Bot id", where: "The digits before the colon in the token", goes: "Account id on the channel" },
          { value: "Bot token", where: "@BotFather's reply to /newbot (or /token later)", goes: "Stored encrypted on the channel" }
        ]}
      />

      <Troubleshooting
        rows={[
          { symptom: "“That token belongs to bot id …” on connect", fix: "The bot id you typed does not match the token. Use the number from the error." },
          { symptom: "Connected, but messages never arrive", fix: "Unibox's public URL was wrong when the webhook was registered. Fix NEXT_PUBLIC_APP_URL and reconnect to re-register." },
          { symptom: "Reply fails with “bot was blocked by the user”", fix: "The person stopped the bot. They need to press Start again." },
          { symptom: "Someone else's messages don't show", fix: "They have not pressed Start on the bot. Share the t.me link." }
        ]}
      />
    </div>
  );
}
