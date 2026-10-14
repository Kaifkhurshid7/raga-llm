export interface ChatResponse {
  session_id: string;
  response: string;
  serving_condition: string;
  model_version: string;
  decoding_config: Record<string, unknown>;
  prompt_tokens?: number;
  output_tokens?: number;
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId ?? null }),
    });
  } catch {
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
  return res.json();
}
