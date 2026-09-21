"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export type LiveState = "connecting" | "live" | "offline";

type Listener = (payload: Record<string, unknown>) => void;

/**
 * One Realtime channel per browser tab, shared by every component that listens
 * for live events. The topic is private: Supabase checks the policy on
 * `realtime.messages` against this user's session before letting them join, so
 * passing someone else's org id here gets the subscription refused.
 */
let supabase: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let channelOrgId: string | null = null;
let state: LiveState = "connecting";
const listeners = new Map<string, Set<Listener>>();
const stateListeners = new Set<(state: LiveState) => void>();

function setState(next: LiveState) {
  state = next;
  for (const listener of stateListeners) listener(next);
}

async function connect(orgId: string) {
  if (channel && channelOrgId === orgId) {
    return;
  }

  supabase ??= createBrowserSupabaseClient();
  if (!supabase) {
    // Demo mode: no Supabase, so nothing to connect to.
    setState("offline");
    return;
  }

  if (channel) {
    void supabase.removeChannel(channel);
  }
  channelOrgId = orgId;
  setState("connecting");

  // Private channels authorize with the user's access token, not the anon key.
  await supabase.realtime.setAuth();

  channel = supabase
    .channel(`org:${orgId}`, { config: { private: true } })
    .on("broadcast", { event: "*" }, message => {
      const handlers = listeners.get(message.event);
      if (!handlers) return;
      const payload = (message.payload ?? {}) as Record<string, unknown>;
      for (const handler of handlers) handler(payload);
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") setState("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setState("offline");
    });
}

/** Listens for one event on the org's topic. Returns the unsubscribe. */
export function onOrgEvent<T extends Record<string, unknown>>(
  orgId: string,
  event: string,
  handler: (payload: T) => void
) {
  const set = listeners.get(event) ?? new Set<Listener>();
  set.add(handler as Listener);
  listeners.set(event, set);
  void connect(orgId);

  return () => {
    set.delete(handler as Listener);
  };
}

/** Follows the connection state for the status pill. Returns the unsubscribe. */
export function onLiveState(orgId: string, handler: (state: LiveState) => void) {
  stateListeners.add(handler);
  handler(state);
  void connect(orgId);

  return () => {
    stateListeners.delete(handler);
  };
}
