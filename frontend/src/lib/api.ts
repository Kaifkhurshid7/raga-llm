import type { Evidence } from "./types";

export interface ChatResponse {
  session_id: string;
  /** Id of the new turn, used to rate the answer. Absent on an older backend. */
  turn_id?: string;
  response: string;
  serving_condition: string;
  model_version: string;
  decoding_config: Record<string, unknown>;
  prompt_tokens?: number;
  output_tokens?: number;
  /** Not returned by the backend yet. */
  evidence?: Evidence;
}

export interface SessionSummary {
  id: string;
  title: string;
  /** Absent on responses from an older backend. */
  pinned?: boolean;
  archived?: boolean;
  /** True while a public share link is active. */
  shared?: boolean;
  /** Excerpt of the message text that matched a search; absent when the title matched. */
  snippet?: string | null;
  created_at: string;
  updated_at: string;
}

export type Rating = "up" | "down";

export interface Turn {
  /** Absent on responses from an older backend. */
  id?: string;
  created_at?: string;
  feedback?: Rating | null;
  user_message: string;
  model_response: string;
  model_version: string;
  serving_condition: string;
  /** Not returned by the backend yet. */
  evidence?: Evidence;
}

export interface SessionDetail extends SessionSummary {
  turns: Turn[];
}

export interface Health {
  status: string;
  mock_inference: boolean;
  serving_condition: string;
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** Requests that do not carry their own cancel signal give up after this long. */
const DEFAULT_TIMEOUT_MS = 20_000;

const UNEXPECTED_RESPONSE = "The server sent an unexpected response.";

/** Turns a FastAPI error body (`detail` as text or a validation list) into one sentence. */
function describeError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d?.msg === "string" ? d.msg : null))
      .filter((m): m is string => Boolean(m));
    if (messages.length) return messages.join(" ");
  }
  if (status === 404) return "That item no longer exists.";
  if (status >= 500) return `The server ran into a problem (error ${status}). Try again.`;
  return `The request failed (error ${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let options = init;
  if (!init?.signal) {
    const controller = new AbortController();
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DEFAULT_TIMEOUT_MS);
    options = { ...init, signal: controller.signal };
  }

  try {
    let res: Response;
    try {
      res = await fetch(path, options);
    } catch (e) {
      if (isAbortError(e)) {
        if (timedOut) throw new ApiError("The request timed out. Try again.");
        throw e;
      }
      throw new ApiError("Can't reach the server. Check that the backend is running.");
    }

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(describeError(res.status, body), res.status);
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError(UNEXPECTED_RESPONSE, res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

const jsonInit = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

function ensure(condition: boolean): void {
  if (!condition) throw new ApiError(UNEXPECTED_RESPONSE);
}

/**
 * Sends a message. With `replaceFromTurn`, that turn and everything after it is replaced by
 * the new answer (regenerate and edit); the server leaves the conversation unchanged on failure.
 */
export async function sendMessage(
  message: string,
  sessionId?: string,
  signal?: AbortSignal,
  replaceFromTurn?: number
): Promise<ChatResponse> {
  const body: Record<string, unknown> = { message, session_id: sessionId ?? null };
  if (replaceFromTurn !== undefined) body.replace_from_turn = replaceFromTurn;
  const res = await request<ChatResponse>("/api/chat", jsonInit("POST", body, signal));
  ensure(typeof res?.session_id === "string" && typeof res?.response === "string");
  return res;
}

export function getHealth(): Promise<Health> {
  return request("/health");
}

export interface ListOptions {
  query?: string;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

/** Page size for the sidebar; the backend caps it at 100. */
export const SESSIONS_PAGE_SIZE = 30;

export async function listSessions(
  options: string | ListOptions = {},
  signal?: AbortSignal
): Promise<SessionSummary[]> {
  const { query, archived, limit, offset }: ListOptions =
    typeof options === "string" ? { query: options } : options;
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  if (archived) params.set("archived", "true");
  if (limit !== undefined) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  const list = await request<SessionSummary[]>(
    `/api/sessions${qs ? `?${qs}` : ""}`,
    signal ? { signal } : undefined
  );
  ensure(Array.isArray(list));
  return list;
}

/** An empty conversation, so a new chat can be shared or renamed before its first message. */
export async function createSession(): Promise<SessionSummary> {
  const created = await request<SessionSummary>("/api/sessions", { method: "POST" });
  ensure(typeof created?.id === "string");
  return created;
}

export async function getSession(id: string): Promise<SessionDetail> {
  const detail = await request<SessionDetail>(`/api/sessions/${id}`);
  ensure(typeof detail?.id === "string" && Array.isArray(detail?.turns));
  return detail;
}

export function updateSession(
  id: string,
  changes: { title?: string; pinned?: boolean; archived?: boolean }
): Promise<SessionSummary> {
  return request(`/api/sessions/${id}`, jsonInit("PATCH", changes));
}

export function renameSession(id: string, title: string): Promise<SessionSummary> {
  return updateSession(id, { title });
}

export function deleteSession(id: string): Promise<void> {
  return request(`/api/sessions/${id}`, { method: "DELETE" });
}

export function setArchived(id: string, archived: boolean): Promise<SessionSummary> {
  return updateSession(id, { archived });
}

export function setFeedback(sessionId: string, turnId: string, rating: Rating | null) {
  return request<{ turn_id: string; rating: Rating | null }>(
    `/api/sessions/${sessionId}/turns/${turnId}/feedback`,
    jsonInit("PUT", { rating })
  );
}

export interface ShareState {
  enabled: boolean;
  token: string | null;
  shared_at: string | null;
}

export function getShare(id: string): Promise<ShareState> {
  return request(`/api/sessions/${id}/share`);
}

export function enableShare(id: string, rotate = false): Promise<ShareState> {
  return request(`/api/sessions/${id}/share`, jsonInit("POST", { rotate }));
}

export function revokeShare(id: string): Promise<void> {
  return request(`/api/sessions/${id}/share`, { method: "DELETE" });
}

export interface SharedConversation {
  title: string;
  shared_at: string | null;
  turns: { user_message: string; model_response: string; created_at: string }[];
}

export async function getShared(token: string): Promise<SharedConversation> {
  const shared = await request<SharedConversation>(`/api/shared/${encodeURIComponent(token)}`);
  ensure(typeof shared?.title === "string" && Array.isArray(shared?.turns));
  return shared;
}

/** The URL a reader opens for a share token. */
export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
