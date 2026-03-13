# Reactor

**Screenshot → Structured Annotations → React Code**

Reactor converts UI screenshots into React + Tailwind components through a structured detection pipeline — no image is ever sent to the LLM. Demo:

[![Watch the video](https://img.youtube.com/vi/qRnOvF4dx54/maxresdefault.jpg)](https://youtu.be/qRnOvF4dx54)

## Why Not Just Send the Screenshot to a VLLM?

Vision-language models (GPT-4o, Claude with vision, etc.) can look at a screenshot and generate code directly. It sounds simpler, but it falls apart in practice:

**1. Hallucination & Imprecision**
VLLMs guess at layouts. They can't measure pixel distances, detect containment hierarchies, or extract exact colors. The result is code that *looks similar* but has wrong spacing, incorrect font sizes, misaligned elements, and fabricated content. Reactor extracts real measurements, real OCR text, real colors — Claude works from facts, not visual interpretation.

**2. No Editability**
With a VLLM approach, the screenshot is a black box. If the model misidentifies a button as a heading, you regenerate the entire thing and hope. With Reactor, every detected element is an editable bounding box with a label, OCR text, and visual properties. Users drag, resize, relabel, then regenerate — with surgical precision over what the model sees.

**3. Structured > Ambiguous**
Sending an image says "figure it out." Sending a hierarchy tree with row/column groupings, element labels, text content, background colors, and border properties says "here's exactly what to build." The LLM generates better code because it receives an unambiguous specification rather than pixels to interpret.

**4. Cost & Latency**
Image tokens are expensive. A single screenshot can consume 1000+ tokens on the vision API. Reactor's structured annotations are ~200-400 text tokens regardless of image complexity, making iteration cycles faster and cheaper.

**5. Iterative Feedback Loop**
Users can physically drag elements in the live preview, and those layout changes are sent as structured coordinate diffs — not a new screenshot. The LLM adjusts flex direction, spacing, and ordering based on exact positional data rather than trying to visually diff two images.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                     React + Vite + Tailwind                 │
│                                                             │
│  ┌──────────┐   ┌──────────────────┐   ┌────────────────┐   │
│  │  Upload  │──▶│  Bounding Box    │──▶│  Live Preview  │   │
│  │  Zone    │   │  Editor          │   │  + Chat Panel  │   │
│  └──────────┘   │  (react-rnd)     │   │  (iframe+Babel)│   │
│                 │  drag/resize/    │   │  draggable     │   │
│                 │  relabel boxes   │   │  elements      │   │
│                 └──────────────────┘   └────────────────┘   │
│         │                │                    │     │       │
└─────────┼────────────────┼────────────────────┼─────┼───────┘
          │ base64         │ box adjust         │     │
          │ image          │ (image_id,coords)  │     │ text
          ▼                ▼                    │     │ feedback
┌─────────────────────────────────────────────┐ │     │
│                  BACKEND                    │ │     │
│               FastAPI + Python              │ │     │
│                                             │ │     │
│  ┌─────────────────────────────────────────┐│ │     │
│  │          /api/detect                    ││ │     │
│  │                                         ││ │     │
│  │  RF-DETR (UI-DETR-1)                    ││ │     │
│  │    class-agnostic element detection     ││ │     │
│  │              ▼                          ││ │     │
│  │  EasyOCR                                ││ │     │
│  │    per-crop text extraction             ││ │     │
│  │    full-page OCR for context            ││ │     │
│  │              ▼                          ││ │     │
│  │  Heuristic Classifier                   ││ │     │
│  │    text + dimensions + aspect ratio     ││ │     │
│  │    → Button, Heading, Paragraph, etc.   ││ │     │
│  │              ▼                          ││ │     │
│  │  OpenCV Visual Properties               ││ │     │
│  │    dominant color, text color,          ││ │     │
│  │    border detection, rounded corners    ││ │     │
│  │              ▼                          ││ │     │
│  │  Returns: boxes[] + image_id + text     ││ │     │
│  └─────────────────────────────────────────┘│ │     │
│                                             │ │     │
│  ┌─────────────────────────────────────────┐│ │     │
│  │          /api/ocr                       │◀┼─┘    |
│  │  Re-OCR + reclassify on box adjust      ││       │
│  │  Uses cached image (by image_id)        ││       │
│  └─────────────────────────────────────────┘│       │
│                                             │       │
│  ┌─────────────────────────────────────────┐│       │
│  │    /api/generate  +  /api/iterate       │◀┼───────┘
│  │                                         │ │
│  │  Layout Analysis                        │ │
│  │    containment hierarchy (70% overlap)  │ │
│  │    row/column grouping by position      │ │
│  │              ▼                          │ │
│  │  LangChain + Claude (sonnet)            │ │
│  │    receives ONLY structured JSON:       │ │
│  │    - flat element list with positions   │ │
│  │    - hierarchy tree with layout info    │ │
│  │    - full-page OCR text                 │ │
│  │    - visual properties per element      │ │
│  │    NO image is sent to the LLM          │ │
│  │              ▼                          │ │
│  │  Session-based conversation history     │ │
│  │    iterate with text + drag diffs       │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Pipeline Detail

```
Screenshot (base64)
  │
  ├──▶ RF-DETR detects UI element bounding boxes (class-agnostic)
  │
  ├──▶ Each crop → EasyOCR extracts text content
  │
  ├──▶ Each crop → Heuristic classifier assigns label:
  │      Icon (<50x50, no text)
  │      Navigation (wide, no text)
  │      Text Button (short text, compact)
  │      Heading (short text, <60px tall)
  │      Paragraph (long text or tall)
  │      Text Input, Link, Image, Container...
  │
  ├──▶ Each crop → OpenCV extracts visual properties:
  │      bgColor (k-means dominant color)
  │      textColor (thresholded foreground)
  │      hasBorder (Canny edge on perimeter)
  │      isRounded (corner edge density)
  │
  ├──▶ Full-page OCR for overall text context
  │
  ├──▶ User adjusts boxes → re-OCR + reclassify per region
  │
  ├──▶ Layout analysis:
  │      Containment hierarchy (parent-child by area overlap)
  │      Row/column grouping (vertical center clustering)
  │
  └──▶ Structured JSON → Claude generates React + Tailwind
       │
       └──▶ Live preview with draggable elements
            User drags → coordinate diffs sent to Claude
            User chats → text feedback sent to Claude
            Claude iterates on code with full session history
```

## Setup

### Prerequisites
- Node.js 18+
- Python 3.10+ (3.12 recommended)
- [RF-DETR model weights](https://huggingface.co/racineai/UI-DETR-1) (`model/model.pth`)

### Install

```bash
# Frontend
npm install

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Download model weights
python ../scripts/export_model.py
```

### Run

```bash
# Terminal 1 — Backend
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
npm run dev
```

Open `http://localhost:5173`, set your Anthropic API key, upload a screenshot.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, TypeScript |
| Box Editor | react-rnd (drag + resize) |
| Preview | Custom iframe, Babel transpilation, Tailwind CDN |
| Detection | RF-DETR (racineai/UI-DETR-1) |
| OCR | EasyOCR |
| Visual Analysis | OpenCV (color, border, corner detection) |
| Layout Analysis | Custom containment + row/column grouping |
| Code Generation | LangChain + Claude (claude-sonnet-4-6) |
| Backend | FastAPI, Python |
