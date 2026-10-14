import { useMemo } from "react";
import type { SessionSummary } from "../lib/api";
import { groupByDate } from "../lib/grouping";
import {
  ChevronRightIcon,
  CloseIcon,
  GearIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
} from "./icons";
import Avatar from "./Avatar";

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
  userName: string;
  userPhoto: string | null;
  settingsActive: boolean;
  onOpenSettings: () => void;
}

const EXPANDED_WIDTH = "w-[280px]";
const RAIL_WIDTH = "w-14";

const iconButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink";

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
  userName,
  userPhoto,
  settingsActive,
  onOpenSettings,
}: Props) {
  const groups = useMemo(() => groupByDate(sessions), [sessions]);

  // Collapsing: labels fade first, then the width shrinks. Expanding: width grows, then labels fade in.
  const widthMotion = collapsed ? "delay-100" : "delay-0";
  const fullMotion = collapsed ? "invisible opacity-0 delay-0" : "visible opacity-100 delay-150";
  const railMotion = collapsed ? "visible opacity-100 delay-150" : "invisible opacity-0 delay-0";

  return (
    <aside
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
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-sm font-semibold tracking-widest">RAGA</span>
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

        <div className="px-3 pb-2 pt-2">
          <button
            onClick={onNewChat}
            className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-100 hover:bg-overlay"
          >
            <PlusIcon className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="px-3 pb-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgb(var(--accent)/0.15)]">
            <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              tabIndex={collapsed ? -1 : 0}
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </label>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {query.trim() ? "No matching conversations." : "Your conversations will appear here."}
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label} className="mb-3">
              <h3 className="px-3 py-1.5 text-xs font-medium text-faint">{group.label}</h3>
              <ul>
                {group.sessions.map((s) => {
                  const active = s.id === activeId;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => onSelect(s.id)}
                        aria-current={active ? "page" : undefined}
                        title={s.title}
                        tabIndex={collapsed ? -1 : 0}
                        className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 hover:bg-overlay ${
                          active ? "bg-overlay font-medium text-accent" : ""
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

        <div className="p-3">
          <div className="overflow-hidden rounded-xl border border-line bg-raised">
            <button
              onClick={onOpenSettings}
              aria-current={settingsActive ? "page" : undefined}
              tabIndex={collapsed ? -1 : 0}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-100 hover:bg-overlay ${
                settingsActive ? "bg-overlay" : ""
              }`}
            >
              <GearIcon className="h-5 w-5 text-muted" />
              <span className="flex-1 text-sm text-muted">Settings</span>
              <ChevronRightIcon className="h-4 w-4 text-faint" />
            </button>

            <button
              onClick={onOpenSettings}
              tabIndex={collapsed ? -1 : 0}
              className="flex w-full items-center gap-3 border-t border-line px-3 py-3 text-left transition-colors duration-100 hover:bg-overlay"
            >
              <Avatar name={userName} photo={userPhoto} className="h-8 w-8 text-sm" />
              <span className="truncate text-sm font-medium">{userName}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
