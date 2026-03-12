from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.models import (
    DetectRequest,
    DetectResponse,
    GenerateRequest,
    GenerateResponse,
    IterateRequest,
    OcrRequest,
    OcrResponse,
)
from backend.detection import detect_elements, ocr_region
from backend.generation import generate, iterate

app = FastAPI(title="Reactor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/detect", response_model=DetectResponse)
async def detect(req: DetectRequest):
    try:
        boxes, image_id, full_text = detect_elements(req.image)
        return DetectResponse(boxes=boxes, image_id=image_id, full_text=full_text)  # type: ignore[arg-type]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ocr", response_model=OcrResponse)
async def ocr_box(req: OcrRequest):
    try:
        result = ocr_region(req.image_id, req.x, req.y, req.width, req.height)
        return OcrResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_code(req: GenerateRequest):
    try:
        code, session_id = generate(
            req.api_key, req.boxes, req.image_width, req.image_height, req.full_text
        )
        return GenerateResponse(
            code=code,
            session_id=session_id,
            message="Generated component." if code else "Failed to parse code.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/iterate", response_model=GenerateResponse)
async def iterate_code(req: IterateRequest):
    try:
        code = iterate(req.api_key, req.session_id, req.feedback, req.layout_changes)
        return GenerateResponse(
            code=code,
            session_id=req.session_id,
            message="Updated component." if code else "Failed to parse code.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
