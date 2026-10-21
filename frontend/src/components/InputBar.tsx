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
  const hasText = value.trim().length > 0;
  const canSend = hasText && !generating;

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
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-raised px-4 py-2 transition-colors duration-150 focus-within:border-faint">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          placeholder="Ask about a raga, taal, or musical concept..."
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-[168px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-faint"
        />

        <div className="relative h-9 w-9 shrink-0">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send message"
            tabIndex={generating ? -1 : 0}
            className={`absolute inset-0 flex items-center justify-center rounded-full transition-[background-color,opacity,transform] duration-150 ease-out ${
              generating
                ? "pointer-events-none scale-90 bg-overlay text-muted opacity-0"
                : hasText
                  ? "bg-accent text-accent-fg opacity-100 hover:scale-105 hover:bg-accent-hover active:scale-95"
                  : "cursor-default bg-overlay text-muted opacity-50"
            }`}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
          <StopButton onClick={onStop} visible={generating} />
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-faint">
        Research assistant · Verify important musicological details against trusted sources.
      </p>
    </div>
  );
}
