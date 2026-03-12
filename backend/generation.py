from __future__ import annotations

import re
import uuid
from typing import Dict, List, Optional, Tuple

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage

from backend.models import Box, LayoutChange
from backend.prompts import SYSTEM_PROMPT, build_annotation_prompt, build_iteration_prompt

# In-memory session store: session_id -> { history, code }
_sessions: Dict[str, Dict] = {}


def _extract_code(text: str) -> Optional[str]:
    match = re.search(r"```(?:jsx|tsx|javascript|js)?\s*\n([\s\S]*?)```", text)
    return match.group(1).strip() if match else None


def _create_chat(api_key: str) -> ChatAnthropic:
    return ChatAnthropic(
        model="claude-sonnet-4-6",
        anthropic_api_key=api_key,
        max_tokens=4096,
    )


def _invoke(chat: ChatAnthropic, messages: List[BaseMessage]) -> str:
    response = chat.invoke(messages)
    if isinstance(response.content, str):
        return response.content
    return "".join(
        block["text"] for block in response.content if block["type"] == "text"  # type: ignore[index]
    )


def generate(
    api_key: str, boxes: List[Box], image_width: int, image_height: int,
    full_text: str = ""
) -> Tuple[Optional[str], str]:
    """Initial code generation. Returns (code, session_id)."""
    chat = _create_chat(api_key)
    prompt = build_annotation_prompt(boxes, image_width, image_height, full_text)

    messages: List[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ]

    raw = _invoke(chat, messages)
    code = _extract_code(raw)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "history": [
            HumanMessage(content=prompt),
            AIMessage(content=raw),
        ],
        "code": code,
    }

    return code, session_id


def iterate(
    api_key: str,
    session_id: str,
    feedback: str,
    layout_changes: Optional[List[LayoutChange]] = None,
) -> Optional[str]:
    """Iterate on existing code with user feedback. Returns updated code."""
    session = _sessions.get(session_id)
    if not session or not session["code"]:
        raise ValueError("No active session or code to iterate on")

    chat = _create_chat(api_key)
    prompt = build_iteration_prompt(session["code"], feedback, layout_changes or [])

    messages: List[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        *session["history"],
        HumanMessage(content=prompt),
    ]

    raw = _invoke(chat, messages)
    code = _extract_code(raw)

    session["history"].extend([
        HumanMessage(content=prompt),
        AIMessage(content=raw),
    ])
    if code:
        session["code"] = code

    return code
