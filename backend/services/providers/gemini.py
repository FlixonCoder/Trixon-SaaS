"""
Trixon Backend — Gemini Provider

NOT CURRENTLY USED. Kept for future multi-provider support.
See trixon-cleanup-audit-prompt.md for context.
"""

import logging
import time

from google import genai
from google.genai import types

from backend.core.config import get_settings
from backend.services.llm_client import ReportOutput, extract_json_from_text, json_to_markdown

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"

def generate_gemini_report(
    report_type: str,
    context_prompt: str,
    system_prompt: str,
    max_retries: int = 1,
) -> ReportOutput:
    settings = get_settings()

    if not settings.gemini_api_key:
        return ReportOutput(
            report_type=report_type,
            content_json={},
            content_markdown="*Gemini API key not configured.*",
            score=0,
            error="GEMINI_API_KEY not set",
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    user_message = (
        f"{context_prompt}\n\n"
        f"=== TASK ===\n"
        f"Generate the '{report_type}' report for this codebase. "
        f"Return ONLY valid JSON matching the schema in your instructions. "
        f"No markdown fences, no extra text — pure JSON."
    )

    last_error = None
    is_rate_limit = False
    
    logger.info(f"[Gemini] [{report_type}] Report generation started.")

    for attempt in range(max_retries + 1):
        try:
            logger.info(f"[Gemini] [{report_type}] Sending request (Attempt {attempt + 1}/{max_retries + 1})...")
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3,
                    max_output_tokens=4096,
                ),
            )
            logger.info(f"[Gemini] [{report_type}] Received response.")

            raw_text = response.text.strip()
            content_json = extract_json_from_text(raw_text)
            
            score = int(content_json.get("score", 50))
            score = max(0, min(100, score))

            content_markdown = json_to_markdown(report_type, content_json)

            logger.info(f"[Gemini] [{report_type}] Successfully parsed.")
            
            # Enforce lightweight rate limiting between successful calls
            time.sleep(2.0)

            return ReportOutput(
                report_type=report_type,
                content_json=content_json,
                content_markdown=content_markdown,
                score=score,
            )

        except Exception as e:
            last_error = f"Error on attempt {attempt + 1}: {e}"
            logger.warning(f"[Gemini] [{report_type}] {last_error}")
            
            if "429" in str(e) or "quota" in str(e).lower() or "rate" in str(e).lower():
                logger.error(f"[Gemini] [{report_type}] Rate limit exceeded.")
                is_rate_limit = True

        if attempt < max_retries:
            logger.info(f"[Gemini] [{report_type}] Retrying in 2 seconds...")
            time.sleep(2.0)

    logger.error(f"[Gemini] [{report_type}] Failed after {max_retries + 1} attempts.")
    return ReportOutput(
        report_type=report_type,
        content_json={},
        content_markdown=f"*Report generation failed: {last_error}*",
        score=0,
        error=last_error,
        is_rate_limit_error=is_rate_limit,
    )


def simplify_text_gemini(text: str, system_prompt: str) -> str:
    settings = get_settings()
    if not settings.gemini_api_key:
        return "Gemini API key not configured."
        
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3,
        ),
    )
    return response.text.strip()
