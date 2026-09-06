import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Illustrations for the setup guide. Everything is drawn from theme tokens
 * (no bitmaps), so it follows light/dark mode and never goes stale the way a
 * screenshot of a vendor dashboard does within a quarter.
 */

/** Customer → platform → webhook → Unibox → agent, the one picture that explains why setup has the steps it has. */
export function FlowArt({ platform = "the platform" }: Readonly<{ platform?: string }>) {
  return (
    <svg
      viewBox="0 0 640 150"
      role="img"
      aria-label={`A customer messages ${platform}, which posts a webhook to Unibox, where an agent replies`}
      className="w-full max-w-2xl"
    >
      {/* customer phone */}
      <rect x="18" y="30" width="54" height="92" rx="10" className="fill-card stroke-border" strokeWidth="2" />
      <rect x="26" y="40" width="38" height="62" rx="4" className="fill-secondary" />
      <rect x="31" y="48" width="22" height="8" rx="4" className="fill-primary" />
      <rect x="37" y="60" width="22" height="8" rx="4" className="fill-muted-foreground/60" />
      <rect x="31" y="72" width="26" height="8" rx="4" className="fill-primary" />
      <circle cx="45" cy="112" r="3" className="fill-border" />
      <text x="45" y="140" textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
        Customer
      </text>

      <Arrow x1={80} x2={150} y={76} label="sends a DM" />

      {/* platform cloud */}
      <path
        d="M175 96c-14 0-24-9-24-21 0-11 8-19 19-20 4-12 15-20 28-20 14 0 26 9 29 22 12 0 21 9 21 20s-9 19-21 19h-52z"
        className="fill-accent stroke-border"
        strokeWidth="2"
      />
      <text x="200" y="80" textAnchor="middle" className="fill-accent-foreground text-[11px] font-semibold">
        {platform}
      </text>
      <text x="200" y="140" textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
        Platform
      </text>

      <Arrow x1={256} x2={336} y={76} label="webhook POST" sub="signed" />

      {/* unibox */}
      <rect x="344" y="38" width="130" height="76" rx="14" className="fill-card stroke-primary" strokeWidth="2" />
      <rect x="356" y="52" width="34" height="48" rx="6" className="fill-secondary" />
      <rect x="360" y="58" width="26" height="5" rx="2.5" className="fill-primary" />
      <rect x="360" y="67" width="26" height="5" rx="2.5" className="fill-muted-foreground/50" />
      <rect x="360" y="76" width="26" height="5" rx="2.5" className="fill-muted-foreground/50" />
      <rect x="398" y="52" width="64" height="48" rx="6" className="fill-secondary" />
      <rect x="404" y="60" width="36" height="7" rx="3.5" className="fill-muted-foreground/50" />
      <rect x="420" y="72" width="36" height="7" rx="3.5" className="fill-primary" />
      <rect x="404" y="84" width="52" height="8" rx="4" className="fill-card stroke-border" />
      <text x="409" y="136" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
        Unibox inbox
      </text>

      <Arrow x1={482} x2={548} y={76} label="reply via API" reverse />

      {/* agent */}
      <circle cx="590" cy="64" r="20" className="fill-primary/15 stroke-primary" strokeWidth="2" />
      <circle cx="590" cy="57" r="7" className="fill-primary" />
      <path d="M576 80c3-9 25-9 28 0" className="fill-primary" />
      <text x="590" y="140" textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
        Your agent
      </text>
    </svg>
  );
}

function Arrow({
  x1,
  x2,
  y,
  label,
  sub,
  reverse = false
}: Readonly<{ x1: number; x2: number; y: number; label: string; sub?: string; reverse?: boolean }>) {
  const head = reverse ? x1 : x2;
  const dir = reverse ? -1 : 1;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} className="stroke-muted-foreground" strokeWidth="2" strokeDasharray="4 4" />
      <path
        d={`M${head} ${y} l${-8 * dir} -5 v10 z`}
        className="fill-muted-foreground"
      />
      <text x={(x1 + x2) / 2} y={y - 12} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
        {label}
      </text>
      {sub ? (
        <text x={(x1 + x2) / 2} y={y + 20} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export type MockField = {
  label: string;
  value: string;
  /** Draw attention to this field: ring + "copy this" tag. */
  highlight?: boolean;
  /** Render as an action button rather than a value. */
  button?: boolean;
  /** Render as an on/off toggle. */
  toggle?: "on" | "off";
};

/**
 * A stylised vendor console: window chrome, a left nav with one active item,
 * and a panel of fields. Highlighted fields are what the reader should copy.
 * It deliberately looks like no specific dashboard so it stays recognisable
 * after the vendor redesigns theirs.
 */
export function MockConsole({
  title,
  nav,
  activeNav,
  fields,
  caption,
  className
}: Readonly<{
  title: string;
  nav: string[];
  activeNav: string;
  fields: MockField[];
  caption?: string;
  className?: string;
}>) {
  return (
    <figure className={cn("w-full max-w-md", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
          <span className="size-2 rounded-full bg-destructive/70" />
          <span className="size-2 rounded-full bg-warning/70" />
          <span className="size-2 rounded-full bg-success/70" />
          <span className="ml-2 truncate text-[10px] font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="flex">
          <ul className="w-28 shrink-0 space-y-1 border-r border-border bg-secondary/30 p-2 text-[10px]">
            {nav.map(item => (
              <li
                key={item}
                className={cn(
                  "truncate rounded-md px-2 py-1",
                  item === activeNav ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            {fields.map(field => (
              <div key={field.label} className="relative">
                <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
                {field.button ? (
                  <span
                    className={cn(
                      "inline-block rounded-md px-2 py-1 text-[10px] font-medium",
                      field.highlight ? "bg-primary text-primary-foreground ring-2 ring-primary/40 ring-offset-1 ring-offset-card" : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {field.value}
                  </span>
                ) : field.toggle ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px]">
                    <span
                      className={cn(
                        "relative inline-block h-3.5 w-6 rounded-full transition-colors",
                        field.toggle === "on" ? "bg-success" : "bg-muted-foreground/40",
                        field.highlight && "ring-2 ring-primary/40 ring-offset-1 ring-offset-card"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-2.5 rounded-full bg-card",
                          field.toggle === "on" ? "right-0.5" : "left-0.5"
                        )}
                      />
                    </span>
                    <span className="text-muted-foreground">{field.value}</span>
                  </span>
                ) : (
                  <div
                    className={cn(
                      "truncate rounded-md border px-2 py-1 font-mono text-[10px]",
                      field.highlight
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {field.value}
                  </div>
                )}
                {field.highlight ? (
                  <span className="absolute -top-1.5 right-0 rounded-full bg-primary px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-primary-foreground">
                    {field.button ? "click" : field.toggle ? "set" : "copy this"}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      {caption ? <figcaption className="mt-1.5 text-[11px] text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

/** A chat transcript, used for the @BotFather conversation. */
export function MockChat({
  title,
  messages,
  caption
}: Readonly<{
  title: string;
  messages: ReadonlyArray<{ from: "them" | "you"; text: ReactNode; highlight?: boolean }>;
  caption?: string;
}>) {
  return (
    <figure className="w-full max-w-sm">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-3 py-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {title.slice(1, 2).toUpperCase()}
          </span>
          <span className="text-[11px] font-medium">{title}</span>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-snug",
                message.from === "you"
                  ? "self-end rounded-br-sm bg-primary text-primary-foreground"
                  : "self-start rounded-bl-sm bg-secondary text-secondary-foreground",
                message.highlight && "ring-2 ring-primary/40 ring-offset-1 ring-offset-card"
              )}
            >
              {message.text}
            </div>
          ))}
        </div>
      </div>
      {caption ? <figcaption className="mt-1.5 text-[11px] text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

/** Splits a Telegram token into the two things the connect form asks for. */
export function TokenAnatomy() {
  return (
    <figure className="w-full max-w-md">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-center gap-y-3 font-mono text-sm">
          <span className="flex flex-col items-center">
            <span className="rounded-md bg-primary/15 px-2 py-1 text-primary ring-1 ring-primary/30">7000000001</span>
            <span className="mt-1 h-2 w-full border-x border-b border-primary/50" aria-hidden />
            <span className="mt-1 font-sans text-[10px] font-medium text-primary">Bot id</span>
          </span>
          <span className="px-1 pb-8 text-muted-foreground">:</span>
          <span className="flex flex-col items-center">
            <span className="rounded-md bg-secondary px-2 py-1 text-secondary-foreground">AAExampleBotToken…</span>
            <span className="mt-1 h-2 w-full border-x border-b border-muted-foreground/50" aria-hidden />
            <span className="mt-1 font-sans text-[10px] font-medium text-muted-foreground">rest of the token</span>
          </span>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Paste the <strong>whole thing</strong> as the bot token. The number before the colon is the bot id.
        </p>
      </div>
    </figure>
  );
}

/** Meta's two-phase webhook handshake: a GET challenge, then signed POSTs. */
export function HandshakeArt() {
  return (
    <svg viewBox="0 0 520 170" role="img" aria-label="Meta verifies the webhook with a GET challenge, then delivers signed POST events" className="w-full max-w-lg">
      <Lane x={90} label="Platform" />
      <Lane x={430} label="Unibox" />

      <Message y={48} from={90} to={430} label="GET ?hub.challenge=abc  +  hub.verify_token" />
      <Message y={78} from={430} to={90} label="200  abc" tone="success" />
      <text x="260" y="100" textAnchor="middle" className="fill-muted-foreground text-[10px]">
        ✓ Webhook verified — the dialog turns green
      </text>
      <Message y={126} from={90} to={430} label="POST message events  +  X-Hub-Signature-256" />
      <Message y={154} from={430} to={90} label="200  (signature checked, message ingested)" tone="success" />
    </svg>
  );
}

function Lane({ x, label }: Readonly<{ x: number; label: string }>) {
  return (
    <g>
      <rect x={x - 40} y="4" width="80" height="22" rx="8" className="fill-card stroke-border" strokeWidth="2" />
      <text x={x} y="19" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
        {label}
      </text>
      <line x1={x} y1="26" x2={x} y2="166" className="stroke-border" strokeWidth="2" strokeDasharray="3 5" />
    </g>
  );
}

function Message({
  y,
  from,
  to,
  label,
  tone = "default"
}: Readonly<{ y: number; from: number; to: number; label: string; tone?: "default" | "success" }>) {
  const dir = to > from ? 1 : -1;
  const lineClass = tone === "success" ? "stroke-success" : "stroke-primary";
  const headClass = tone === "success" ? "fill-success" : "fill-primary";
  return (
    <g>
      <line x1={from} y1={y} x2={to - 8 * dir} y2={y} className={lineClass} strokeWidth="2" />
      <path d={`M${to} ${y} l${-9 * dir} -5 v10 z`} className={headClass} />
      <text x={(from + to) / 2} y={y - 6} textAnchor="middle" className="fill-foreground font-mono text-[9.5px]">
        {label}
      </text>
    </g>
  );
}

/** "Which id?" — the @handle is never the routing id. */
export function IdVsHandleArt({
  wrong,
  right,
  rightLabel
}: Readonly<{ wrong: string; right: string; rightLabel: string }>) {
  return (
    <figure className="w-full max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            <X className="size-3" aria-hidden /> Not this
          </div>
          <div className="mt-2 truncate font-mono text-sm">{wrong}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">The handle people search for</div>
        </div>
        <div className="rounded-xl border border-success/40 bg-success/5 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            <Check className="size-3" aria-hidden /> This
          </div>
          <div className="mt-2 truncate font-mono text-sm">{right}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{rightLabel}</div>
        </div>
      </div>
    </figure>
  );
}
