export interface ChatResponse {
  session_id: string;
  response: string;
  serving_condition: string;
  model_version: string;
  decoding_config: Record<string, unknown>;
  prompt_tokens?: number;
  output_tokens?: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Turn {
  user_message: string;
  model_response: string;
  model_version: string;
  serving_condition: string;
}

export interface SessionDetail extends SessionSummary {
  turns: Turn[];
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new ApiError("Couldn't reach the backend. Is it running?");
  }

  if (!res.ok) {
    let detail = `Backend returned ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const jsonInit = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export function sendMessage(
  message: string,
  sessionId?: string,
  signal?: AbortSignal
): Promise<ChatResponse> {
  return request("/api/chat", jsonInit("POST", { message, session_id: sessionId ?? null }, signal));
}

export function listSessions(query?: string): Promise<SessionSummary[]> {
  const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request(`/api/sessions${qs}`);
}

export function getSession(id: string): Promise<SessionDetail> {
  return request(`/api/sessions/${id}`);
}

export function renameSession(id: string, title: string): Promise<SessionSummary> {
  return request(`/api/sessions/${id}`, jsonInit("PATCH", { title }));
}
