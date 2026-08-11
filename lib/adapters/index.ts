import { createMetaAdapter } from "@/lib/adapters/meta";
import { lineAdapter } from "@/lib/adapters/line";
import { whatsappAdapter } from "@/lib/adapters/whatsapp";
import type { ChannelAdapter, Platform } from "@/lib/types";

const messengerAdapter = createMetaAdapter("messenger");
const instagramAdapter = createMetaAdapter("instagram");

export function getAdapter(platform: Platform): ChannelAdapter {
  switch (platform) {
    case "messenger":
      return messengerAdapter;
    case "instagram":
      return instagramAdapter;
    case "whatsapp":
      return whatsappAdapter;
    case "line":
      return lineAdapter;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
