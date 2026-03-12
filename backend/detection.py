from __future__ import annotations

import base64
import io
import os
import uuid
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from rfdetr.detr import RFDETRMedium
import easyocr

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model")
CONFIDENCE_THRESHOLD = 0.35

_model: Optional[RFDETRMedium] = None
_reader: Optional[easyocr.Reader] = None
_image_cache: Dict[str, np.ndarray] = {}


def get_model() -> RFDETRMedium:
    global _model
    if _model is None:
        model_path = os.path.join(MODEL_DIR, "model.pth")
        _model = RFDETRMedium(pretrain_weights=model_path, resolution=1600)
    return _model


def get_ocr() -> easyocr.Reader:
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["en"], gpu=False)
    return _reader


def _decode_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return np.array(image)


def _crop(image_np: np.ndarray, x: float, y: float, w: float, h: float) -> np.ndarray:
    ih, iw = image_np.shape[:2]
    x1 = max(0, int(x))
    y1 = max(0, int(y))
    x2 = min(iw, int(x + w))
    y2 = min(ih, int(y + h))
    return image_np[y1:y2, x1:x2]


def _dominant_color(crop: np.ndarray) -> str:
    """Get the dominant color of a crop as a hex string."""
    if crop.size == 0:
        return "#ffffff"
    small = cv2.resize(crop, (8, 8), interpolation=cv2.INTER_AREA)
    pixels = small.reshape(-1, 3).astype(np.float32)
    _, labels, centers = cv2.kmeans(
        pixels, 2, None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
        3, cv2.KMEANS_PP_CENTERS,
    )
    # Pick the most common cluster
    counts = np.bincount(labels.flatten())
    dominant = centers[counts.argmax()].astype(int)
    return "#{:02x}{:02x}{:02x}".format(dominant[0], dominant[1], dominant[2])


def _text_color(crop: np.ndarray) -> str:
    """Estimate the text/foreground color."""
    if crop.size == 0:
        return "#000000"
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    # Threshold to find dark pixels (likely text)
    _, mask = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY_INV)
    text_pixels = crop[mask > 0]
    if len(text_pixels) == 0:
        # Try light text on dark background
        _, mask = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
        text_pixels = crop[mask > 0]
    if len(text_pixels) == 0:
        return "#000000"
    avg = text_pixels.mean(axis=0).astype(int)
    return "#{:02x}{:02x}{:02x}".format(avg[0], avg[1], avg[2])


def _has_border(crop: np.ndarray) -> bool:
    """Check if the crop has a visible border/outline."""
    if crop.size == 0:
        return False
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    h, w = edges.shape
    if h < 4 or w < 4:
        return False
    border_pixels = np.concatenate([
        edges[0, :], edges[-1, :], edges[:, 0], edges[:, -1]
    ])
    return float(border_pixels.mean()) > 30


def _is_rounded(crop: np.ndarray) -> bool:
    """Check if the crop corners suggest rounded corners."""
    if crop.size == 0:
        return False
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    h, w = edges.shape
    corner_size = min(h, w) // 4
    if corner_size < 3:
        return False
    corners = [
        edges[:corner_size, :corner_size],
        edges[:corner_size, -corner_size:],
        edges[-corner_size:, :corner_size],
        edges[-corner_size:, -corner_size:],
    ]
    # Rounded corners have fewer edge pixels in corner regions
    corner_density = sum(c.mean() for c in corners) / 4
    return corner_density < 20


def extract_visual_props(crop: np.ndarray) -> Dict:
    """Extract visual properties from a crop."""
    bg = _dominant_color(crop)
    fg = _text_color(crop)
    bordered = _has_border(crop)
    rounded = _is_rounded(crop)
    return {
        "bgColor": bg,
        "textColor": fg,
        "hasBorder": bordered,
        "isRounded": rounded,
    }


def classify_element(
    crop: np.ndarray, text: str, width: float, height: float
) -> str:
    """Classify a UI element based on its text, dimensions, and appearance."""
    aspect = width / max(height, 1)
    area = width * height
    has_text = len(text.strip()) > 0

    if not has_text:
        if width < 50 and height < 50:
            return "Icon"
        if aspect > 3:
            return "Navigation"
        if area > 40000:
            return "Image"
        return "Container"

    if len(text.strip()) < 20 and 0.5 < aspect < 8 and height < 80:
        if height < 30 and width < 150:
            return "Link"
        return "Text Button"

    if len(text.strip()) < 40 and height < 60:
        return "Heading"

    if aspect > 3 and height < 60 and len(text.strip()) < 30:
        return "Text Input"

    if len(text.strip()) > 50 or height > 80:
        return "Paragraph"

    return "Text"


def _ocr_crop(reader: easyocr.Reader, crop: np.ndarray) -> str:
    if crop.size == 0:
        return ""
    results = reader.readtext(crop, detail=0, paragraph=True)
    return " ".join(results).strip()


def ocr_region(
    image_id: str, x: float, y: float, width: float, height: float
) -> Dict:
    """OCR + classify a single region. Called when user adjusts a box."""
    image_np = _image_cache.get(image_id)
    if image_np is None:
        raise ValueError("Image not found. Re-upload the screenshot.")
    reader = get_ocr()
    crop = _crop(image_np, x, y, width, height)
    text = _ocr_crop(reader, crop)
    label = classify_element(crop, text, width, height)
    return {"text": text, "label": label}


def detect_elements(image_base64: str) -> Tuple[List[Dict], str, str]:
    """Run detection on a base64-encoded image, then OCR + analyze each crop.
    Returns (boxes, image_id, full_page_text)."""
    image_np = _decode_image(image_base64)

    # Cache the image for later OCR calls
    image_id = str(uuid.uuid4())
    _image_cache[image_id] = image_np

    model = get_model()
    reader = get_ocr()

    # Full-page OCR for overall context
    full_page_text = _ocr_crop(reader, image_np)

    detections = model.predict(image_np, threshold=CONFIDENCE_THRESHOLD)

    boxes: List[Dict] = []
    for i in range(len(detections.xyxy)):
        x1, y1, x2, y2 = detections.xyxy[i]
        confidence = float(detections.confidence[i])
        bw = float(x2 - x1)
        bh = float(y2 - y1)

        crop = _crop(image_np, float(x1), float(y1), bw, bh)
        text = _ocr_crop(reader, crop)
        label = classify_element(crop, text, bw, bh)
        visual = extract_visual_props(crop)

        boxes.append({
            "x": round(float(x1), 1),
            "y": round(float(y1), 1),
            "width": round(bw, 1),
            "height": round(bh, 1),
            "label": label,
            "confidence": round(confidence, 3),
            "text": text,
            **visual,
        })

    boxes.sort(key=lambda b: b["confidence"], reverse=True)
    return boxes, image_id, full_page_text
