import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import type { BoundingBox as BoxType } from "@/types";
import { UI_LABELS } from "@/types";

interface Props {
  box: BoxType;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<Omit<BoxType, "id">>) => void;
  onDelete: (id: string) => void;
}

const LABEL_COLORS: Record<string, string> = {
  Text: "#8b5cf6",
  Image: "#3b82f6",
  Icon: "#f59e0b",
  Heading: "#ec4899",
  "Text Button": "#10b981",
  "Text Input": "#6366f1",
  Card: "#14b8a6",
  Paragraph: "#a78bfa",
  Toggle: "#f97316",
  Checkbox: "#06b6d4",
  Link: "#2563eb",
  Dropdown: "#8b5cf6",
  "Radio Button": "#e879f9",
  Slider: "#facc15",
  Navigation: "#64748b",
  Container: "#78716c",
  Element: "#71717a",
};

function getColor(label: string): string {
  return LABEL_COLORS[label] ?? "#8b5cf6";
}

const MENU_HEIGHT = 240;
const MENU_WIDTH = 160;

export default function BoundingBox({
  box,
  isSelected,
  scale,
  onSelect,
  onUpdate,
  onDelete,
}: Props) {
  const color = getColor(box.label);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const positionMenu = useCallback(() => {
    if (!labelRef.current) return;
    const rect = labelRef.current.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;

    // Clamp to viewport
    if (top + MENU_HEIGHT > window.innerHeight) {
      top = rect.top - MENU_HEIGHT - 4;
    }
    if (left + MENU_WIDTH > window.innerWidth) {
      left = window.innerWidth - MENU_WIDTH - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setMenuPos({ top, left });
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: Event) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        labelRef.current && !labelRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!menuOpen) return;
    const reposition = () => positionMenu();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [menuOpen, positionMenu]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen) {
      positionMenu();
    }
    setMenuOpen(!menuOpen);
  };

  return (
    <Rnd
      position={{ x: box.x * scale, y: box.y * scale }}
      size={{ width: box.width * scale, height: box.height * scale }}
      onDragStop={(_e, d) => {
        onUpdate({ x: d.x / scale, y: d.y / scale });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onUpdate({
          x: position.x / scale,
          y: position.y / scale,
          width: parseInt(ref.style.width) / scale,
          height: parseInt(ref.style.height) / scale,
        });
      }}
      onMouseDown={(e: MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
      bounds="parent"
      className="group"
      style={{ zIndex: isSelected ? 20 : 10 }}
    >
      <div
        className="h-full w-full rounded-sm border-2 transition-shadow"
        style={{
          borderColor: color,
          backgroundColor: `${color}${isSelected ? "30" : "15"}`,
          boxShadow: isSelected ? `0 0 0 2px ${color}` : "none",
        }}
      >
        {/* Label tag — click to toggle menu */}
        <span
          ref={labelRef}
          className="absolute -top-6 left-0 z-30 flex cursor-pointer items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white hover:brightness-110"
          style={{ backgroundColor: color }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleMenu}
        >
          {box.label}
          {box.text && (
            <span className="ml-1 opacity-80" title={box.text}>
              "{box.text.slice(0, 40)}
              {box.text.length > 40 ? "…" : ""}"
            </span>
          )}
          <span className="ml-1 opacity-60">▾</span>
        </span>

        {/* Dropdown menu — rendered as portal so it's not clipped by parent overflow */}
        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 w-40 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800 py-1 shadow-xl"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                maxHeight: MENU_HEIGHT,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {UI_LABELS.map((label) => (
                <button
                  key={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ label });
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-zinc-700 ${
                    box.label === label
                      ? "text-white font-medium"
                      : "text-zinc-400"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: getColor(label) }}
                  />
                  {label}
                </button>
              ))}
              <div className="my-1 border-t border-zinc-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(box.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-red-400 hover:bg-zinc-700"
              >
                Delete
              </button>
            </div>,
            document.body
          )}
      </div>
    </Rnd>
  );
}
