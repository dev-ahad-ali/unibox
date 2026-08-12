const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp's customer service window: free-form replies are only allowed for 24
 * hours after the customer's last inbound message. Outside it, Meta rejects
 * anything that is not a pre-approved template.
 */
export function isWithinServiceWindow(lastInboundAt?: string) {
  if (!lastInboundAt) {
    return false;
  }

  const elapsed = Date.now() - new Date(lastInboundAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < WINDOW_MS;
}

/** Whole hours left in the window, or 0 once it has closed. */
export function serviceWindowHoursLeft(lastInboundAt?: string) {
  if (!lastInboundAt) {
    return 0;
  }

  const remaining = WINDOW_MS - (Date.now() - new Date(lastInboundAt).getTime());
  return remaining > 0 ? Math.floor(remaining / (60 * 60 * 1000)) : 0;
}
