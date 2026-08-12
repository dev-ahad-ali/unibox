import { Camera, MessageCircle, MessageSquare, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/types";

// lucide dropped brand marks in v1, so these are generic stand-ins. Using the
// real brand logos would mean shipping their trademarked assets anyway.
const PLATFORM_META = {
  messenger: { label: "Messenger", Icon: MessageSquare },
  instagram: { label: "Instagram", Icon: Camera },
  whatsapp: { label: "WhatsApp", Icon: Phone },
  line: { label: "LINE", Icon: MessageCircle }
} as const satisfies Record<Platform, { label: string; Icon: typeof MessageSquare }>;

export function platformLabel(platform?: Platform) {
  return platform ? PLATFORM_META[platform].label : "Unknown";
}

/**
 * Platform marks stay monochrome. Brand colors here would compete with lime,
 * which is reserved for state that needs an agent's attention.
 */
export function PlatformIcon({
  platform,
  className
}: Readonly<{ platform?: Platform; className?: string }>) {
  const Icon = platform ? PLATFORM_META[platform].Icon : MessageCircle;
  return <Icon className={cn("size-3.5 text-muted-foreground", className)} aria-hidden />;
}

export function PlatformBadge({
  platform,
  className
}: Readonly<{ platform?: Platform; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      <PlatformIcon platform={platform} />
      {platformLabel(platform)}
    </span>
  );
}
