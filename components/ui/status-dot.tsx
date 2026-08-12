import { cn } from "@/lib/utils";
import type { ChannelStatus, ConversationStatus } from "@/lib/types";

const TONE = {
  open: "bg-primary",
  active: "bg-primary",
  pending: "bg-warning",
  closed: "bg-muted-foreground",
  disconnected: "bg-muted-foreground",
  error: "bg-destructive"
} as const;

export function StatusDot({
  status,
  className
}: Readonly<{ status: ConversationStatus | ChannelStatus; className?: string }>) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", TONE[status], className)} aria-hidden />;
}
