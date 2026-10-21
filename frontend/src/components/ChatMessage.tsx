import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Message } from "../lib/types";
import EvidencePanel from "./evidence/EvidencePanel";
import { CheckIcon, CopyIcon, PencilIcon, RefreshIcon } from "./icons";
import Markdown from "./Markdown";

interface Props extends Message {
  /** False while a request is in flight; edit and regenerate are hidden then. */
  canAct: boolean;
  /** Present on user messages: resubmit this turn with new text. */
  onEdit?: (text: string) => void;
  /** Present on the latest assistant message: answer the same question again. */
  onRegenerate?: () => void;
}

const COPIED_RESET_MS = 1800;

const actionClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors duration-100 hover:bg-overlay hover:text-ink focus-visible:text-ink";

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={actionClass}>
      {children}
    </button>
  );
}

function UserMessage({
  content,
  canAct,
  onEdit,
}: Pick<Props, "content" | "canAct" | "onEdit">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(draft.length, draft.length);
    }
    // Focus only when editing starts.
  }, [editing]);

  function save() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== content) onEdit?.(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <div className="ml-auto w-full max-w-[85%] rounded-xl border border-line bg-raised p-3">
        <textarea
          ref={fieldRef}
          value={draft}
          rows={3}
          maxLength={2000}
          aria-label="Edit your message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full resize-none bg-transparent text-[15px] leading-6 outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-8 rounded-lg border border-line px-3 text-sm transition-colors duration-100 hover:bg-overlay"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!draft.trim() || draft.trim() === content}
            className="h-8 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg transition-colors duration-100 hover:bg-accent-hover disabled:opacity-40"
          >
            Save and resend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5 text-[15px] leading-6">
        {content}
      </p>
      {onEdit && canAct && (
        <div className="mt-1 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <ActionButton
            label="Edit message"
            onClick={() => {
              setDraft(content);
              setEditing(true);
            }}
          >
            <PencilIcon className="h-4 w-4" />
          </ActionButton>
        </div>
      )}
    </div>
  );
}

export default function ChatMessage({
  role,
  content,
  modelVersion,
  evidence,
  canAct,
  onEdit,
  onRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      /* clipboard unavailable; leave the button unchanged */
    }
  }

  if (role === "user") return <UserMessage content={content} canAct={canAct} onEdit={onEdit} />;

  return (
    <div className="text-[15px]">
      <Markdown>{content}</Markdown>
      <EvidencePanel evidence={evidence} />
      <div className="mt-2 flex items-center gap-1 text-xs text-faint">
        <ActionButton label={copied ? "Copied" : "Copy response"} onClick={copy}>
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        </ActionButton>
        {onRegenerate && canAct && (
          <ActionButton label="Regenerate response" onClick={onRegenerate}>
            <RefreshIcon className="h-4 w-4" />
          </ActionButton>
        )}
        {modelVersion && <span className="ml-1">{modelVersion}</span>}
      </div>
    </div>
  );
}
