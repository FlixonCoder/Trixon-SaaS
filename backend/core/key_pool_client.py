"""
Trixon Backend — Groq Key Pool Singleton

Provides a process-wide singleton instance of InProcessKeyPool.
Initialized eagerly at startup in main.py.
"""

import logging

from backend.services.key_pool import InProcessKeyPool

logger = logging.getLogger(__name__)

key_pool: InProcessKeyPool | None = None


def init_key_pool(api_keys: list[str]) -> None:
    """Initialize the global key pool instance."""
    global key_pool
    if not api_keys:
        logger.warning(
            "[KeyPool] No Groq API keys configured. LLM calls will fail."
        )
        # Create a stub pool anyway so it doesn't crash on get_key_pool
        # (it will fail cleanly later when the provider tries to use an empty key)
        key_pool = InProcessKeyPool(["dummy_key_to_prevent_crash"])
        return
        
    key_pool = InProcessKeyPool(api_keys)


def get_key_pool() -> InProcessKeyPool:
    """
    Returns the InProcessKeyPool singleton.
    Raises RuntimeError if accessed before initialization.
    """
    global key_pool

    if key_pool is None:
        raise RuntimeError("Key pool not initialized — call init_key_pool() at startup")
    
    return key_pool


def reset_key_pool() -> None:
    """Force re-initialization of the pool singleton (e.g., after config change in tests)."""
    global key_pool
    key_pool = None
