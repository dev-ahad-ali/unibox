"use client";

import { useState } from "react";

export function Composer({ conversationId }: Readonly<{ conversationId: string }>) {
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        void (async () => {
          setIsPending(true);
          setFeedback(null);
          try {
            const response = await fetch("/api/send-message", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ conversationId, body })
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setFeedback(payload?.error ?? "Unable to send message.");
              return;
            }
            setBody("");
            setFeedback("Message sent and synced to the live store.");
          } finally {
            setIsPending(false);
          }
        })();
      }}
    >
      <textarea
        className="textarea"
        name="body"
        placeholder="Reply to the customer..."
        value={body}
        onChange={event => setBody(event.target.value)}
      />
      <div className="composer-actions">
        <button className="button primary" type="submit" disabled={isPending || !body.trim()}>
          {isPending ? "Sending..." : "Send reply"}
        </button>
        <span className="form-note">Outbound messages are routed through the adapter chosen by the conversation channel.</span>
      </div>
      {feedback ? <div className="form-note">{feedback}</div> : null}
    </form>
  );
}
