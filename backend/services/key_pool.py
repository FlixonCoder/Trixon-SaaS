"""
Trixon Backend — Groq Key Pool Service

In-memory pool manager for multiple Groq API keys.
Guarded by threading.Lock() for atomic round-robin selection and cooldowns
within a single FastAPI process.

SECURITY: Raw API keys are NEVER logged. Only a short SHA-256 hash (key_id)
is used in logs for identification.
"""

import hashlib
import logging
import threading
import time

logger = logging.getLogger(__name__)


def _key_id(api_key: str) -> str:
    """Short, non-reversible identifier for logging — never log the real key."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:8]


class InProcessKeyPool:
    """
    Manages a pool of Groq API keys, selecting the best available key for each
    request using a round-robin approach that skips keys currently cooling down.
    """

    def __init__(self, api_keys: list[str]):
        if not api_keys:
            raise ValueError("InProcessKeyPool requires at least one API key")
        self.api_keys = api_keys
        self._lock = threading.Lock()
        self._counter = 0
        self._cooldowns: dict[str, float] = {}  # key_id -> cooldown_until timestamp

        logger.info(
            f"[KeyPool] Initialized with {len(api_keys)} key(s): "
            f"{[_key_id(k) for k in api_keys]}"
        )

    def get_best_key(self) -> str:
        """
        Atomic round-robin selection.
        Skips keys currently in cooldown. Falls back to soonest-available if all
        keys are cooling down.
        """
        with self._lock:
            now = time.time()
            num_keys = len(self.api_keys)

            for offset in range(num_keys):
                idx = (self._counter + offset) % num_keys
                key = self.api_keys[idx]
                kid = _key_id(key)

                if self._cooldowns.get(kid, 0) <= now:
                    self._counter += 1
                    logger.debug(f"[KeyPool] Selected key {kid} via round-robin index {idx}")
                    return key

            # All keys cooling down — return whichever clears soonest
            self._counter += 1
            logger.warning("[KeyPool] All keys are cooling down — returning soonest-available key")
            return min(self.api_keys, key=lambda k: self._cooldowns.get(_key_id(k), 0))

    def mark_exhausted(self, api_key: str, retry_after_seconds: float = 62.0) -> None:
        """
        Called on a 429 — marks this key unavailable until the cooldown expires.
        """
        with self._lock:
            kid = _key_id(api_key)
            self._cooldowns[kid] = time.time() + retry_after_seconds
            logger.warning(
                f"[KeyPool] Key {kid} marked exhausted for {retry_after_seconds:.0f}s "
                f"(cooldown until +{retry_after_seconds:.0f}s from now)"
            )

    def record_response(self, api_key: str, headers: dict) -> None:
        """
        Kept as a method stub for backward compatibility with the LLM client.
        Round-robin + cooldown is sufficient without remaining-token tracking.
        """
        pass

    def status(self) -> list[dict]:
        """
        For the admin monitoring endpoint.
        Returns per-key utilization snapshot — identified only by key_id.
        """
        with self._lock:
            now = time.time()
            result = []
            for key in self.api_keys:
                kid = _key_id(key)
                cooldown_until = self._cooldowns.get(kid, 0)
                is_cooling = cooldown_until > now
                cooldown_remaining_s = max(0.0, cooldown_until - now) if is_cooling else None

                result.append({
                    "key_id": kid,
                    "remaining_tokens": None,  # Not tracked in in-memory version
                    "cooling_down": is_cooling,
                    "cooldown_remaining_seconds": round(cooldown_remaining_s, 1) if cooldown_remaining_s else None,
                })
            return result

    def __len__(self) -> int:
        return len(self.api_keys)
