import type { Message } from "../lib/types";
import HomeScreen from "./HomeScreen";
import { CloseIcon } from "./icons";
import InputBar from "./InputBar";
import MessageList from "./MessageList";

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
  onRetry,
  onDismissError,
}: Props) {
  const isHome = messages.length === 0 && !generating;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isHome ? (
        <div className="flex-1 overflow-y-auto">
          <HomeScreen onPrompt={onPrompt} />
        </div>
      ) : (
        <MessageList
          messages={messages}
          generating={generating}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
        />
      )}

      <div className="mx-auto w-full max-w-[760px]">
        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 flex items-start justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-sm"
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
