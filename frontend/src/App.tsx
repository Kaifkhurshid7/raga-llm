import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import Navbar from "./components/Navbar";
import SettingsPage from "./components/SettingsPage";
import Sidebar, { type SessionsStatus, type SidebarNotice } from "./components/Sidebar";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useProfile } from "./hooks/useProfile";
import { useTheme } from "./hooks/useTheme";
import {
  ApiError,
  deleteSession,
  getHealth,
  type Health,
  getSession,
  isAbortError,
  listSessions,
  sendMessage,
  updateSession,
  type SessionSummary,
} from "./lib/api";
import { readStorage, writeStorage } from "./lib/storage";
import { formatTranscript } from "./lib/transcript";
import type { Message } from "./lib/types";

const SESSIONS_CACHE_KEY = "raga.sessions";
const SIDEBAR_COLLAPSED_KEY = "raga.sidebarCollapsed";
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_TITLE = "RAGA";
const SETTINGS_TITLE = "Settings";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [profile, saveProfile] = useProfile();
  const [view, setView] = useState<"chat" | "settings">("chat");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    readStorage<SessionSummary[]>(SESSIONS_CACHE_KEY, [])
  );
  const [sessionsStatus, setSessionsStatus] = useState<SessionsStatus>("loading");
  const [sidebarNotice, setSidebarNotice] = useState<SidebarNotice | null>(null);
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

  const abortRef = useRef<AbortController | null>(null);
  const restoreDraftOnAbort = useRef(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshSessions = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load (and search) the session list from the backend.
  useEffect(() => {
    let cancelled = false;
    setSessionsStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const timer = setTimeout(async () => {
      try {
        const list = await listSessions(query);
        if (cancelled) return;
        setSessions(list);
        setSessionsStatus("ready");
        if (!query.trim()) writeStorage(SESSIONS_CACHE_KEY, list);
      } catch {
        if (!cancelled) setSessionsStatus("error");
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, refreshKey]);

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

  function handleNewChat() {
    setView("chat");
    resetConversation();
    setActiveId(undefined);
    setTitle(DEFAULT_TITLE);
    setMessages([]);
    setDrawerOpen(false);
  }

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
      setMessages(
        detail.turns.flatMap<Message>((t) => [
          { role: "user", content: t.user_message },
          {
            role: "assistant",
            content: t.model_response,
            modelVersion: t.model_version,
            servingCondition: t.serving_condition,
            evidence: t.evidence,
          },
        ])
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load that conversation.");
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

      const retitle = !activeId || replaceFromTurn === 0;
      setActiveId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
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
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
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

  async function handleRenameSession(id: string, next: string) {
    try {
      await updateSession(id, { title: next });
      if (id === activeId) setTitle(next);
      refreshSessions();
    } catch (e) {
      notifyError(e, "Couldn't rename the conversation.");
    }
  }

  function notifyError(e: unknown, fallback: string) {
    setSidebarNotice({ text: e instanceof ApiError ? e.message : fallback, kind: "error" });
  }

  async function handleTogglePin(session: SessionSummary) {
    const pinned = !session.pinned;
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, pinned } : s)));
    try {
      await updateSession(session.id, { pinned });
    } catch (e) {
      notifyError(e, pinned ? "Couldn't pin the conversation." : "Couldn't unpin the conversation.");
    }
    refreshSessions();
  }

  /** Shares the conversation as text: the system share sheet if there is one, otherwise the clipboard. */
  async function handleShareSession(session: SessionSummary) {
    try {
      const detail = await getSession(session.id);
      if (detail.turns.length === 0) {
        setSidebarNotice({ text: "There is nothing in this conversation to share yet.", kind: "info" });
        return;
      }
      const text = formatTranscript(detail.title, detail.turns);
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: detail.title, text });
          return;
        } catch (e) {
          if (isAbortError(e) || (e as { name?: string })?.name === "AbortError") return;
          /* the share sheet failed; fall back to copying */
        }
      }
      await navigator.clipboard.writeText(text);
      setSidebarNotice({ text: "Conversation copied to the clipboard.", kind: "info" });
    } catch (e) {
      notifyError(e, "Couldn't share the conversation.");
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteSession(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        writeStorage(SESSIONS_CACHE_KEY, next);
        return next;
      });
      if (id === activeId) handleNewChat();
      refreshSessions();
    } catch (e) {
      notifyError(e, "Couldn't delete the conversation.");
    }
  }

  const sidebar = (
    <Sidebar
      sessions={sessions}
      status={sessionsStatus}
      onRetry={refreshSessions}
      activeId={activeId}
      query={query}
      onQueryChange={setQuery}
      onSelect={handleSelect}
      onNewChat={handleNewChat}
      onRenameSession={handleRenameSession}
      onDeleteSession={handleDeleteSession}
      onTogglePin={handleTogglePin}
      onShareSession={handleShareSession}
      notice={sidebarNotice}
      onDismissNotice={() => setSidebarNotice(null)}
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
            />
          </>
        ) : (
          <>
            <Navbar
              title={title}
              canRename={Boolean(activeId)}
              onRename={(next) => activeId && handleRenameSession(activeId, next)}
              badge={badge}
              theme={theme}
              onToggleTheme={toggleTheme}
              showMenuButton={isMobile}
              onOpenMenu={() => setDrawerOpen(true)}
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
              onEdit={(turnIndex, text) => handleSend(text, turnIndex)}
              onRegenerate={handleRegenerate}
              onRetry={retryAttempt ? handleRetry : undefined}
              onDismissError={handleDismissError}
            />
          </>
        )}
      </div>
    </div>
  );
}
