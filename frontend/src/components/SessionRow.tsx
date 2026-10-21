import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { SessionSummary } from "../lib/api";
import type { ExportFormat } from "../lib/export";
import Highlight from "./Highlight";
import {
  ArchiveIcon,
  DownloadIcon,
  LinkIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  ShareIcon,
  SpinnerIcon,
  TrashIcon,
} from "./icons";

interface Props {
  session: SessionSummary;
  active: boolean;
  /** Keeps hidden rows (collapsed sidebar) out of the tab order. */
  focusable: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (session: SessionSummary) => void;
  onShare: (session: SessionSummary) => void;
  onExport: (session: SessionSummary, format: ExportFormat) => void;
  onArchive: (session: SessionSummary) => void;
  /** Current search text, used to highlight matches. */
  query: string;
  /** A request for this conversation is in flight; its actions are disabled. */
  busy: boolean;
  onRequestDelete: (session: SessionSummary) => void;
}

const MENU_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 hover:bg-overlay focus-visible:bg-overlay focus-visible:outline-none";

function MenuItem({
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

export default function SessionRow({
  session,
  active,
  focusable,
  onSelect,
  onRename,
  onTogglePin,
  onShare,
  onExport,
  onArchive,
  query,
  busy,
  onRequestDelete,
}: Props) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabIndex = focusable ? 0 : -1;
  const menuOpen = menu !== null;
  const pinned = Boolean(session.pinned);

  function closeMenu(returnFocus = false) {
    setMenu(null);
    if (returnFocus) menuButtonRef.current?.focus();
  }

  function openMenu() {
    const button = menuButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    // Open beside the sidebar, never over the list it belongs to.
    const sidebarRight = button.closest("aside")?.getBoundingClientRect().right ?? rect.right;
    setMenu({ top: rect.top, left: sidebarRight + MENU_GAP_PX });
  }

  // Keep the menu fully on screen, then move focus into it.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const maxTop = window.innerHeight - el.offsetHeight - VIEWPORT_MARGIN_PX;
    const maxLeft = window.innerWidth - el.offsetWidth - VIEWPORT_MARGIN_PX;
    el.style.top = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(menu.top - MENU_GAP_PX, maxTop))}px`;
    el.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(menu.left, maxLeft))}px`;
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenu(null);
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function handleMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  }

  function startRename() {
    closeMenu();
    setDraft(session.title);
    setEditing(true);
  }

  function commitRename() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== session.title) onRename(session.id, next);
  }

  function handleEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditing(false);
  }

  function choose(action: () => void) {
    closeMenu();
    action();
  }

  return (
    <li className="group relative">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={120}
          aria-label={`Rename conversation ${session.title}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleEditKey}
          className="w-full rounded-lg border border-accent bg-raised px-3 py-2 text-sm outline-none"
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            aria-current={active ? "page" : undefined}
            title={session.title}
            tabIndex={tabIndex}
            className={`block w-full rounded-lg py-2 pl-3 pr-9 text-left text-sm transition-colors duration-100 hover:bg-overlay ${
              active ? "bg-overlay font-medium" : ""
            } ${busy ? "opacity-60" : ""}`}
          >
            <span className="block truncate">
              <Highlight text={session.title} query={query} />
            </span>
            {session.snippet && (
              <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                <Highlight text={session.snippet} query={query} />
              </span>
            )}
          </button>

          {busy && (
            <SpinnerIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          )}

          {!busy && session.shared && !pinned && !menuOpen && (
            <span
              title="Shared with a public link"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-opacity duration-100 group-focus-within:opacity-0 group-hover:opacity-0"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span className="sr-only">Shared with a public link</span>
            </span>
          )}

          {!busy && pinned && !menuOpen && (
            <PinIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint transition-opacity duration-100 group-focus-within:opacity-0 group-hover:opacity-0" />
          )}

          <button
            ref={menuButtonRef}
            type="button"
            aria-label={`Options for ${session.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            tabIndex={tabIndex}
            disabled={busy}
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-opacity duration-100 hover:bg-overlay hover:text-ink focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
              menuOpen || active ? "opacity-100" : "opacity-0"
            }`}
          >
            <MoreIcon className="h-4 w-4" />
          </button>

          {menu &&
            createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${session.title}`}
                onKeyDown={handleMenuKey}
                style={{ top: menu.top, left: menu.left }}
                className="fixed z-50 w-52 rounded-xl border border-line bg-raised p-1.5 shadow-lg"
              >
                <MenuItem icon={<PencilIcon className="h-4 w-4" />} onClick={startRename}>
                  Rename
                </MenuItem>
                <MenuItem
                  icon={
                    pinned ? <PinOffIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />
                  }
                  onClick={() => choose(() => onTogglePin(session))}
                >
                  {pinned ? "Unpin" : "Pin"}
                </MenuItem>
                <MenuItem
                  icon={<ShareIcon className="h-4 w-4" />}
                  onClick={() => choose(() => onShare(session))}
                >
                  Share
                </MenuItem>
                <Divider />
                <MenuItem
                  icon={<DownloadIcon className="h-4 w-4" />}
                  onClick={() => choose(() => onExport(session, "markdown"))}
                >
                  Export as Markdown
                </MenuItem>
                <MenuItem
                  icon={<DownloadIcon className="h-4 w-4" />}
                  onClick={() => choose(() => onExport(session, "pdf"))}
                >
                  Export as PDF
                </MenuItem>
                <Divider />
                <MenuItem
                  icon={<ArchiveIcon className="h-4 w-4" />}
                  onClick={() => choose(() => onArchive(session))}
                >
                  Archive
                </MenuItem>
                <MenuItem
                  danger
                  icon={<TrashIcon className="h-4 w-4" />}
                  onClick={() => choose(() => onRequestDelete(session))}
                >
                  Delete
                </MenuItem>
              </div>,
              document.body
            )}
        </>
      )}
    </li>
  );
}
