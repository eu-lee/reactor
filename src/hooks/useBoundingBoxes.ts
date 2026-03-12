import { useState, useCallback } from "react";
import type { BoundingBox } from "@/types";

let nextId = 0;

export function createBoxId(): string {
  return `box-${Date.now()}-${nextId++}`;
}

export function useBoundingBoxes() {
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const setAll = useCallback((newBoxes: BoundingBox[]) => {
    setBoxes(newBoxes);
    setSelectedId(null);
  }, []);

  const addBox = useCallback((box: Omit<BoundingBox, "id">) => {
    const id = createBoxId();
    setBoxes((prev) => [...prev, { ...box, id }]);
    setSelectedId(id);
    return id;
  }, []);

  const updateBox = useCallback(
    (id: string, updates: Partial<Omit<BoundingBox, "id">>) => {
      setBoxes((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    []
  );

  const removeBox = useCallback(
    (id: string) => {
      setBoxes((prev) => prev.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const selected = boxes.find((b) => b.id === selectedId) ?? null;

  return {
    boxes,
    selectedId,
    selected,
    setSelectedId,
    setAll,
    addBox,
    updateBox,
    removeBox,
  };
}
