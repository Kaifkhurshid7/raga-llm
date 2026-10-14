import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUpIcon } from "./icons";
import StopButton from "./StopButton";

const MAX_HEIGHT_PX = 168; // about six lines
const MAX_LENGTH = 2000;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  generating: boolean;
}

export default function InputBar({ value, onChange, onSubmit, onStop, generating }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !generating;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface px-4 py-2 focus-within:border-muted">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          placeholder="Ask about a raga…"
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-[168px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        {generating ? (
          <StopButton onClick={onStop} />
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-30"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        RAGA can be wrong about ragas it hasn't verified — it will tell you when it's not sure.
      </p>
    </div>
  );
}
