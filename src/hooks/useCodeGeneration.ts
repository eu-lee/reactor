import { useState, useCallback } from "react";
import type { BoundingBox, ChatMessage, LayoutChange } from "@/types";

const API_BASE = "http://localhost:8000";

export function useCodeGeneration(apiKey: string) {
  const [code, setCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (boxes: BoundingBox[], imageWidth: number, imageHeight: number, fullText?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            boxes,
            image_width: imageWidth,
            image_height: imageHeight,
            full_text: fullText ?? "",
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail ?? `Generation failed: ${res.status}`);
        }
        const data = await res.json();
        setCode(data.code);
        setSessionId(data.session_id);
        setChatMessages([
          { role: "user", content: "Generate component from UI annotations" },
          { role: "assistant", content: data.message },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const iterate = useCallback(
    async (feedback: string, layoutChanges?: LayoutChange[]) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);

      const userMsg =
        layoutChanges && layoutChanges.length > 0
          ? `${feedback}\n\n[Layout changes: ${JSON.stringify(layoutChanges)}]`
          : feedback;

      setChatMessages((prev) => [...prev, { role: "user", content: feedback }]);
      try {
        const res = await fetch(`${API_BASE}/api/iterate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            session_id: sessionId,
            feedback: userMsg,
            layout_changes: layoutChanges ?? [],
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail ?? `Iteration failed: ${res.status}`);
        }
        const data = await res.json();
        setCode(data.code);
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Iteration failed";
        setError(msg);
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${msg}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, sessionId]
  );

  const reset = useCallback(() => {
    setCode(null);
    setSessionId(null);
    setChatMessages([]);
    setError(null);
  }, []);

  return { code, chatMessages, loading, error, generate, iterate, reset };
}
