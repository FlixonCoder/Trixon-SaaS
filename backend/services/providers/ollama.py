"""
Trixon Backend — Ollama Provider

NOT CURRENTLY USED. Kept for future multi-provider support.
See trixon-cleanup-audit-prompt.md for context.
"""

import logging
import time
import httpx

from backend.core.config import get_settings
from backend.services.llm_client import ReportOutput, extract_json_from_text, json_to_markdown

logger = logging.getLogger(__name__)

OLLAMA_MODEL = "qwen2.5:3b"

def generate_ollama_report(
    report_type: str,
    context_prompt: str,
    system_prompt: str,
    max_retries: int = 1,
) -> ReportOutput:
    settings = get_settings()

    user_message = (
        f"{context_prompt}\n\n"
        f"=== TASK ===\n"
        f"Generate the '{report_type}' report for this codebase. "
        f"Return ONLY valid JSON matching the schema in your instructions. "
        f"No markdown fences, no extra text — pure JSON."
    )

    payload = {
        "model": OLLAMA_MODEL,
        "system": system_prompt,
        "prompt": user_message,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "num_ctx": 8192
        }
    }

    last_error = None
    logger.info(f"[Ollama] [{report_type}] Report generation started.")

    for attempt in range(max_retries + 1):
        try:
            logger.info(f"[Ollama] [{report_type}] Sending request (Attempt {attempt + 1}/{max_retries + 1})...")
            
            with httpx.Client(timeout=180.0) as client:
                response = client.post(
                    f"{settings.ollama_url.rstrip('/')}/api/generate",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()

            logger.info(f"[Ollama] [{report_type}] Received response.")

            raw_text = data.get("response", "").strip()
            content_json = extract_json_from_text(raw_text)
            
            score = int(content_json.get("score", 50))
            score = max(0, min(100, score))

            content_markdown = json_to_markdown(report_type, content_json)

            logger.info(f"[Ollama] [{report_type}] Successfully parsed.")

            return ReportOutput(
                report_type=report_type,
                content_json=content_json,
                content_markdown=content_markdown,
                score=score,
            )

        except Exception as e:
            last_error = f"Error on attempt {attempt + 1}: {e}"
            logger.warning(f"[Ollama] [{report_type}] {last_error}")
            
        if attempt < max_retries:
            logger.info(f"[Ollama] [{report_type}] Retrying in 2 seconds...")
            time.sleep(2.0)

    logger.error(f"[Ollama] [{report_type}] Failed after {max_retries + 1} attempts.")
    return ReportOutput(
        report_type=report_type,
        content_json={},
        content_markdown=f"*Report generation failed: {last_error}*",
        score=0,
        error=last_error,
        is_rate_limit_error=False,
    )


def simplify_text_ollama(text: str, system_prompt: str) -> str:
    settings = get_settings()
    
    payload = {
        "model": OLLAMA_MODEL,
        "system": system_prompt,
        "prompt": text,
        "stream": False,
        "options": {
            "temperature": 0.3
        }
    }
    
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            f"{settings.ollama_url.rstrip('/')}/api/generate",
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()
