from __future__ import annotations

from typing import Any, Dict, Optional, List

from pydantic import BaseModel, Field


class Box(BaseModel):
    x: float
    y: float
    width: float
    height: float
    label: str
    confidence: float
    text: str = ""
    bgColor: str = ""
    textColor: str = ""
    hasBorder: bool = False
    isRounded: bool = False


class DetectRequest(BaseModel):
    image: str  # base64 data URL or raw base64


class DetectResponse(BaseModel):
    boxes: List[Box]
    image_id: str
    full_text: str = ""


class OcrRequest(BaseModel):
    image_id: str
    x: float
    y: float
    width: float
    height: float


class OcrResponse(BaseModel):
    text: str
    label: str


class GenerateRequest(BaseModel):
    api_key: str
    boxes: List[Box]
    image_width: int
    image_height: int
    full_text: str = ""


class LayoutChange(BaseModel):
    element_tag: str = Field(alias="elementTag")
    element_text: str = Field(alias="elementText")
    from_pos: Dict[str, Any] = Field(alias="from")
    to_pos: Dict[str, Any] = Field(alias="to")

    class Config:
        populate_by_name = True


class IterateRequest(BaseModel):
    api_key: str
    session_id: str
    feedback: str
    layout_changes: List[LayoutChange] = []


class GenerateResponse(BaseModel):
    code: Optional[str]
    session_id: str
    message: str
