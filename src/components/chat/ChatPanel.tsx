import { useState } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (message: string) => void;
}

export default function ChatPanel({ messages, loading, onSend }: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-700 bg-zinc-800/50">
      <div className="border-b border-zinc-700 px-4 py-2">
        <h3 className="text-sm font-medium text-zinc-300">Feedback</h3>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-violet-600/20 text-violet-200"
                : "mr-8 bg-zinc-700 text-zinc-300"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="mr-8 animate-pulse rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-500">
            Generating...
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-zinc-700 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe changes..."
            disabled={loading}
            className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
