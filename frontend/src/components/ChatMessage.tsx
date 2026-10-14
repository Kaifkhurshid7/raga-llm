import { isUncertain } from "../lib/uncertainty";
import type { Message } from "../lib/types";
import Markdown from "./Markdown";

type Props = Message;

export default function ChatMessage({ role, content, modelVersion }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5 text-[15px] leading-6">
          {content}
        </p>
      </div>
    );
  }

  const uncertain = isUncertain(content);
  return (
    <div className="text-[15px]">
      <Markdown>{content}</Markdown>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
        {modelVersion && <span>{modelVersion}</span>}
        {uncertain && (
          <span className="rounded-full border border-line px-2 py-0.5">uncertain</span>
        )}
      </p>
    </div>
  );
}
