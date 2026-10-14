import { useEffect, useRef, useState } from "react";
import type { Message } from "../lib/types";
import ChatMessage from "./ChatMessage";

const STICK_THRESHOLD_PX = 80;
const STAGGER_MS = 40;
const MAX_STAGGERED = 6;

interface Props {
  messages: Message[];
  generating: boolean;
  error: string | null;
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

export default function MessageList({ messages, generating, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // The hero fades in once, on first load, and not when returning to an empty chat.
  const [introPlayed, setIntroPlayed] = useState(false);

  useEffect(() => {
    if (messages.length > 0) setIntroPlayed(true);
  }, [messages.length]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < STICK_THRESHOLD_PX;
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A message the user just sent always scrolls into view.
    if (messages[messages.length - 1]?.role === "user") stickToBottom.current = true;
    if (stickToBottom.current) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [messages, generating, error]);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
      <div
        className="mx-auto flex min-h-full max-w-[760px] flex-col gap-6 px-4 py-6"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className={`my-auto text-center ${introPlayed ? "" : "animate-hero-in"}`}>
            <h2 className="font-serif text-3xl">Ask about a raga.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Vadi, samvadi, thaat, aroha, avaroha — ask anything, and I'll say when I'm not
              sure.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="animate-message-in"
            style={{ animationDelay: `${Math.min(i, MAX_STAGGERED) * STAGGER_MS}ms` }}
          >
            <ChatMessage {...m} />
          </div>
        ))}
        {generating && <ThinkingIndicator />}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
