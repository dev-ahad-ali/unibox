import { PlatformIcon, platformLabel } from "@/components/platform-badge";
import { StatusDot } from "@/components/ui/status-dot";
import type { Platform } from "@/lib/types";

/**
 * A still of the inbox, built from the same tokens the real one uses so the
 * landing page cannot drift from the product. Static markup on purpose: it is
 * an illustration, not a live preview, and it must render before any data.
 */

type Row = {
  platform: Platform;
  name: string;
  message: string;
  time: string;
  unread?: boolean;
};

const ROWS: readonly Row[] = [
  { platform: "whatsapp", name: "Priya Raman", message: "Has my order shipped yet?", time: "2m", unread: true },
  { platform: "messenger", name: "Tom Alvarez", message: "Do you deliver to Osaka?", time: "11m", unread: true },
  { platform: "instagram", name: "@studio.kaya", message: "Loved the new drop 🔥", time: "34m" },
  { platform: "line", name: "Yuki Nakamura", message: "Thanks, that worked!", time: "1h" },
  { platform: "telegram", name: "Dev Support Bot", message: "Ticket #4182 reopened", time: "2h" }
];

export function InboxPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2 rounded-full bg-primary" aria-hidden />
        <span className="text-xs font-medium">Inbox</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusDot status="active" />
          Live
        </span>
      </div>

      <ul className="divide-y divide-border/60">
        {ROWS.map(row => (
          <li key={row.name} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <PlatformIcon platform={row.platform} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{row.name}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  {platformLabel(row.platform)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {row.message}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{row.time}</span>
              {row.unread ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
