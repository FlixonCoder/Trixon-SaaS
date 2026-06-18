"""
Trixon Backend — Groq LLM Provider (v3.6 Multi-Key Pool)

Uses Groq API (console.groq.com) with model openai/gpt-oss-120b.
OpenAI-compatible API format. Set LLM_PROVIDER=groq in .env to activate.

v3.6 additions:
  - All calls routed through call_groq_with_pool() for automatic key selection
    and failover across the GroqKeyPool
  - 429 errors automatically retry on the next available key (up to pool size attempts)
  - Raw API keys never appear in logs — only short hashed key_id
  - Backward compatible: works identically with 1 key (today's setup)
  - Removed old adaptive time.sleep() logic — pool handles rate-limit avoidance
"""

import json
import logging
import time
from typing import Generator

import httpx

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# -----------------------------------------------
# Core pool-aware HTTP caller
# -----------------------------------------------

def call_groq_with_pool(
    messages: list[dict],
    max_tokens: int = 4096,
    temperature: float = 0.1,
    response_format: dict | None = None,
    timeout: float = 120.0,
    context_label: str = "call",
    **kwargs,
) -> dict:
    """
    Pool-aware Groq API caller.

    Picks the best available key, makes the HTTP request, records rate-limit
    headers, and on a 429 automatically retries with the next available key
    up to len(pool) attempts before giving up.

    Args:
        messages: OpenAI-format message list (already includes system message if needed)
        max_tokens: Max completion tokens
        temperature: Sampling temperature
        response_format: Optional response format dict (e.g. {"type": "json_object"})
        timeout: httpx timeout in seconds
        context_label: Short label for logging (e.g. "security", "chat")

    Returns:
        Parsed JSON dict from the Groq API response

    Raises:
        Exception: if all keys are exhausted after retries
    """
    from backend.core.key_pool_client import get_key_pool
    import hashlib

    settings = get_settings()
    model = settings.groq_model or "openai/gpt-oss-120b"

    pool = get_key_pool()

    # Fallback: if pool init failed (e.g., no keys configured), raise clearly
    if pool is None:
        raise RuntimeError(
            "No Groq API keys available. Set GROQ_API_KEYS or GROQ_API_KEY in .env."
        )

    num_keys = len(pool)
    attempted_keys: set[str] = set()
    last_error: Exception | None = None

    for attempt in range(num_keys):
        key = pool.get_best_key()

        # Avoid retrying on the same key
        if key in attempted_keys:
            # Try to find an untried key
            untried = [k for k in pool.api_keys if k not in attempted_keys]
            if not untried:
                break
            key = untried[0]

        attempted_keys.add(key)
        kid = hashlib.sha256(key.encode()).hexdigest()[:8]

        payload: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        # v3.6 payload size check
        actual_char_count = len(json.dumps(payload))
        actual_token_estimate = actual_char_count // 4
        logger.info(f"[Groq] [{context_label}] Sending request — actual payload: {actual_char_count} chars (~{actual_token_estimate} tokens est.)")

        try:
            logger.info(
                f"[Groq] [{context_label}] Attempt {attempt + 1}/{num_keys} "
                f"using key {kid}"
            )

            with httpx.Client(timeout=timeout) as client:
                response = client.post(
                    GROQ_API_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                )

            # Update pool with rate-limit info from headers (always, even on error)
            pool.record_response(key, dict(response.headers))

            if response.status_code == 429:
                retry_after = float(response.headers.get("retry-after", "62"))
                logger.warning(
                    f"[Groq] [{context_label}] Key {kid} hit 429 — "
                    f"marking exhausted for {retry_after:.0f}s, trying next key"
                )
                pool.mark_exhausted(key, retry_after_seconds=retry_after)
                last_error = Exception(f"429 rate limit on key {kid}")
                continue  # try the next key
                
            if response.status_code == 413:
                # 413 Payload Too Large - no need to rotate keys, we need to shrink context
                logger.warning(f"[Groq] [{context_label}] 413 Payload Too Large — context is too big.")
                if kwargs.get("messages_reduced_attempted"):
                    raise Exception(f"413 Payload Too Large after shrinking context on key {kid}")
                
                # Shrink the context by stripping targeted files from the user message
                reduced_messages = []
                for m in messages:
                    if m["role"] == "user" and "=== TARGETED FILES ===" in m["content"]:
                        content = m["content"].split("=== TARGETED FILES ===")[0]
                        reduced_messages.append({"role": "user", "content": content})
                    else:
                        reduced_messages.append(m)
                
                return call_groq_with_pool(
                    messages=reduced_messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    response_format=response_format,
                    timeout=timeout,
                    context_label=context_label,
                    messages_reduced_attempted=True,
                )

            response.raise_for_status()
            data = response.json()
            logger.info(f"[Groq] [{context_label}] Success with key {kid}")
            return data

        except httpx.HTTPStatusError as e:
            last_error = e
            if "429" in str(e):
                pool.mark_exhausted(key, retry_after_seconds=62)
                logger.warning(f"[Groq] [{context_label}] Key {kid} 429 (status error) — trying next")
                continue
            if "413" in str(e):
                 logger.warning(f"[Groq] [{context_label}] 413 Payload Too Large — context is too big.")
                 if kwargs.get("messages_reduced_attempted"):
                     raise Exception(f"413 Payload Too Large after shrinking context on key {kid}")
                 reduced_messages = []
                 for m in messages:
                     if m["role"] == "user" and "=== TARGETED FILES ===" in m["content"]:
                         content = m["content"].split("=== TARGETED FILES ===")[0]
                         reduced_messages.append({"role": "user", "content": content})
                     else:
                         reduced_messages.append(m)
                 return call_groq_with_pool(
                     messages=reduced_messages,
                     max_tokens=max_tokens,
                     temperature=temperature,
                     response_format=response_format,
                     timeout=timeout,
                     context_label=context_label,
                     messages_reduced_attempted=True,
                 )
            logger.error(f"[Groq] [{context_label}] HTTP error with key {kid}: {e}")
            raise

        except Exception as e:
            last_error = e
            # Only retry on network errors, not logical failures
            if any(kw in str(e).lower() for kw in ("timeout", "connect", "network", "429", "rate")):
                logger.warning(f"[Groq] [{context_label}] Transient error with key {kid}: {e} — trying next")
                if "429" in str(e) or "rate" in str(e).lower():
                    pool.mark_exhausted(key, retry_after_seconds=62)
                continue
            logger.error(f"[Groq] [{context_label}] Non-retryable error with key {kid}: {e}")
            raise

    raise Exception(
        f"[Groq] [{context_label}] All {num_keys} key(s) exhausted. "
        f"Last error: {last_error}"
    )


# -----------------------------------------------
# Report generation — uses pool
# -----------------------------------------------

def generate_groq_report(
    report_type: str,
    context_prompt: str,
    system_prompt: str,
    max_retries: int = 1,
) -> "ReportOutput":  # type: ignore
    """Generate a full JSON report using Groq via the key pool."""
    from backend.services.llm_client import ReportOutput, extract_json_from_text, json_to_markdown

    user_message = (
        f"{context_prompt}\n\n"
        f"=== TASK ===\n"
        f"Generate the '{report_type}' report for this codebase. "
        f"Return ONLY valid JSON matching the schema in your instructions. "
        f"No markdown fences, no extra text — pure JSON."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    logger.info(f"[Groq] [{report_type}] Report generation started")

    last_error: str | None = None
    is_rate_limit = False

    try:
        data = call_groq_with_pool(
            messages=messages,
            max_tokens=4096,
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=120.0,
            context_label=report_type,
        )

        raw_text = data["choices"][0]["message"]["content"].strip()
        content_json = extract_json_from_text(raw_text)

        score = int(content_json.get("score", 50))
        score = max(0, min(100, score))

        content_markdown = json_to_markdown(report_type, content_json)
        logger.info(f"[Groq] [{report_type}] Successfully parsed (score: {score})")

        return ReportOutput(
            report_type=report_type,
            content_json=content_json,
            content_markdown=content_markdown,
            score=score,
        )

    except Exception as e:
        last_error = str(e)
        is_rate_limit = "exhausted" in last_error.lower() or "429" in last_error or "rate" in last_error.lower()
        logger.error(f"[Groq] [{report_type}] Failed: {last_error}")

        # Single retry after short wait if all keys were exhausted
        if is_rate_limit:
            wait = 15.0
            logger.info(f"[Groq] [{report_type}] All keys exhausted — waiting {wait}s then retrying once")
            time.sleep(wait)
            try:
                data = call_groq_with_pool(
                    messages=messages,
                    max_tokens=4096,
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    timeout=120.0,
                    context_label=f"{report_type}(retry)",
                )
                raw_text = data["choices"][0]["message"]["content"].strip()
                content_json = extract_json_from_text(raw_text)
                score = max(0, min(100, int(content_json.get("score", 50))))
                content_markdown = json_to_markdown(report_type, content_json)
                logger.info(f"[Groq] [{report_type}] Retry succeeded (score: {score})")
                return ReportOutput(
                    report_type=report_type,
                    content_json=content_json,
                    content_markdown=content_markdown,
                    score=score,
                )
            except Exception as e2:
                last_error = f"{last_error}; retry also failed: {e2}"

    from backend.services.llm_client import ReportOutput
    return ReportOutput(
        report_type=report_type,
        content_json={},
        content_markdown=f"*Report generation failed: {last_error}*",
        score=0,
        error=last_error,
        is_rate_limit_error=is_rate_limit,
    )


# -----------------------------------------------
# Simple text call — uses pool
# -----------------------------------------------

def call_groq_simple(
    prompt: str,
    system_prompt: str,
    max_tokens: int = 1024,
    context_label: str = "simple",
) -> str:
    """
    Make a simple (non-streaming, non-JSON) Groq call via the key pool.
    Used for changelog summaries, one-liners, etc.
    Returns the text content, or empty string on error.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]

    try:
        data = call_groq_with_pool(
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
            timeout=60.0,
            context_label=context_label,
        )
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"[Groq] [{context_label}] Simple call failed: {e}")
        return ""


# -----------------------------------------------
# Simplify text — uses pool
# -----------------------------------------------

def simplify_text_groq(text: str, system_prompt: str) -> str:
    """Simplify text using Groq's API via the key pool."""
    return call_groq_simple(text, system_prompt, max_tokens=1024, context_label="simplify")


# -----------------------------------------------
# Chat streaming — uses pool's best available key
# -----------------------------------------------

def stream_chat_groq(
    messages: list[dict],
    system_prompt: str,
) -> Generator[str, None, None]:
    """
    Stream a chat response using Groq's API with SSE.
    Selects the best available key from the pool for this call.

    Args:
        messages: List of {role, content} dicts (chat history + current message)
        system_prompt: System prompt framing Trixon's persona

    Yields:
        Text delta strings as they stream from the API
    """
    import hashlib
    from backend.core.key_pool_client import get_key_pool

    settings = get_settings()
    model = settings.groq_model or "openai/gpt-oss-120b"

    pool = get_key_pool()
    if pool is None:
        yield "[Error: No Groq API keys configured.]"
        return

    key = pool.get_best_key()
    kid = hashlib.sha256(key.encode()).hexdigest()[:8]

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    payload = {
        "model": model,
        "messages": full_messages,
        "temperature": 0.4,
        "max_tokens": 2048,
        "stream": True,
    }

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    logger.info(f"[Groq] [chat] Starting streaming response with key {kid} (model: {model})")

    try:
        with httpx.Client(timeout=120.0) as client:
            with client.stream("POST", GROQ_API_URL, json=payload, headers=headers) as response:
                # Record rate-limit headers even from streaming response
                pool.record_response(key, dict(response.headers))

                if response.status_code == 429:
                    retry_after = float(response.headers.get("retry-after", "62"))
                    pool.mark_exhausted(key, retry_after_seconds=retry_after)
                    yield "[BUSY] Rate limit reached. Please try again in a moment."
                    return

                response.raise_for_status()

                for line in response.iter_lines():
                    if not line or line == "data: [DONE]":
                        continue
                    if line.startswith("data: "):
                        try:
                            chunk = json.loads(line[6:])
                            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                yield delta
                        except Exception:
                            continue

    except Exception as e:
        logger.error(f"[Groq] [chat] Streaming error with key {kid}: {e}")
        yield f"\n\n[Error: {str(e)}]"


# -----------------------------------------------
# Legacy compat: get_remaining_tokens()
# -----------------------------------------------

def get_remaining_tokens() -> int:
    """
    Legacy function — returns the estimated remaining tokens for the BEST available key.
    Kept so existing callers don't break. With the pool, this now returns the best key's
    remaining tokens rather than a single-key global.
    """
    from backend.core.key_pool_client import get_key_pool
    pool = get_key_pool()
    if pool is None:
        return 7000

    import hashlib
    import time
    best_remaining = 0
    for key in pool.api_keys:
        kid = hashlib.sha256(key.encode()).hexdigest()[:8]
        try:
            cooldown = pool.redis.get(f"groq_key_pool:{kid}:cooldown")
            if cooldown and float(cooldown) > time.time():
                continue
            rem = pool.redis.get(f"groq_key_pool:{kid}:remaining")
            if rem is not None:
                best_remaining = max(best_remaining, int(rem))
        except Exception:
            pass
    return best_remaining if best_remaining > 0 else 7000
