import type { ReactNode } from "react";

import { CopyButton } from "@/components/ui/copy-button";

/** A value the reader pastes somewhere else, with a one-click copy. */
export function CopyField({ label, value, hint }: Readonly<{ label: string; value: string; hint?: ReactNode }>) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1.5 font-mono text-[12px] text-foreground">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      {hint ? <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
