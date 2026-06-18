"""
Trixon Backend — Groq Key Pool Singleton

Provides a process-wide singleton instance of GroqKeyPool.
Used by the Groq provider and any LLM call sites.
Redis state is shared across all worker processes.
"""

import logging

from backend.core.config import get_settings
from backend.core.redis_client import get_redis
from backend.services.key_pool import GroqKeyPool

logger = logging.getLogger(__name__)

_pool_instance: GroqKeyPool | None = None


def get_key_pool() -> GroqKeyPool | None:
    """
    Returns the GroqKeyPool singleton.
    Returns None if:
      - No Groq API keys are configured
      - Redis is unavailable (pool state cannot be tracked)
    """
    global _pool_instance

    if _pool_instance is not None:
        return _pool_instance

    settings = get_settings()
    api_keys = settings.effective_groq_api_keys

    if not api_keys:
        logger.warning(
            "[KeyPool] No Groq API keys configured (GROQ_API_KEYS or GROQ_API_KEY). "
            "LLM calls will fail."
        )
        return None

    redis_client = get_redis()
    if redis_client is None:
        logger.warning(
            "[KeyPool] Redis not available — key pool cannot track rate-limit state. "
            "Falling back to single-key mode without pool tracking."
        )
        # Create a pool anyway with a no-op fake redis client so the code path doesn't change
        _pool_instance = _make_pool_with_noop_redis(api_keys)
        return _pool_instance

    try:
        _pool_instance = GroqKeyPool(api_keys=api_keys, redis_client=redis_client)
        return _pool_instance
    except ValueError as e:
        logger.error(f"[KeyPool] Failed to initialize: {e}")
        return None


def reset_key_pool() -> None:
    """Force re-initialization of the pool singleton (e.g., after config change in tests)."""
    global _pool_instance
    _pool_instance = None


def _make_pool_with_noop_redis(api_keys: list[str]) -> GroqKeyPool:
    """
    Creates a GroqKeyPool with a minimal no-op Redis stub so the pool interface works
    even without Redis. State won't persist between calls, but won't crash either.
    """
    class _NoopRedis:
        def get(self, key):
            return None
        def set(self, key, value, ex=None):
            pass

    return GroqKeyPool(api_keys=api_keys, redis_client=_NoopRedis())
