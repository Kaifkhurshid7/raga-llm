import { useMemo, useState } from "react";
import type { SessionSummary } from "../lib/api";
import { groupByDate } from "../lib/grouping";
import { CloseIcon, InfoIcon, PlusIcon, SearchIcon, SidebarIcon } from "./icons";

interface Props {
  sessions: SessionSummary[];
  activeId?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** Icon-only rail (desktop only). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Rendered inside the mobile drawer: always expanded, with a close button. */
  onClose?: () => void;
}

const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bubble hover:text-ink";

export default function Sidebar({
  sessions,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNewChat,
  collapsed,
  onToggleCollapsed,
  onClose,
}: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const groups = useMemo(() => groupByDate(sessions), [sessions]);

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-3">
        <button className={iconButton} onClick={onToggleCollapsed} aria-label="Expand sidebar">
          <SidebarIcon />
        </button>
        <button className={iconButton} onClick={onNewChat} aria-label="New chat" title="New chat">
          <PlusIcon />
        </button>
        <div className="mt-auto flex flex-col items-center gap-1">
          <span className="font-serif text-xs font-semibold tracking-widest text-muted">RAGA</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={onNewChat}
          className="flex h-9 flex-1 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-bubble"
        >
          <PlusIcon className="h-4 w-4" />
          New chat
        </button>
        {onClose ? (
          <button className={iconButton} onClick={onClose} aria-label="Close sidebar">
            <CloseIcon />
          </button>
        ) : (
          <button className={iconButton} onClick={onToggleCollapsed} aria-label="Collapse sidebar">
            <SidebarIcon />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-1.5 focus-within:border-muted">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">
            {query.trim() ? "No matching conversations." : "No conversations yet."}
          </p>
        )}
        {groups.map((group) => (
          <section key={group.label} className="mb-3">
            <h3 className="px-3 py-1.5 text-xs font-medium text-muted">{group.label}</h3>
            <ul>
              {group.sessions.map((s) => {
                const active = s.id === activeId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => onSelect(s.id)}
                      aria-current={active ? "page" : undefined}
                      title={s.title}
                      className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                        active
                          ? "bg-accent/15 font-medium text-accent"
                          : "hover:bg-bubble"
                      }`}
                    >
                      {s.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className="relative flex items-center justify-between border-t border-line px-4 py-3">
        <span className="font-serif text-sm font-semibold tracking-widest">RAGA</span>
        <button
          className={iconButton}
          onClick={() => setShowInfo((v) => !v)}
          aria-label="About RAGA"
          aria-expanded={showInfo}
        >
          <InfoIcon />
        </button>
        {showInfo && (
          <div className="absolute bottom-14 right-3 left-3 rounded-xl border border-line bg-page p-3 text-xs leading-5 text-muted shadow-sm">
            RAGA is a research assistant for Hindustani classical music. It is tuned to say when
            it can't verify a fact instead of guessing.
          </div>
        )}
      </div>
    </aside>
  );
}
