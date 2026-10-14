export interface ChatResponse {
  session_id: string;
  response: string;
  serving_condition: string;
  model_version: string;
  decoding_config: Record<string, unknown>;
  prompt_tokens?: number;
  output_tokens?: number;
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  });
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`);
  }
  return res.json();
}
