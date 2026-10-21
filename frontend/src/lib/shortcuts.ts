export const isMac = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Label for the primary modifier on this platform. */
export const modKey = (): string => (isMac() ? "⌘" : "Ctrl");

export interface Shortcut {
  keys: string[];
  action: string;
}

export function shortcutList(): Shortcut[] {
  const mod = modKey();
  return [
    { keys: [mod, "Shift", "O"], action: "New chat" },
    { keys: [mod, "K"], action: "Search conversations" },
    { keys: ["?"], action: "Show keyboard shortcuts" },
    { keys: ["Enter"], action: "Send message" },
    { keys: ["Shift", "Enter"], action: "New line" },
    { keys: ["Esc"], action: "Close a dialog or menu, or cancel editing" },
  ];
}

/** True when the keystroke is going into a text field, so single-key shortcuts must stay out of the way. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Primary modifier held (Cmd on macOS, Ctrl elsewhere) without the other one. */
export function hasMod(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}
