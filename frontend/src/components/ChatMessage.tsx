interface Props {
  role: "user" | "assistant";
  content: string;
  modelVersion?: string;
}

export default function ChatMessage({ role, content, modelVersion }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {!isUser && modelVersion && (
          <p className="mt-1 text-[10px] text-gray-400">served by {modelVersion}</p>
        )}
      </div>
    </div>
  );
}
