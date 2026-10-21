import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ExportFormat } from "../lib/export";
import {
  ArchiveIcon,
  DownloadIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";

interface Props {
  /** A new chat with no messages: only Share and Rename make sense, so the rest are left out. */
  empty?: boolean;
  pinned: boolean;
  onShare: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onExport: (format: ExportFormat) => void;
  onArchive: () => void;
  onDelete: () => void;
}

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 hover:bg-overlay focus-visible:bg-overlay focus-visible:outline-none";

function Item({
  icon,
  children,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={`${itemClass} ${danger ? "text-red-600 dark:text-red-400" : ""}`}
    >
      <span className={danger ? "" : "text-muted"}>{icon}</span>
      {children}
    </button>
  );
}

const Divider = () => <div role="separator" className="my-1 h-px bg-line" />;

/** Share button and three-dot menu for the conversation open in the chat. */
export default function HeaderActions({
  empty = false,
  pinned,
  onShare,
  onRename,
  onTogglePin,
  onExport,
  onArchive,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(action: () => void) {
    close();
    action();
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") close();
  }

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onShare}
        aria-label="Share conversation"
        title="Share conversation"
        className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink"
      >
        <ShareIcon className="h-[18px] w-[18px]" />
        <span className="hidden sm:inline">Share</span>
      </button>

      <button
        ref={buttonRef}
        type="button"
        aria-label="Conversation options"
        title="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink aria-expanded:bg-overlay aria-expanded:text-ink"
      >
        <MoreIcon />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Conversation options"
          onKeyDown={handleKey}
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-line bg-raised p-1.5 shadow-lg"
        >
          <Item icon={<PencilIcon className="h-4 w-4" />} onClick={() => choose(onRename)}>
            Rename
          </Item>
          {!empty && (
            <Item
              icon={pinned ? <PinOffIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
              onClick={() => choose(onTogglePin)}
            >
              {pinned ? "Unpin" : "Pin"}
            </Item>
          )}
          {!empty && <Divider />}
          {!empty && (
            <>
              <Item icon={<DownloadIcon className="h-4 w-4" />} onClick={() => choose(() => onExport("markdown"))}>
                Export as Markdown
              </Item>
              <Item icon={<DownloadIcon className="h-4 w-4" />} onClick={() => choose(() => onExport("pdf"))}>
                Export as PDF
              </Item>
              <Divider />
              <Item icon={<ArchiveIcon className="h-4 w-4" />} onClick={() => choose(onArchive)}>
                Archive
              </Item>
              <Item danger icon={<TrashIcon className="h-4 w-4" />} onClick={() => choose(onDelete)}>
                Delete
              </Item>
            </>
          )}
        </div>
      )}
    </div>
  );
}
