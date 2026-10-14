import { useEffect, useRef } from "react";
import type { Message } from "../lib/types";
import ChatMessage from "./ChatMessage";

const STICK_THRESHOLD_PX = 80;

interface Props {
  messages: Message[];
  generating: boolean;
  error: string | null;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2 text-muted" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="thinking-dot h-1.5 w-1.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

export default function MessageList({ messages, generating, error }: Props) {
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
    // A message the user just sent always scrolls into view.
    if (messages[messages.length - 1]?.role === "user") stickToBottom.current = true;
    if (stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, generating, error]);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="mt-24 text-center">
            <h2 className="font-serif text-3xl">What would you like to know?</h2>
            <p className="mt-3 text-sm text-muted">
              Ask about a raga's vadi, samvadi, thaat, or aroha and avaroha.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} {...m} />
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
