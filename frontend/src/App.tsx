import { useState } from "react";
import ChatMessage from "./components/ChatMessage";
import { sendMessage } from "./lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  modelVersion?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await sendMessage(userMessage, sessionId);
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response, modelVersion: res.model_version },
      ]);
    } catch (e) {
      setError("Couldn't reach the backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <div className="w-full max-w-2xl flex flex-col h-screen p-4">
        <header className="py-4 border-b">
          <h1 className="text-xl font-semibold text-gray-900">RAGA</h1>
          <p className="text-xs text-gray-500">Raga-Aware Generative Assistant</p>
        </header>

        <main className="flex-1 overflow-y-auto py-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-10">
              Ask about a raga's vadi, samvadi, thaat, or aroha/avaroha.
            </p>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={i} {...m} />
          ))}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </main>

        <footer className="py-4 border-t flex gap-2">
          <input
            className="flex-1 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={input}
            placeholder="Ask about a raga..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            className="rounded-full bg-indigo-600 text-white px-5 py-2 text-sm disabled:opacity-50"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? "..." : "Send"}
          </button>
        </footer>
      </div>
    </div>
  );
}
