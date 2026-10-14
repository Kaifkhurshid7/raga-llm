import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useTheme } from "./hooks/useTheme";
import {
  ApiError,
  getSession,
  isAbortError,
  listSessions,
  renameSession,
  sendMessage,
  type SessionSummary,
} from "./lib/api";
import { readStorage, writeStorage } from "./lib/storage";
import type { Message } from "./lib/types";

const SESSIONS_CACHE_KEY = "raga.sessions";
const SIDEBAR_COLLAPSED_KEY = "raga.sidebarCollapsed";
const SEARCH_DEBOUNCE_MS = 250;
const NEW_CHAT_TITLE = "New chat";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    readStorage<SessionSummary[]>(SESSIONS_CACHE_KEY, [])
  );
  const [query, setQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStorage(SIDEBAR_COLLAPSED_KEY, false)
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [activeId, setActiveId] = useState<string | undefined>();
  const [title, setTitle] = useState(NEW_CHAT_TITLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const restoreDraftOnAbort = useRef(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshSessions = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load (and search) the session list from the backend.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const list = await listSessions(query);
        if (cancelled) return;
        setSessions(list);
        if (!query.trim()) writeStorage(SESSIONS_CACHE_KEY, list);
      } catch {
        /* keep the cached list when the backend is unreachable */
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, refreshKey]);

  useEffect(() => writeStorage(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed), [sidebarCollapsed]);

  const badge = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last?.modelVersion) return null;
    return [last.modelVersion, last.servingCondition].filter(Boolean).join(" · ");
  }, [messages]);

  function abortInFlight(restoreDraft: boolean) {
    restoreDraftOnAbort.current = restoreDraft;
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  }

  function resetConversation() {
    abortInFlight(false);
    setError(null);
    setDraft("");
  }

  function handleNewChat() {
    resetConversation();
    setActiveId(undefined);
    setTitle(NEW_CHAT_TITLE);
    setMessages([]);
    setDrawerOpen(false);
  }

  async function handleSelect(id: string) {
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
          },
        ])
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load that conversation.");
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || generating) return;

    const controller = new AbortController();
    abortRef.current = controller;
    restoreDraftOnAbort.current = false;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setGenerating(true);
    setError(null);

    try {
      const res = await sendMessage(text, activeId, controller.signal);
      if (controller.signal.aborted) return;

      const isNewSession = !activeId;
      setActiveId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
          modelVersion: res.model_version,
          servingCondition: res.serving_condition,
        },
      ]);
      if (isNewSession) {
        getSession(res.session_id)
          .then((d) => setTitle(d.title))
          .catch(() => undefined);
      }
      refreshSessions();
    } catch (e) {
      if (isAbortError(e)) {
        if (restoreDraftOnAbort.current) {
          setMessages((prev) => prev.slice(0, -1));
          setDraft(text);
        }
        return;
      }
      if (controller.signal.aborted) return;
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setGenerating(false);
      }
    }
  }

  async function handleRename(next: string) {
    if (!activeId) return;
    const previous = title;
    setTitle(next);
    try {
      await renameSession(activeId, next);
      refreshSessions();
    } catch {
      setTitle(previous);
    }
  }

  const sidebar = (
    <Sidebar
      sessions={sessions}
      activeId={activeId}
      query={query}
      onQueryChange={setQuery}
      onSelect={handleSelect}
      onNewChat={handleNewChat}
      collapsed={!isMobile && sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      onClose={isMobile ? () => setDrawerOpen(false) : undefined}
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
        <Navbar
          title={title}
          canRename={Boolean(activeId)}
          onRename={handleRename}
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
          onSend={handleSend}
          onStop={() => abortInFlight(true)}
        />
      </div>
    </div>
  );
}
