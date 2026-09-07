import type { ReactNode } from "react";

/**
 * Typography for the published policies. Deliberately plain: these pages are
 * read by Meta reviewers and by people trying to find one specific answer, so
 * they use the app's theme tokens but none of its chrome.
 */

export function Section({
  id,
  title,
  children
}: Readonly<{ id?: string; title: string; children: ReactNode }>) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

export function Bullets({ items }: Readonly<{ items: ReadonlyArray<ReactNode> }>) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** A labelled table for "what we store and why", which reads better than prose. */
export function DataTable({
  rows
}: Readonly<{ rows: ReadonlyArray<{ what: string; why: string; source: string }> }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40">
            <th className="px-3 py-2 text-xs font-medium">Data</th>
            <th className="px-3 py-2 text-xs font-medium">Why it is held</th>
            <th className="px-3 py-2 text-xs font-medium">Where it comes from</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.what} className="border-b border-border last:border-0">
              <td className="px-3 py-2 align-top text-[13px] font-medium">{row.what}</td>
              <td className="px-3 py-2 align-top text-[13px] text-muted-foreground">{row.why}</td>
              <td className="px-3 py-2 align-top text-[13px] text-muted-foreground">{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalPage({
  title,
  intro,
  children
}: Readonly<{ title: string; intro: string; children: ReactNode }>) {
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
      </header>
      {children}
    </article>
  );
}
