import type { Message } from "../lib/types";
import { useElementWidth } from "../hooks/useElementWidth";
import HomeIllustration from "./HomeIllustration";
import HomeScreen from "./HomeScreen";
import { CloseIcon } from "./icons";
import InputBar from "./InputBar";
import MessageList from "./MessageList";

/** The welcome content (the widest row is the suggestion pills) is centred in this width. */
const WELCOME_WIDTH_PX = 640;
/** Clear space kept between the welcome content and the drawing, plus its right inset. */
const ILLUSTRATION_MARGIN_PX = 56;
const ILLUSTRATION_MIN_PX = 150;
const ILLUSTRATION_MAX_PX = 300;

interface Props {
  messages: Message[];
  generating: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onPrompt: (query: string) => void;
  onEdit: (turnIndex: number, text: string) => void;
  onRegenerate: (turnIndex: number) => void;
  onFeedback?: (turnIndex: number, rating: "up" | "down" | null) => void;
  feedbackBusy?: ReadonlySet<string>;
  /** Present when the failed request can be repeated. */
  onRetry?: () => void;
  onDismissError: () => void;
}

export default function ChatPanel({
  messages,
  generating,
  error,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onPrompt,
  onEdit,
  onRegenerate,
  onFeedback,
  feedbackBusy,
  onRetry,
  onDismissError,
}: Props) {
  const isHome = messages.length === 0 && !generating;
  const [homeRef, homeWidth] = useElementWidth<HTMLDivElement>();
  // Fit the drawing into the gutter beside the welcome text; show it only if it is big enough to read.
  const gutter = Math.min(
    ILLUSTRATION_MAX_PX,
    Math.floor((homeWidth - WELCOME_WIDTH_PX) / 2 - ILLUSTRATION_MARGIN_PX)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isHome ? (
        <div ref={homeRef} className="relative min-h-0 flex-1">
          {gutter >= ILLUSTRATION_MIN_PX && (
            <HomeIllustration
              style={{ width: gutter }}
              className="pointer-events-none absolute inset-y-4 right-6"
            />
          )}
          <div className="relative h-full overflow-y-auto">
            <HomeScreen onPrompt={onPrompt} />
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages}
          generating={generating}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          feedbackBusy={feedbackBusy}
        />
      )}

      <div className="mx-auto w-full max-w-[948px]">
        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 flex items-start justify-between gap-3 sm:mx-6 rounded-lg border border-line bg-raised px-3 py-2 text-sm"
          >
            <span className="text-muted">{error}</span>
            <span className="flex shrink-0 items-center gap-2">
              {onRetry && !generating && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-medium text-accent hover:underline"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="text-faint hover:text-ink"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </span>
          </div>
        )}
        <InputBar
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSend}
          onStop={onStop}
          generating={generating}
        />
      </div>
    </div>
  );
}
