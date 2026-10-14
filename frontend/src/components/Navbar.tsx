import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Theme } from "../hooks/useTheme";
import { MenuIcon, MoonIcon, SunIcon } from "./icons";

interface Props {
  title: string;
  canRename: boolean;
  onRename: (title: string) => void;
  badge: string | null;
  theme: Theme;
  onToggleTheme: () => void;
  showMenuButton: boolean;
  onOpenMenu: () => void;
}

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink";

export default function Navbar({
  title,
  canRename,
  onRename,
  badge,
  theme,
  onToggleTheme,
  showMenuButton,
  onOpenMenu,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    if (!canRename) return;
    setDraft(title);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
      {showMenuButton && (
        <button type="button" className={iconButton} onClick={onOpenMenu} aria-label="Open sidebar">
          <MenuIcon />
        </button>
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={120}
            aria-label="Conversation title"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="w-full max-w-md rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-muted"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={!canRename}
            title={canRename ? "Click to rename" : undefined}
            className="max-w-full truncate rounded-md px-2 py-1 text-left text-sm font-medium enabled:hover:bg-surface"
          >
            {title}
          </button>
        )}
      </div>

      {badge && (
        <span className="hidden shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted sm:inline">
          {badge}
        </span>
      )}

      <button
        type="button"
        className={iconButton}
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
