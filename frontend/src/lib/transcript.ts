interface TurnText {
  user_message: string;
  model_response: string;
}

/** Plain-text copy of a conversation, for sharing or copying. */
export function formatTranscript(title: string, turns: TurnText[]): string {
  const body = turns
    .map((t) => `You: ${t.user_message}\n\nRAGA: ${t.model_response}`)
    .join("\n\n---\n\n");
  return `${title}\n\n${body}`;
}
