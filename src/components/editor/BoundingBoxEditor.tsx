import { useState, useRef, useEffect, useCallback } from "react";
import type { BoundingBox as BoxType } from "@/types";
import BoundingBox from "./BoundingBox";
import BoxToolbar from "./BoxToolbar";

const API_BASE = "http://localhost:8000";

interface Props {
  imageUrl: string;
  imageId: string | null;
  boxes: BoxType[];
  selectedId: string | null;
  onSelectBox: (id: string | null) => void;
  onUpdateBox: (id: string, updates: Partial<Omit<BoxType, "id">>) => void;
  onRemoveBox: (id: string) => void;
  onAddBox: (box: Omit<BoxType, "id">) => string;
  selected: BoxType | null;
  imageSize: { width: number; height: number };
}

export default function BoundingBoxEditor({
  imageUrl,
  imageId,
  boxes,
  selectedId,
  onSelectBox,
  onUpdateBox,
  onRemoveBox,
  onAddBox,
  selected,
  imageSize,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [addingMode, setAddingMode] = useState(false);

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      setScale(Math.min(1, containerWidth / imageSize.width));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [imageSize.width]);

  const reOcr = useCallback(
    async (id: string, x: number, y: number, width: number, height: number) => {
      if (!imageId) return;
      try {
        const res = await fetch(`${API_BASE}/api/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: imageId, x, y, width, height }),
        });
        if (res.ok) {
          const data = await res.json();
          // Only update text from OCR — preserve user-set labels
          onUpdateBox(id, { text: data.text });
        }
      } catch {
        // Silently fail — keep existing text/label
      }
    },
    [imageId, onUpdateBox]
  );

  const handleBoxUpdate = useCallback(
    (id: string, updates: Partial<Omit<BoxType, "id">>) => {
      onUpdateBox(id, updates);
      // Only re-OCR when the box was moved or resized, not on label/text changes
      const posChanged = updates.x != null || updates.y != null || updates.width != null || updates.height != null;
      if (posChanged) {
        const box = boxes.find((b) => b.id === id);
        if (box) {
          const newX = updates.x ?? box.x;
          const newY = updates.y ?? box.y;
          const newW = updates.width ?? box.width;
          const newH = updates.height ?? box.height;
          reOcr(id, newX, newY, newW, newH);
        }
      }
    },
    [boxes, onUpdateBox, reOcr]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only act on direct clicks on the canvas, not bubbled from boxes
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest("img")) return;
      if (addingMode) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        onAddBox({
          x,
          y,
          width: 100,
          height: 40,
          label: "Text",
          confidence: 1,
          text: "",
        });
        setAddingMode(false);
      } else {
        onSelectBox(null);
      }
    },
    [addingMode, scale, onAddBox, onSelectBox]
  );

  return (
    <div className="flex flex-col gap-3">
      <BoxToolbar
        selected={selected}
        onUpdateLabel={(id, label) => onUpdateBox(id, { label })}
        onDelete={onRemoveBox}
        onAddMode={() => setAddingMode(!addingMode)}
        addingMode={addingMode}
      />
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
        style={{
          width: "100%",
          height: imageSize.height * scale,
          cursor: addingMode ? "crosshair" : "default",
        }}
        onClick={handleCanvasClick}
      >
        <img
          src={imageUrl}
          alt="Uploaded screenshot"
          className="pointer-events-none select-none"
          style={{
            width: imageSize.width * scale,
            height: imageSize.height * scale,
          }}
          draggable={false}
        />
        {boxes.map((box) => (
          <BoundingBox
            key={box.id}
            box={box}
            isSelected={box.id === selectedId}
            scale={scale}
            onSelect={() => onSelectBox(box.id)}
            onUpdate={(updates) => handleBoxUpdate(box.id, updates)}
            onDelete={onRemoveBox}
          />
        ))}
      </div>
    </div>
  );
}
