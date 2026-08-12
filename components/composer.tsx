"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({
  conversationId,
  disabled = false
}: Readonly<{ conversationId: string; disabled?: boolean }>) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function send() {
    if (!body.trim() || isPending || disabled) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to send message.");
        return;
      }

      setBody("");
      // The thread is server-rendered, so pull the new message back down.
      router.refresh();
    } catch {
      setError("Network error — the message was not sent.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        void send();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        name="body"
        rows={2}
        disabled={disabled}
        placeholder={disabled ? "Replies are blocked outside the service window" : "Write a reply…"}
        value={body}
        onChange={event => setBody(event.target.value)}
        onKeyDown={event => {
          // Enter sends, Shift+Enter breaks the line — the convention every
          // agent already has muscle memory for.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            "Enter to send · Shift+Enter for a new line"
          )}
        </span>
        <Button type="submit" size="sm" disabled={disabled || isPending || !body.trim()}>
          <Send aria-hidden />
          {isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
