"""
Spatial analysis: containment detection and row/column grouping.
Transforms a flat list of boxes into a hierarchical layout structure.
"""
from __future__ import annotations

from typing import Any, Dict, List


def _contains(parent: Dict, child: Dict, threshold: float = 0.7) -> bool:
    """Check if parent box contains most of child box."""
    px1, py1 = parent["x"], parent["y"]
    px2, py2 = px1 + parent["width"], py1 + parent["height"]
    cx1, cy1 = child["x"], child["y"]
    cx2, cy2 = cx1 + child["width"], cy1 + child["height"]

    # Intersection
    ix1 = max(px1, cx1)
    iy1 = max(py1, cy1)
    ix2 = min(px2, cx2)
    iy2 = min(py2, cy2)

    if ix2 <= ix1 or iy2 <= iy1:
        return False

    intersection = (ix2 - ix1) * (iy2 - iy1)
    child_area = max(child["width"] * child["height"], 1)

    # Parent must be meaningfully larger
    parent_area = parent["width"] * parent["height"]
    if parent_area < child_area * 1.3:
        return False

    return intersection / child_area >= threshold


def build_hierarchy(boxes: List[Dict]) -> List[Dict]:
    """
    Assign parent-child relationships based on containment.
    Returns boxes with a "children" field and removes children from the top level.
    """
    if not boxes:
        return []

    # Sort by area descending — larger boxes are potential parents
    sorted_boxes = sorted(boxes, key=lambda b: b["width"] * b["height"], reverse=True)

    # Track which boxes are children
    child_ids: set = set()
    children_map: Dict[int, List[Dict]] = {i: [] for i in range(len(sorted_boxes))}

    for i, child in enumerate(sorted_boxes):
        for j, parent in enumerate(sorted_boxes):
            if i == j:
                continue
            if i in child_ids:
                break
            if _contains(parent, child):
                children_map[j].append(child)
                child_ids.add(i)
                break

    # Build result: only top-level boxes, each with nested children
    result = []
    for i, box in enumerate(sorted_boxes):
        if i not in child_ids:
            node = dict(box)
            if children_map[i]:
                node["children"] = children_map[i]
            result.append(node)

    return result


def _center_y(box: Dict) -> float:
    return box["y"] + box["height"] / 2


def _center_x(box: Dict) -> float:
    return box["x"] + box["width"] / 2


def group_into_rows(boxes: List[Dict], tolerance: float = 0.5) -> List[List[Dict]]:
    """
    Group boxes into horizontal rows based on vertical overlap.
    tolerance: fraction of min height that centers can differ by.
    """
    if not boxes:
        return []

    sorted_by_y = sorted(boxes, key=_center_y)
    rows: List[List[Dict]] = [[sorted_by_y[0]]]

    for box in sorted_by_y[1:]:
        last_row = rows[-1]
        # Compare with the average center_y of current row
        avg_cy = sum(_center_y(b) for b in last_row) / len(last_row)
        min_h = min(box["height"], min(b["height"] for b in last_row))
        threshold = max(min_h * tolerance, 15)

        if abs(_center_y(box) - avg_cy) <= threshold:
            last_row.append(box)
        else:
            rows.append([box])

    # Sort each row left-to-right
    for row in rows:
        row.sort(key=_center_x)

    return rows


def analyze_layout(boxes: List[Dict]) -> Dict[str, Any]:
    """
    Full layout analysis:
    1. Build containment hierarchy
    2. Group top-level elements into rows
    3. Detect if rows suggest a column layout
    Returns a structured layout description.
    """
    hierarchy = build_hierarchy(boxes)

    # Recursively group children into rows too
    def process_node(node: Dict) -> Dict:
        result = dict(node)
        children = result.pop("children", [])
        if children:
            child_rows = group_into_rows(children)
            if len(child_rows) == 1 and len(child_rows[0]) > 1:
                result["layout"] = "row"
                result["children"] = [process_node(c) for c in child_rows[0]]
            elif all(len(r) == 1 for r in child_rows):
                result["layout"] = "column"
                result["children"] = [process_node(r[0]) for r in child_rows]
            else:
                result["layout"] = "rows"
                result["children"] = []
                for row in child_rows:
                    if len(row) == 1:
                        result["children"].append(process_node(row[0]))
                    else:
                        result["children"].append({
                            "layout": "row",
                            "children": [process_node(c) for c in row],
                        })
        return result

    processed = [process_node(n) for n in hierarchy]

    # Group top-level nodes into rows
    top_rows = group_into_rows(processed)

    if len(top_rows) == 1 and len(top_rows[0]) == 1:
        return {"layout": "single", "root": processed[0]}

    sections = []
    for row in top_rows:
        if len(row) == 1:
            sections.append(row[0])
        else:
            sections.append({"layout": "row", "children": row})

    return {"layout": "column", "sections": sections}
