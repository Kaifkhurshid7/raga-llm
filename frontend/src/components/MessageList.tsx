import { useEffect, useRef } from "react";
import type { Message } from "../lib/types";
import ChatMessage from "./ChatMessage";

const STICK_THRESHOLD_PX = 80;
const STAGGER_MS = 40;
const MAX_STAGGERED = 6;

interface Props {
  messages: Message[];
  generating: boolean;
  /** Replace the turn at this index with a new message (edit-and-resubmit). */
  onEdit: (turnIndex: number, text: string) => void;
  /** Answer the question at this turn index again. */
  onRegenerate: (turnIndex: number) => void;
  /** Rate the answer at this turn index; null clears the rating. */
  onFeedback?: (turnIndex: number, rating: "up" | "down" | null) => void;
  /** Turn ids whose rating request is in flight. */
  feedbackBusy?: ReadonlySet<string>;
}

function ThinkingIndicator() {
  return (
    <div
      className="flex animate-message-in items-center gap-1.5 py-2 text-muted"
      role="status"
      aria-label="Thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Messages alternate user, assistant, so message index i belongs to turn floor(i / 2). */
const turnOf = (messageIndex: number) => Math.floor(messageIndex / 2);

export default function MessageList({
  messages,
  generating,
  onEdit,
  onRegenerate,
  onFeedback,
  feedbackBusy,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < STICK_THRESHOLD_PX;
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A message the user just sent always scrolls into view; otherwise only follow
    // new content while the reader is already at the bottom.
    if (messages[messages.length - 1]?.role === "user") stickToBottom.current = true;
    if (stickToBottom.current) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [messages, generating]);

  const lastAssistant = messages.length - 1;

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-6" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className="animate-message-in"
            style={{ animationDelay: `${Math.min(i, MAX_STAGGERED) * STAGGER_MS}ms` }}
          >
            <ChatMessage
              {...m}
              canAct={!generating}
              onEdit={m.role === "user" ? (text) => onEdit(turnOf(i), text) : undefined}
              onRegenerate={
                m.role === "assistant" && i === lastAssistant ? () => onRegenerate(turnOf(i)) : undefined
              }
              onFeedback={
                m.role === "assistant" && m.turnId && onFeedback
                  ? (rating) => onFeedback(turnOf(i), rating)
                  : undefined
              }
              feedbackBusy={m.turnId ? feedbackBusy?.has(m.turnId) : false}
            />
          </div>
        ))}
        {generating && <ThinkingIndicator />}
      </div>
    </div>
  );
}
