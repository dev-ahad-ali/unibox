import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Info, Lightbulb } from "lucide-react";

import { CopyField } from "@/components/ui/copy-field";
import { cn } from "@/lib/utils";

// Re-exported so a guide can pull every building block from one module.
export { CopyField };

/**
 * Layout primitives for the setup guide. Each platform guide is a list of
 * numbered steps; a step optionally carries an illustration on the right so
 * the reader can match what they see on the vendor's screen.
 */

export function Step({
  number,
  title,
  art,
  children
}: Readonly<{ number: number; title: string; art?: ReactNode; children: ReactNode }>) {
  return (
    <li className="grid gap-4 border-b border-border/60 py-6 first:pt-2 last:border-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {number}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="pt-1 text-sm font-semibold leading-tight">{title}</h3>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground">
            {children}
          </div>
        </div>
      </div>
      {art ? <div className="flex items-start justify-center lg:justify-end">{art}</div> : null}
    </li>
  );
}

export function Steps({ children }: Readonly<{ children: ReactNode }>) {
  return <ol className="flex flex-col">{children}</ol>;
}

const CALLOUT = {
  info: { Icon: Info, className: "border-primary/30 bg-primary/5 text-foreground", iconClass: "text-primary" },
  tip: { Icon: Lightbulb, className: "border-success/30 bg-success/5 text-foreground", iconClass: "text-success" },
  warning: { Icon: AlertTriangle, className: "border-warning/40 bg-warning/10 text-foreground", iconClass: "text-warning" }
} as const;

export function Callout({
  tone = "info",
  title,
  children
}: Readonly<{ tone?: keyof typeof CALLOUT; title?: string; children: ReactNode }>) {
  const { Icon, className, iconClass } = CALLOUT[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed", className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className="text-muted-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

/** A click-path through a vendor UI: "Use cases → Messenger → Customize". */
export function UiPath({ parts }: Readonly<{ parts: string[] }>) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[12px] font-medium text-foreground">
            {part}
          </span>
          {index < parts.length - 1 ? <ChevronRight className="size-3 text-muted-foreground" aria-hidden /> : null}
        </span>
      ))}
    </span>
  );
}

export function ValueTable({
  caption,
  rows
}: Readonly<{ caption: string; rows: ReadonlyArray<{ value: ReactNode; where: ReactNode; goes: ReactNode }> }>) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[13px]">
        <caption className="bg-secondary/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {caption}
        </caption>
        <thead className="text-left text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-1.5 font-medium">Value</th>
            <th className="px-3 py-1.5 font-medium">Where to find it</th>
            <th className="px-3 py-1.5 font-medium">Where it goes</th>
          </tr>
        </thead>
        <tbody className="[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]">
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2 align-top font-medium">{row.value}</td>
              <td className="px-3 py-2 align-top text-muted-foreground">{row.where}</td>
              <td className="px-3 py-2 align-top text-muted-foreground">{row.goes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Troubleshooting({
  rows
}: Readonly<{ rows: ReadonlyArray<{ symptom: ReactNode; fix: ReactNode }> }>) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[13px]">
        <caption className="bg-secondary/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          If something goes wrong
        </caption>
        <tbody className="[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]">
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/60 last:border-0">
              <td className="w-2/5 px-3 py-2 align-top font-medium">{row.symptom}</td>
              <td className="px-3 py-2 align-top text-muted-foreground">{row.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "What you need before you start" checklist. */
export function Prereqs({ items }: Readonly<{ items: ReadonlyArray<ReactNode> }>) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-snug">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function GuideHeader({
  title,
  time,
  approval,
  children
}: Readonly<{ title: string; time: string; approval: string; children: ReactNode }>) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{time}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{approval}</span>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}
