import { useState } from "react";
import type { BoundingBox } from "@/types";
import { createBoxId } from "./useBoundingBoxes";

const API_BASE = "http://localhost:8000";

export function useDetection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [fullText, setFullText] = useState<string>("");

  async function detect(imageBase64: string): Promise<BoundingBox[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? `Detection failed: ${res.status}`);
      }
      const data = await res.json();
      setImageId(data.image_id);
      setFullText(data.full_text ?? "");
      return data.boxes.map((b: Omit<BoundingBox, "id">) => ({
        ...b,
        id: createBoxId(),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Detection failed";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }

  return { detect, loading, error, imageId, fullText };
}
