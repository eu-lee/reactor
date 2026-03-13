from __future__ import annotations

import json
from typing import Any, Dict, List

from backend.models import Box, LayoutChange
from backend.layout import analyze_layout

SYSTEM_PROMPT = """You are an expert React developer. You generate React components using Tailwind CSS.

Rules:
- Break the UI into logical sub-components (e.g. Navbar, Hero, Card, Footer) defined in the SAME file
- The last line must be: export default App (or whatever the root component is)
- Each sub-component should be its own function component
- Use only Tailwind CSS classes for styling (no inline styles, no CSS imports)
- No import statements — React hooks (useState, useEffect, etc.) are available as globals
- Use semantic HTML elements where appropriate
- Make the layout responsive
- Return ONLY the code inside a single ```jsx code fence, nothing else

Example structure:
```jsx
function Navbar() {
  return <nav className="...">...</nav>
}

function HeroSection() {
  return <section className="...">...</section>
}

function App() {
  return (
    <div className="...">
      <Navbar />
      <HeroSection />
    </div>
  )
}

export default App
```"""


def _box_to_annotation(b: Box) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "label": b.label,
        "x": round(b.x),
        "y": round(b.y),
        "width": round(b.width),
        "height": round(b.height),
    }
    if b.text:
        entry["text"] = b.text
    if b.bgColor:
        entry["bgColor"] = b.bgColor
    if b.textColor:
        entry["textColor"] = b.textColor
    if b.hasBorder:
        entry["hasBorder"] = True
    if b.isRounded:
        entry["isRounded"] = True
    return entry


def _clean_layout(node: Dict) -> Dict:
    """Strip coordinates from layout tree to keep it readable, keep semantic info."""
    result: Dict[str, Any] = {}
    if "label" in node:
        result["label"] = node["label"]
    if "text" in node and node["text"]:
        result["text"] = node["text"]
    if "bgColor" in node:
        result["bgColor"] = node["bgColor"]
    if "textColor" in node:
        result["textColor"] = node["textColor"]
    if "hasBorder" in node:
        result["hasBorder"] = node["hasBorder"]
    if "isRounded" in node:
        result["isRounded"] = node["isRounded"]
    if "layout" in node:
        result["layout"] = node["layout"]
    if "children" in node:
        result["children"] = [_clean_layout(c) for c in node["children"]]
    if "sections" in node:
        result["sections"] = [_clean_layout(s) for s in node["sections"]]
    if "root" in node:
        result["root"] = _clean_layout(node["root"])
    return result


def build_annotation_prompt(
    boxes: List[Box], image_width: int, image_height: int, full_text: str = ""
) -> str:
    annotations = [_box_to_annotation(b) for b in boxes]

    # Build layout hierarchy
    layout = analyze_layout(annotations)
    clean = _clean_layout(layout)

    full_text_section = ""
    if full_text.strip():
        full_text_section = f"""
## Full page text (OCR of entire screenshot, for context)
{full_text.strip()}
"""

    return f"""Generate React + Tailwind components that recreate the following UI layout.

Canvas size: {image_width}x{image_height}px
{full_text_section}
## Flat element list (with positions)
{json.dumps(annotations, indent=2)}

## Layout structure (hierarchy + row/column grouping)
{json.dumps(clean, indent=2)}

IMPORTANT: Use the "Layout structure" as your PRIMARY guide — it tells you exactly which elements are inside which containers and whether they're arranged as rows or columns.

Instructions:
- "layout": "row" → use flex + flex-row, children are side by side
- "layout": "column" → use flex + flex-col, children are stacked vertically
- "sections" are top-level vertical sections of the page (navbar, hero, features, footer, etc.)
- "children" are nested elements within a container
- Use the flat element list for pixel positions — compute relative spacing between siblings:
  - Gap between elements in a row = difference in x positions
  - Gap between elements in a column = difference in y positions
  - Convert pixel gaps to Tailwind spacing (4px=1, 8px=2, 16px=4, 24px=6, 32px=8, etc.)
- Use the "text" field as real content (button labels, headings, paragraph text)
- Use "bgColor" and "textColor" to match colors via Tailwind classes (pick the closest Tailwind color)
- If "hasBorder" is true, add a border; if "isRounded" is true, use rounded corners
- Each distinct section should be its own React component
- NEVER use absolute positioning — use only flex/grid with gap/padding/margin
- Use justify-between, justify-center, items-center etc. to position elements within flex containers"""


def _describe_move(c: Dict) -> str:
    """Convert a layout change into a human-readable instruction."""
    tag = c.get("element_tag", c.get("elementTag", "element"))
    text = c.get("element_text", c.get("elementText", ""))
    direction = c.get("direction", "")
    dx = c.get("deltaX", 0)
    dy = c.get("deltaY", 0)
    classes = c.get("elementClasses", c.get("element_classes", ""))

    # Identify the element
    ident = f"<{tag}>"
    if text:
        ident = f'<{tag}> containing "{text[:50]}"'
    if classes:
        ident += f" (classes: {classes})"

    # Describe the intent
    parts = []
    if direction == "up":
        parts.append(f"moved UP by {abs(dy)}px — user wants this element higher / earlier in the layout")
    elif direction == "down":
        parts.append(f"moved DOWN by {abs(dy)}px — user wants this element lower / later in the layout")
    elif direction == "left":
        parts.append(f"moved LEFT by {abs(dx)}px — user wants this element further left")
    elif direction == "right":
        parts.append(f"moved RIGHT by {abs(dx)}px — user wants this element further right")
    else:
        parts.append(f"moved by ({dx}, {dy})px")

    # Add sibling context if available
    siblings_before = c.get("siblingsBefore", c.get("siblings_before", []))
    siblings_after = c.get("siblingsAfter", c.get("siblings_after", []))
    if siblings_before:
        order_before = [s.get("text", s.get("tag", "?"))[:30] for s in siblings_before]
        parts.append(f"Original element order: {' → '.join(order_before)}")

    return f"- {ident}: {'; '.join(parts)}"


def build_iteration_prompt(
    current_code: str, feedback: str, layout_changes: List[LayoutChange] = []
) -> str:
    parts = [f"Current code:\n```jsx\n{current_code}\n```"]

    if layout_changes:
        # Convert to dicts for easier access (LayoutChange may have aliased fields)
        raw_changes = [c.model_dump(by_alias=True) if hasattr(c, 'model_dump') else c for c in layout_changes]
        moves = [_describe_move(c) for c in raw_changes]
        parts.append(
            "The user physically dragged these elements in the live preview to indicate layout changes:\n"
            + "\n".join(moves)
            + "\n\n"
            + "Instructions for applying layout changes:\n"
            + "- Moving UP/DOWN means reorder elements (change the JSX order, not add margins)\n"
            + "- Moving LEFT/RIGHT means change horizontal position (reorder in a flex-row, or change alignment)\n"
            + "- Large moves (>100px) likely mean swapping sections entirely\n"
            + "- Small moves (<50px) likely mean adjusting spacing/padding\n"
            + "- Preserve all existing content and styling — only change layout/ordering"
        )

    if feedback:
        parts.append(f"User feedback: {feedback}")

    parts.append(
        "Return the updated component code. Return ONLY the code inside a single ```jsx code fence, nothing else."
    )

    return "\n\n".join(parts)
