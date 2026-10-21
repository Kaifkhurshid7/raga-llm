import { useEffect, useState } from "react";
import { ApiError, getShared, type SharedConversation } from "../lib/api";
import { useTheme } from "../hooks/useTheme";
import { SpinnerIcon } from "./icons";
import Markdown from "./Markdown";

interface Props {
  token: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; conversation: SharedConversation }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

/** Read-only page for a public share link. It never touches the owner's conversation list. */
export default function SharedView({ token }: Props) {
  useTheme();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Keep shared pages out of search indexes and don't leak the link through the Referer header.
  useEffect(() => {
    const tags = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => tags.forEach((t) => t.remove());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    getShared(token)
      .then((conversation) => {
        if (cancelled) return;
        document.title = `${conversation.title} · RAGA`;
        setState({ kind: "ready", conversation });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setState({ kind: "unavailable" });
        else setState({ kind: "error", message: e instanceof ApiError ? e.message : "Something went wrong." });
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold tracking-[0.12em]">RAGA</p>
          <p className="text-xs text-muted">Shared conversation · read-only</p>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-8">
        {state.kind === "loading" && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <SpinnerIcon /> Loading…
          </p>
        )}

        {state.kind === "unavailable" && (
          <div role="alert">
            <h1 className="text-lg font-semibold">This link isn't available</h1>
            <p className="mt-2 text-sm text-muted">
              The conversation was never shared, or its owner turned sharing off or deleted it.
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <div role="alert">
            <p className="text-sm text-muted">{state.message}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-2 text-sm font-medium text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <h1 className="text-xl font-semibold">{state.conversation.title}</h1>
            {state.conversation.shared_at && (
              <p className="mt-1 text-xs text-faint">
                Shared {new Date(state.conversation.shared_at).toLocaleDateString()}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-6">
              {state.conversation.turns.map((t, i) => (
                <section key={i} className="flex flex-col gap-6">
                  <p className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5 text-[15px] leading-6">
                    {t.user_message}
                  </p>
                  <div className="text-[15px]">
                    <Markdown>{t.model_response}</Markdown>
                  </div>
                </section>
              ))}
            </div>
            <p className="mt-10 border-t border-line pt-4 text-xs text-faint">
              Answers come from a research language model and can be wrong. Check important claims
              against a reliable source.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
