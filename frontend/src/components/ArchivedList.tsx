import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  SESSIONS_PAGE_SIZE,
  deleteSession,
  listSessions,
  setArchived,
  type SessionSummary,
} from "../lib/api";
import ConfirmDialog from "./ConfirmDialog";
import { RestoreIcon, SpinnerIcon, TrashIcon } from "./icons";
import { useToast } from "./Toast";

interface Props {
  /** Called after a conversation is restored or deleted, so the sidebar can refresh. */
  onChanged: () => void;
  /** Open a conversation in the chat view without restoring it. */
  onOpen: (id: string) => void;
}

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

export default function ArchivedList({ onChanged, onOpen }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    listSessions({ archived: true, limit: SESSIONS_PAGE_SIZE })
      .then((list) => {
        setItems(list);
        setHasMore(list.length === SESSIONS_PAGE_SIZE);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(load, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await listSessions({
        archived: true,
        limit: SESSIONS_PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...next]);
      setHasMore(next.length === SESSIONS_PAGE_SIZE);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't load more.", { kind: "error" });
    } finally {
      setLoadingMore(false);
    }
  }

  async function restore(s: SessionSummary) {
    if (busy) return;
    setBusy(s.id);
    try {
      await setArchived(s.id, false);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      onChanged();
      toast("Conversation restored", { kind: "success" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't restore the conversation.", {
        kind: "error",
        action: { label: "Retry", onClick: () => void restore(s) },
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: SessionSummary) {
    if (busy) return;
    setBusy(s.id);
    try {
      await deleteSession(s.id);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      onChanged();
      toast("Conversation deleted", { kind: "success" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't delete the conversation.", { kind: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 p-5 text-sm text-muted">
        <SpinnerIcon /> Loading archived conversations…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="p-5 text-sm">
        <p className="text-muted">Couldn't load archived conversations.</p>
        <button type="button" onClick={load} className="mt-2 font-medium text-accent hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="p-5 text-sm text-muted">No archived conversations. Archive one from its sidebar menu.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-5 py-2.5">
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="min-w-0 flex-1 text-left hover:underline"
              title="Open without restoring"
            >
              <span className="block truncate text-sm">{s.title}</span>
              <span className="block text-xs text-faint">
                Last active {new Date(s.updated_at).toLocaleDateString()}
              </span>
            </button>
            {busy === s.id ? (
              <SpinnerIcon className="mx-2 h-4 w-4 text-faint" />
            ) : (
              <>
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy !== null}
                  onClick={() => restore(s)}
                  aria-label={`Restore ${s.title}`}
                  title="Restore"
                >
                  <RestoreIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy !== null}
                  onClick={() => setPendingDelete(s)}
                  aria-label={`Delete ${s.title}`}
                  title="Delete permanently"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm text-muted hover:bg-overlay hover:text-ink disabled:opacity-60"
          >
            {loadingMore && <SpinnerIcon />}
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this conversation?"
          message={`"${pendingDelete.title}" and all of its messages will be permanently deleted, and any share link stops working. This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void remove(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
