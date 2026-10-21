import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import ConfirmDialog from "./components/ConfirmDialog";
import Navbar from "./components/Navbar";
import SettingsPage from "./components/SettingsPage";
import ShareDialog from "./components/ShareDialog";
import ShortcutsDialog from "./components/ShortcutsDialog";
import Sidebar, { type SessionsStatus } from "./components/Sidebar";
import { ToastProvider, useToast } from "./components/Toast";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useProfile } from "./hooks/useProfile";
import { useTheme } from "./hooks/useTheme";
import {
  ApiError,
  SESSIONS_PAGE_SIZE,
  createSession,
  deleteSession,
  getHealth,
  type Health,
  getSession,
  isAbortError,
  listSessions,
  sendMessage,
  setArchived,
  setFeedback,
  updateSession,
  type Rating,
  type SessionSummary,
  type Turn,
} from "./lib/api";
import { EmptyConversationError, buildExport, downloadBlob, type ExportFormat } from "./lib/export";
import { printConversation } from "./lib/pdf";
import { hasMod, isTyping } from "./lib/shortcuts";
import { readStorage, writeStorage } from "./lib/storage";
import type { Message } from "./lib/types";

const SESSIONS_CACHE_KEY = "raga.sessions";
const SIDEBAR_COLLAPSED_KEY = "raga.sidebarCollapsed";
const SEARCH_DEBOUNCE_MS = 250;
const MAX_LOADED = 100;
const DEFAULT_TITLE = "RAGA";
const SETTINGS_TITLE = "Settings";

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function turnsToMessages(turns: Turn[]): Message[] {
  return turns.flatMap<Message>((t) => [
    { role: "user", content: t.user_message },
    {
      role: "assistant",
      content: t.model_response,
      turnId: t.id,
      feedback: t.feedback ?? null,
      modelVersion: t.model_version,
      servingCondition: t.serving_condition,
      evidence: t.evidence,
    },
  ]);
}

function AppShell() {
  const toast = useToast();
  const [theme, toggleTheme] = useTheme();
  const [profile, saveProfile] = useProfile();
  const [view, setView] = useState<"chat" | "settings">("chat");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    readStorage<SessionSummary[]>(SESSIONS_CACHE_KEY, [])
  );
  const [sessionsStatus, setSessionsStatus] = useState<SessionsStatus>("loading");
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStorage(SIDEBAR_COLLAPSED_KEY, false)
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [activeId, setActiveId] = useState<string | undefined>();
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The failed request that Retry repeats. For a plain send the text is back in the draft.
  const [retryAttempt, setRetryAttempt] = useState<{ text: string; replace?: number } | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<ReadonlySet<string>>(new Set());

  const [sharing, setSharing] = useState<SessionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // An edit of an earlier question that would discard later messages, waiting for confirmation.
  const [pendingEdit, setPendingEdit] = useState<{ turn: number; text: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const restoreDraftOnAbort = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // How many conversations the sidebar has loaded, so a refresh does not collapse "Show more".
  const loadedCount = useRef(SESSIONS_PAGE_SIZE);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshSessions = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load (and search) the first page of the session list from the backend.
  useEffect(() => {
    const controller = new AbortController();
    const searchingNow = query.trim().length > 0;
    if (searchingNow) setSearching(true);
    setSessionsStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const timer = setTimeout(
      async () => {
        const limit = Math.min(MAX_LOADED, Math.max(SESSIONS_PAGE_SIZE, loadedCount.current));
        try {
          const list = await listSessions({ query, limit }, controller.signal);
          if (controller.signal.aborted) return;
          setSessions(list);
          setHasMore(list.length === limit);
          loadedCount.current = Math.max(SESSIONS_PAGE_SIZE, list.length);
          setSessionsStatus("ready");
          if (!searchingNow) writeStorage(SESSIONS_CACHE_KEY, list.slice(0, SESSIONS_PAGE_SIZE));
        } catch (e) {
          if (!controller.signal.aborted && !isAbortError(e)) setSessionsStatus("error");
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      },
      searchingNow ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, refreshKey]);

  // A new search starts from one page again.
  useEffect(() => {
    loadedCount.current = SESSIONS_PAGE_SIZE;
  }, [query]);

  async function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listSessions({
        query,
        limit: SESSIONS_PAGE_SIZE,
        offset: sessions.length,
      });
      setSessions((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev, ...next.filter((s) => !seen.has(s.id))];
        loadedCount.current = merged.length;
        return merged;
      });
      setHasMore(next.length === SESSIONS_PAGE_SIZE);
    } catch (e) {
      toast(errorText(e, "Couldn't load more conversations."), {
        kind: "error",
        action: { label: "Retry", onClick: () => void handleLoadMore() },
      });
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => writeStorage(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed), [sidebarCollapsed]);

  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => undefined);
  }, []);

  // Serving condition before the first reply, so the badge is never empty.
  const defaultBadge = useMemo(
    () =>
      health
        ? [health.mock_inference ? "mock" : null, health.serving_condition].filter(Boolean).join(" · ")
        : null,
    [health]
  );

  const badge = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last?.modelVersion) return defaultBadge;
    return [last.modelVersion, last.servingCondition].filter(Boolean).join(" · ");
  }, [messages, defaultBadge]);

  function abortInFlight(restoreDraft: boolean) {
    restoreDraftOnAbort.current = restoreDraft;
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  }

  function resetConversation() {
    abortInFlight(false);
    setError(null);
    setRetryAttempt(null);
    setDraft("");
  }

  const handleNewChat = useCallback(() => {
    setView("chat");
    resetConversation();
    setActiveId(undefined);
    setTitle(DEFAULT_TITLE);
    setMessages([]);
    setDrawerOpen(false);
  }, []);

  async function handleSelect(id: string) {
    setView("chat");
    if (id === activeId) {
      setDrawerOpen(false);
      return;
    }
    resetConversation();
    setDrawerOpen(false);
    try {
      const detail = await getSession(id);
      setActiveId(detail.id);
      setTitle(detail.title);
      setMessages(turnsToMessages(detail.turns));
    } catch (e) {
      setError(errorText(e, "Couldn't load that conversation."));
    }
  }

  /**
   * Sends `override` (a suggestion) or the draft. With `replaceFromTurn`, that turn and everything
   * after it is replaced (regenerate and edit). On failure the conversation and the typed text are
   * restored, and the server leaves its copy unchanged, so nothing is lost.
   */
  async function handleSend(override?: string, replaceFromTurn?: number) {
    const text = (override ?? draft).trim();
    if (!text || generating) return;

    const replacing = replaceFromTurn !== undefined;
    const previous = messages;
    const controller = new AbortController();
    abortRef.current = controller;
    restoreDraftOnAbort.current = false;

    setView("chat");
    setMessages([
      ...(replacing ? messages.slice(0, replaceFromTurn * 2) : messages),
      { role: "user", content: text },
    ]);
    if (!replacing) setDraft("");
    setGenerating(true);
    setError(null);
    setRetryAttempt(null);

    try {
      const res = await sendMessage(text, activeId, controller.signal, replaceFromTurn);
      if (controller.signal.aborted) return;

      // A conversation created early (for Share) still has the placeholder title until its first reply.
      const retitle = !activeId || replaceFromTurn === 0 || title === DEFAULT_TITLE;
      setActiveId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
          turnId: res.turn_id,
          feedback: null,
          modelVersion: res.model_version,
          servingCondition: res.serving_condition,
          evidence: res.evidence,
        },
      ]);
      if (retitle) {
        getSession(res.session_id)
          .then((d) => setTitle(d.title))
          .catch(() => undefined);
      }
      refreshSessions();
    } catch (e) {
      if (isAbortError(e)) {
        if (restoreDraftOnAbort.current) {
          setMessages(previous);
          if (!replacing) setDraft(text);
        }
        return;
      }
      if (controller.signal.aborted) return;
      setMessages(previous);
      if (!replacing) setDraft(text);
      setError(errorText(e, "Something went wrong."));
      setRetryAttempt({ text, replace: replaceFromTurn });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setGenerating(false);
      }
    }
  }

  function handleRetry() {
    if (!retryAttempt) return;
    if (retryAttempt.replace === undefined) void handleSend();
    else void handleSend(retryAttempt.text, retryAttempt.replace);
  }

  function handleDismissError() {
    setError(null);
    setRetryAttempt(null);
  }

  function handleRegenerate(turnIndex: number) {
    const question = messages[turnIndex * 2]?.content;
    if (question) void handleSend(question, turnIndex);
  }

  /** Editing an earlier question discards everything after it, so that case asks first. */
  function handleEdit(turnIndex: number, text: string) {
    const turnCount = Math.floor(messages.length / 2);
    if (turnIndex < turnCount - 1) setPendingEdit({ turn: turnIndex, text });
    else void handleSend(text, turnIndex);
  }

  async function handleFeedback(turnIndex: number, rating: Rating | null) {
    const message = messages[turnIndex * 2 + 1];
    const turnId = message?.turnId;
    if (!turnId || !activeId || feedbackBusy.has(turnId)) return;

    const previous = message.feedback ?? null;
    const apply = (value: Rating | null) =>
      setMessages((prev) => prev.map((m) => (m.turnId === turnId ? { ...m, feedback: value } : m)));

    apply(rating);
    setFeedbackBusy((s) => new Set(s).add(turnId));
    try {
      await setFeedback(activeId, turnId, rating);
      toast(rating ? "Thanks, feedback submitted" : "Feedback removed", { kind: "success" });
    } catch (e) {
      apply(previous);
      toast(errorText(e, "Couldn't submit feedback."), {
        kind: "error",
        action: { label: "Retry", onClick: () => void handleFeedback(turnIndex, rating) },
      });
    } finally {
      setFeedbackBusy((s) => {
        const next = new Set(s);
        next.delete(turnId);
        return next;
      });
    }
  }

  /**
   * The open conversation, creating an empty one first when this is a new chat, so Share and
   * Rename work before the first message. Returns undefined (after a toast) if it cannot be created.
   */
  async function ensureSession(): Promise<SessionSummary | undefined> {
    if (activeSession) return activeSession;
    try {
      const created = await createSession();
      setActiveId(created.id);
      return created;
    } catch (e) {
      toast(errorText(e, "Couldn't start the conversation."), { kind: "error" });
      return undefined;
    }
  }

  async function handleShareOpen() {
    const session = await ensureSession();
    if (session) setSharing(session);
  }

  async function handleHeaderRename(next: string) {
    const session = await ensureSession();
    if (!session) return;
    await handleRenameSession(session.id, next);
    setTitle(next);
  }

  /** Marks a conversation busy while `task` runs; ignores a second action on the same one. */
  async function withBusy(id: string, task: () => Promise<void>) {
    if (busyIds.has(id)) return;
    setBusyIds((s) => new Set(s).add(id));
    try {
      await task();
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRenameSession(id: string, next: string) {
    await withBusy(id, async () => {
      try {
        await updateSession(id, { title: next });
        if (id === activeId) setTitle(next);
        refreshSessions();
        toast("Conversation renamed", { kind: "success" });
      } catch (e) {
        toast(errorText(e, "Couldn't rename the conversation."), {
          kind: "error",
          action: { label: "Retry", onClick: () => void handleRenameSession(id, next) },
        });
      }
    });
  }

  async function handleTogglePin(session: SessionSummary) {
    const pinned = !session.pinned;
    await withBusy(session.id, async () => {
      setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, pinned } : s)));
      try {
        await updateSession(session.id, { pinned });
      } catch (e) {
        toast(errorText(e, pinned ? "Couldn't pin the conversation." : "Couldn't unpin the conversation."), {
          kind: "error",
        });
      }
      refreshSessions();
    });
  }

  async function handleRestore(id: string) {
    try {
      await setArchived(id, false);
      refreshSessions();
      toast("Conversation restored", { kind: "success" });
    } catch (e) {
      toast(errorText(e, "Couldn't restore the conversation."), {
        kind: "error",
        action: { label: "Retry", onClick: () => void handleRestore(id) },
      });
    }
  }

  async function handleArchiveSession(session: SessionSummary) {
    await withBusy(session.id, async () => {
      try {
        await setArchived(session.id, true);
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== session.id);
          writeStorage(SESSIONS_CACHE_KEY, next.slice(0, SESSIONS_PAGE_SIZE));
          return next;
        });
        if (session.id === activeId) handleNewChat();
        refreshSessions();
        toast("Conversation archived", {
          kind: "success",
          action: { label: "Undo", onClick: () => void handleRestore(session.id) },
        });
      } catch (e) {
        toast(errorText(e, "Couldn't archive the conversation."), {
          kind: "error",
          action: { label: "Retry", onClick: () => void handleArchiveSession(session) },
        });
      }
    });
  }

  async function handleExportSession(session: SessionSummary, format: ExportFormat) {
    await withBusy(session.id, async () => {
      try {
        const detail = await getSession(session.id);
        if (format === "pdf") {
          if (detail.turns.length === 0) throw new EmptyConversationError();
          printConversation(detail.title, detail.turns);
          toast("Choose 'Save as PDF' in the print dialog to finish.", { kind: "info" });
          return;
        }
        const { blob, filename } = buildExport(detail, format);
        downloadBlob(blob, filename);
        toast(`Exported ${filename}`, { kind: "success" });
      } catch (e) {
        if (e instanceof EmptyConversationError) {
          toast(e.message, { kind: "info" });
          return;
        }
        toast(errorText(e, "Couldn't export the conversation."), {
          kind: "error",
          action: { label: "Retry", onClick: () => void handleExportSession(session, format) },
        });
      }
    });
  }

  async function handleDeleteSession(id: string) {
    await withBusy(id, async () => {
      try {
        await deleteSession(id);
        setSessions((prev) => {
          const next = prev.filter((s) => s.id !== id);
          writeStorage(SESSIONS_CACHE_KEY, next.slice(0, SESSIONS_PAGE_SIZE));
          return next;
        });
        if (id === activeId) handleNewChat();
        refreshSessions();
        toast("Conversation deleted", { kind: "success" });
      } catch (e) {
        toast(errorText(e, "Couldn't delete the conversation."), {
          kind: "error",
          action: { label: "Retry", onClick: () => void handleDeleteSession(id) },
        });
      }
    });
  }

  // Keyboard shortcuts. Combos with the primary modifier work anywhere except behind a dialog;
  // the bare "?" key only when the user is not typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.defaultPrevented) return;
      const modalOpen = Boolean(document.querySelector('[aria-modal="true"]'));
      const key = e.key.toLowerCase();

      if (hasMod(e) && e.shiftKey && key === "o") {
        e.preventDefault();
        if (!modalOpen) handleNewChat();
      } else if (hasMod(e) && !e.shiftKey && !e.altKey && key === "k") {
        e.preventDefault();
        if (modalOpen) return;
        setView("chat");
        if (isMobile) setDrawerOpen(true);
        const wasCollapsed = !isMobile && sidebarCollapsed;
        if (wasCollapsed) setSidebarCollapsed(false);
        // The sidebar's labels are hidden while it animates open; focus once they are visible.
        setTimeout(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        }, wasCollapsed || isMobile ? 260 : 0);
      } else if (e.key === "?" && !e.ctrlKey && !e.metaKey && !isTyping(e.target) && !modalOpen) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewChat, isMobile, sidebarCollapsed]);

  // The open conversation as the header sees it; falls back when it is not in the loaded list.
  const activeSession: SessionSummary | undefined = activeId
    ? sessions.find((s) => s.id === activeId) ?? {
        id: activeId,
        title,
        created_at: "",
        updated_at: "",
      }
    : undefined;

  const sidebar = (
    <Sidebar
      sessions={sessions}
      status={sessionsStatus}
      onRetry={refreshSessions}
      activeId={activeId}
      query={query}
      onQueryChange={setQuery}
      searching={searching}
      searchRef={searchRef}
      onSelect={handleSelect}
      onNewChat={handleNewChat}
      onRenameSession={handleRenameSession}
      onDeleteSession={handleDeleteSession}
      onTogglePin={handleTogglePin}
      onShareSession={setSharing}
      onExportSession={handleExportSession}
      onArchiveSession={handleArchiveSession}
      busyIds={busyIds}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={handleLoadMore}
      collapsed={!isMobile && sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      onClose={isMobile ? () => setDrawerOpen(false) : undefined}
      userName={profile.name}
      userPhoto={profile.photo}
      settingsActive={view === "settings"}
      onOpenSettings={() => {
        setView("settings");
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-page text-ink">
      {!isMobile && sidebar}

      {isMobile && drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          {sidebar}
          <button
            className="flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close sidebar"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {view === "settings" ? (
          <>
            <Navbar
              title={SETTINGS_TITLE}
              canRename={false}
              onRename={() => undefined}
              badge={null}
              theme={theme}
              onToggleTheme={toggleTheme}
              showMenuButton={isMobile}
              onOpenMenu={() => setDrawerOpen(true)}
              onBack={() => setView("chat")}
            />
            <SettingsPage
              profile={profile}
              onSave={saveProfile}
              theme={theme}
              onToggleTheme={toggleTheme}
              onBack={() => setView("chat")}
              health={health}
              onSessionsChanged={refreshSessions}
              onOpenSession={handleSelect}
            />
          </>
        ) : (
          <>
            <Navbar
              title={title}
              canRename
              onRename={handleHeaderRename}
              badge={badge}
              theme={theme}
              onToggleTheme={toggleTheme}
              showMenuButton={isMobile}
              onOpenMenu={() => setDrawerOpen(true)}
              actions={{
                empty: messages.length === 0,
                pinned: Boolean(activeSession?.pinned),
                onShare: () => void handleShareOpen(),
                onTogglePin: () => activeSession && void handleTogglePin(activeSession),
                onExport: (format) => activeSession && void handleExportSession(activeSession, format),
                onArchive: () => activeSession && void handleArchiveSession(activeSession),
                onDelete: () => activeSession && setPendingDelete(activeSession),
              }}
            />
            <ChatPanel
              messages={messages}
              generating={generating}
              error={error}
              draft={draft}
              onDraftChange={setDraft}
              onSend={() => handleSend()}
              onStop={() => abortInFlight(true)}
              onPrompt={(q) => handleSend(q)}
              onEdit={handleEdit}
              onRegenerate={handleRegenerate}
              onFeedback={handleFeedback}
              feedbackBusy={feedbackBusy}
              onRetry={retryAttempt ? handleRetry : undefined}
              onDismissError={handleDismissError}
            />
          </>
        )}
      </div>

      {sharing && (
        <ShareDialog session={sharing} onClose={() => setSharing(null)} onChanged={refreshSessions} />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this conversation?"
          message={`"${pendingDelete.title}" and all of its messages will be permanently deleted, and any share link stops working. This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const { id } = pendingDelete;
            setPendingDelete(null);
            void handleDeleteSession(id);
          }}
        />
      )}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {pendingEdit && (
        <ConfirmDialog
          title="Replace this message?"
          message={`Resending replaces this message and the ${
            messages.length - pendingEdit.turn * 2 - 1
          } messages after it. Those answers are discarded and can't be recovered.`}
          confirmLabel="Resend"
          onCancel={() => setPendingEdit(null)}
          onConfirm={() => {
            const { turn, text } = pendingEdit;
            setPendingEdit(null);
            void handleSend(text, turn);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
