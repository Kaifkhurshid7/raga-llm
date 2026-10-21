import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  enableShare,
  getShare,
  revokeShare,
  shareUrl,
  type ShareState,
} from "../lib/api";
import Dialog from "./Dialog";
import { CheckIcon, CopyIcon, SpinnerIcon } from "./icons";
import { useToast } from "./Toast";

interface Props {
  session: { id: string; title: string };
  onClose: () => void;
  /** Called after sharing is turned on or off, so the conversation list can refresh. */
  onChanged: () => void;
}

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm transition-colors duration-100 hover:bg-overlay disabled:opacity-40 disabled:hover:bg-transparent";

type Access = "private" | "link";

const OPTIONS: { value: Access; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "No public link. Sharing is off." },
  { value: "link", label: "Anyone with the link", hint: "Read-only. No sign-in is needed to open it." },
];

export default function ShareDialog({ session, onClose, onChanged }: Props) {
  const toast = useToast();
  const [state, setState] = useState<ShareState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    getShare(session.id)
      .then(setState)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Couldn't load sharing settings."));
  }, [session.id]);

  useEffect(load, [load]);

  /** Runs a sharing change; the dialog only shows the new state once the server confirms it. */
  async function run(action: () => Promise<ShareState | void>, success: string, failure: string) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await action();
      setState(next ?? { enabled: false, token: null, shared_at: null });
      setCopied(false);
      onChanged();
      toast(success, { kind: "success" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : failure, { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const enabled = Boolean(state?.enabled && state.token);
  const url = enabled && state?.token ? shareUrl(state.token) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied", { kind: "success" });
    } catch {
      toast("Couldn't copy. Select the link and copy it manually.", { kind: "error" });
    }
  }

  function choose(value: Access) {
    if (value === "link" && !enabled) {
      void run(() => enableShare(session.id), "Public link created", "Couldn't create the link.");
    } else if (value === "private" && enabled) {
      void run(
        async () => {
          await revokeShare(session.id);
        },
        "Sharing turned off. The link no longer works",
        "Couldn't turn sharing off."
      );
    }
  }

  return (
    <Dialog title="Share conversation" onClose={onClose}>
      <p className="mt-1 truncate text-sm text-muted" title={session.title}>
        {session.title}
      </p>

      {loadError ? (
        <div role="alert" className="mt-4 text-sm">
          <p className="text-muted">{loadError}</p>
          <button type="button" onClick={load} className="mt-2 font-medium text-accent hover:underline">
            Try again
          </button>
        </div>
      ) : !state ? (
        <div role="status" className="mt-6 flex items-center gap-2 text-sm text-muted">
          <SpinnerIcon /> Loading…
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Who can open this conversation" className="mt-4 space-y-2">
            {OPTIONS.map((o) => {
              const selected = (o.value === "link") === enabled;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => choose(o.value)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-100 disabled:opacity-60 ${
                    selected ? "border-faint bg-overlay" : "border-line hover:bg-overlay"
                  }`}
                >
                  <span
                    className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      selected ? "border-accent bg-accent" : "border-faint"
                    }`}
                  />
                  <span>
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {enabled && (
            <div className="mt-4">
              <label htmlFor="share-link" className="mb-1.5 block text-sm font-medium">
                Public link
              </label>
              <div className="flex gap-2">
                <input
                  id="share-link"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button type="button" onClick={copy} className={buttonClass} aria-label="Copy link">
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => enableShare(session.id, true), "New link created", "Couldn't create a new link.")
                }
                className="mt-2 text-xs text-muted hover:text-ink hover:underline disabled:opacity-40"
              >
                Create a new link (the current one stops working)
              </button>
            </div>
          )}

          <ul className="mt-4 space-y-1.5 text-xs text-muted">
            <li>Anyone who has the link can read this conversation, even if they forward it to others.</li>
            <li>
              The link shows the title and the messages only. Message feedback and model details are
              not included.
            </li>
            <li>Messages you add later appear on the shared page too.</li>
            <li>Turning sharing off or deleting the conversation disables the link immediately.</li>
            <li>
              RAGA has no accounts yet, so the link controls who can <em>read</em> a copy. It does not
              restrict who can manage conversations on this server.
            </li>
          </ul>

          <div className="mt-5 flex items-center justify-between">
            <span role="status" className="flex items-center gap-2 text-xs text-muted">
              {busy && (
                <>
                  <SpinnerIcon className="h-3.5 w-3.5" /> Working…
                </>
              )}
            </span>
            <button type="button" onClick={onClose} className={buttonClass}>
              Done
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
