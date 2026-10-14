import type { Message } from "../lib/types";
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
}

export default function ChatPanel({
  messages,
  generating,
  error,
  draft,
  onDraftChange,
  onSend,
  onStop,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} generating={generating} error={error} />
      <div className="mx-auto w-full max-w-[760px]">
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
