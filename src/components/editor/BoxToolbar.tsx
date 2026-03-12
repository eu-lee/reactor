import { UI_LABELS } from "@/types";
import type { BoundingBox } from "@/types";

interface Props {
  selected: BoundingBox | null;
  onUpdateLabel: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onAddMode: () => void;
  addingMode: boolean;
}

export default function BoxToolbar({
  selected,
  onUpdateLabel,
  onDelete,
  onAddMode,
  addingMode,
}: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
      <button
        onClick={onAddMode}
        className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
          addingMode
            ? "bg-violet-600 text-white"
            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
        }`}
      >
        + Add Box
      </button>

      {selected && (
        <>
          <select
            value={selected.label}
            onChange={(e) => onUpdateLabel(selected.id, e.target.value)}
            className="rounded border border-zinc-600 bg-zinc-700 px-2 py-1.5 text-sm text-zinc-200"
          >
            {UI_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onDelete(selected.id)}
            className="rounded bg-red-900/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-900"
          >
            Delete
          </button>
        </>
      )}

      {!selected && !addingMode && (
        <span className="text-xs text-zinc-500">
          Click a box to select, or add a new one
        </span>
      )}
      {addingMode && (
        <span className="text-xs text-violet-400">
          Click on the image to place a new box
        </span>
      )}
    </div>
  );
}
