import { useMemo, useState } from "react";
import type { SessionSummary } from "../lib/api";
import { groupByDate } from "../lib/grouping";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import {
  ChevronRightIcon,
  CloseIcon,
  GearIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
} from "./icons";
import SessionRow from "./SessionRow";

export type SessionsStatus = "loading" | "ready" | "error";

export interface SidebarNotice {
  text: string;
  kind: "info" | "error";
}

interface Props {
  sessions: SessionSummary[];
  status: SessionsStatus;
  onRetry: () => void;
  activeId?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onTogglePin: (session: SessionSummary) => void;
  onShareSession: (session: SessionSummary) => void;
  /** Result of a conversation action, shown until dismissed. */
  notice: SidebarNotice | null;
  onDismissNotice: () => void;
  /** Icon-only rail (desktop only). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Rendered inside the mobile drawer: always expanded, with a close button. */
  onClose?: () => void;
  userName: string;
  userPhoto: string | null;
  settingsActive: boolean;
  onOpenSettings: () => void;
}

const EXPANDED_WIDTH = "w-[272px]";
const RAIL_WIDTH = "w-14";

const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink";

function SessionSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2" role="status" aria-label="Loading conversations">
      {[70, 55, 80].map((w) => (
        <div key={w} className="h-8 animate-pulse rounded-lg bg-overlay" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

export default function Sidebar({
  sessions,
  status,
  onRetry,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  onTogglePin,
  onShareSession,
  notice,
  onDismissNotice,
  collapsed,
  onToggleCollapsed,
  onClose,
  userName,
  userPhoto,
  settingsActive,
  onOpenSettings,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(null);
  const groups = useMemo(() => groupByDate(sessions), [sessions]);
  const focusable = !collapsed;

  // Collapsing: labels fade first, then the width shrinks. Expanding: width grows, then labels fade in.
  const widthMotion = collapsed ? "delay-100" : "delay-0";
  const fullMotion = collapsed ? "invisible opacity-0 delay-0" : "visible opacity-100 delay-150";
  const railMotion = collapsed ? "visible opacity-100 delay-150" : "invisible opacity-0 delay-0";

  return (
    <aside
      aria-label="Conversations"
      className={`relative h-full shrink-0 overflow-hidden border-r border-line bg-surface transition-[width] duration-200 ease-in-out ${widthMotion} ${
        collapsed ? RAIL_WIDTH : EXPANDED_WIDTH
      }`}
    >
      {/* Icon rail */}
      <div
        aria-hidden={!collapsed}
        className={`absolute inset-y-0 left-0 flex ${RAIL_WIDTH} flex-col items-center gap-2 py-3 transition-[opacity,visibility] duration-100 ${railMotion}`}
      >
        <button className={iconButton} onClick={onToggleCollapsed} aria-label="Expand sidebar">
          <SidebarIcon />
        </button>
        <button className={iconButton} onClick={onNewChat} aria-label="New chat" title="New chat">
          <PlusIcon />
        </button>
        <span className="mt-auto pb-2 text-xs font-semibold tracking-widest text-faint">RAGA</span>
      </div>

      {/* Full sidebar */}
      <div
        aria-hidden={collapsed}
        className={`absolute inset-y-0 left-0 flex ${EXPANDED_WIDTH} flex-col transition-[opacity,visibility] duration-100 ${fullMotion}`}
      >
        <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <p className="text-lg font-semibold leading-none tracking-[0.12em]">RAGA</p>
            <p className="mt-1.5 text-xs leading-4 text-muted">Raga-aware generative assistant</p>
          </div>
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

        <div className="px-4 pb-3">
          <button
            onClick={onNewChat}
            tabIndex={focusable ? 0 : -1}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-raised text-sm font-medium transition-colors duration-100 hover:bg-overlay"
          >
            <PlusIcon className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="px-4 pb-3">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgb(var(--accent)/0.15)]">
            <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search conversations…"
              aria-label="Search conversations"
              tabIndex={focusable ? 0 : -1}
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </label>
        </div>

        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted"
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label="Dismiss message"
              tabIndex={focusable ? 0 : -1}
              className="shrink-0 text-faint hover:text-ink"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-2" aria-label="Recent conversations">
          {status === "error" && (
            <div role="alert" className="mx-2 my-2 rounded-lg border border-line bg-raised p-3 text-sm">
              <p className="text-muted">Couldn't load conversations.</p>
              <button
                type="button"
                onClick={onRetry}
                tabIndex={focusable ? 0 : -1}
                className="mt-2 text-sm font-medium text-accent hover:underline"
              >
                Try again
              </button>
            </div>
          )}
          {status === "loading" && sessions.length === 0 && <SessionSkeleton />}
          {status === "ready" && groups.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {query.trim() ? "No matching conversations." : "Your conversations will appear here."}
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label} className="mb-3">
              <h3 className="px-3 py-1.5 text-xs font-medium text-faint">{group.label}</h3>
              <ul>
                {group.sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    focusable={focusable}
                    onSelect={onSelect}
                    onRename={onRenameSession}
                    onTogglePin={onTogglePin}
                    onShare={onShareSession}
                    onRequestDelete={setPendingDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <button
            onClick={onOpenSettings}
            aria-current={settingsActive ? "page" : undefined}
            tabIndex={focusable ? 0 : -1}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 hover:bg-overlay ${
              settingsActive ? "bg-overlay" : ""
            }`}
          >
            <GearIcon className="h-[18px] w-[18px] text-muted" />
            <span className="flex-1 text-sm">Settings</span>
            <ChevronRightIcon className="h-4 w-4 text-faint" />
          </button>
          <button
            onClick={onOpenSettings}
            tabIndex={focusable ? 0 : -1}
            aria-label={`Profile: ${userName}`}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 hover:bg-overlay"
          >
            <Avatar name={userName} photo={userPhoto} className="h-7 w-7 text-xs" />
            <span className="truncate text-sm">{userName}</span>
          </button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this conversation?"
          message={`"${pendingDelete.title}" and all of its messages will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDeleteSession(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </aside>
  );
}
