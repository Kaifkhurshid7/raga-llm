import { shortcutList } from "../lib/shortcuts";
import Dialog from "./Dialog";

export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-line bg-page px-1.5 py-0.5 font-sans text-xs">{children}</kbd>
  );
}

export function ShortcutRows() {
  return (
    <dl className="divide-y divide-line text-sm">
      {shortcutList().map((s) => (
        <div key={s.action} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">{s.action}</dt>
          <dd className="flex shrink-0 items-center gap-1">
            {s.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <div className="mt-2">
        <ShortcutRows />
      </div>
    </Dialog>
  );
}
