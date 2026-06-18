"""
Trixon Backend — Groq Key Pool Service

Redis-backed pool manager for multiple Groq API keys.
Each key's rate-limit state is stored in Redis (not in-memory) so it's
consistent across multiple RQ worker processes.

SECURITY: Raw API keys are NEVER logged. Only a short SHA-256 hash (key_id)
is used in logs for identification.
"""

import hashlib
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

KEY_POOL_PREFIX = "groq_key_pool"
DEFAULT_TPM_BUDGET = 7000


def _key_id(api_key: str) -> str:
    """Short, non-reversible identifier for logging — never log the real key."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:8]


class GroqKeyPool:
    """
    Manages a pool of Groq API keys, selecting the best available key for each
    request based on remaining token headroom tracked in Redis.

    Usage:
        key = pool.get_best_key()
        # ... make API call using `key` ...
        pool.record_response(key, response.headers)
        # on 429:
        pool.mark_exhausted(key, retry_after_seconds=60)
    """

    def __init__(self, api_keys: list[str], redis_client):
        if not api_keys:
            raise ValueError("GroqKeyPool requires at least one API key")
        self.api_keys = api_keys
        self.redis = redis_client
        logger.info(
            f"[KeyPool] Initialized with {len(api_keys)} key(s): "
            f"{[_key_id(k) for k in api_keys]}"
        )

    def get_best_key(self) -> str:
        """
        Atomic round-robin selection using Redis INCR, which guarantees concurrent
        callers get DIFFERENT starting indices (Redis INCR is atomic — no race).
        Skips keys currently in cooldown. Falls back to soonest-available if all
        keys are cooling down.
        """
        ROUND_ROBIN_COUNTER_KEY = f"{KEY_POOL_PREFIX}:rr_counter"
        now = time.time()
        
        try:
            counter = self.redis.incr(ROUND_ROBIN_COUNTER_KEY)
        except Exception as e:
            logger.warning(f"[KeyPool] Redis INCR failed: {e}. Falling back to 0.")
            counter = 0

        num_keys = len(self.api_keys)

        for offset in range(num_keys):
            idx = (counter + offset) % num_keys
            key = self.api_keys[idx]
            kid = _key_id(key)
            try:
                cooldown_until = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:cooldown")
                if not cooldown_until or float(cooldown_until) <= now:
                    logger.debug(f"[KeyPool] Selected key {kid} via round-robin index {idx}")
                    return key  # this key is available — use it
            except Exception as e:
                logger.warning(f"[KeyPool] Redis cooldown check failed for {kid}: {e}")
                return key # use it if Redis is down

        # All keys are cooling down — return whichever expires soonest
        logger.warning("[KeyPool] All keys are cooling down — returning soonest-available key")
        try:
            return min(
                self.api_keys,
                key=lambda k: float(self.redis.get(f"{KEY_POOL_PREFIX}:{_key_id(k)}:cooldown") or 0)
            )
        except Exception:
            return self.api_keys[0]  # Last resort

    def record_response(self, api_key: str, headers: dict) -> None:
        """
        Parse rate-limit headers from the Groq API response and update Redis.
        Groq uses OpenAI-compatible headers:
          - x-ratelimit-remaining-tokens
          - x-ratelimit-reset-tokens
        Defensive parsing — does not crash if headers are missing.
        """
        kid = _key_id(api_key)
        remaining = headers.get("x-ratelimit-remaining-tokens")

        if remaining is None:
            # Log a one-time warning so we notice if Groq changes their header format
            logger.debug(
                f"[KeyPool] Key {kid}: x-ratelimit-remaining-tokens header absent "
                f"— pool will use default budget estimate"
            )
            return

        try:
            remaining_int = int(remaining)
            self.redis.set(
                f"{KEY_POOL_PREFIX}:{kid}:remaining",
                remaining_int,
                ex=120,  # TTL: 2 minutes — refresh after window expires
            )
            logger.debug(f"[KeyPool] Key {kid}: recorded {remaining_int} tokens remaining")
        except (ValueError, TypeError) as e:
            logger.warning(f"[KeyPool] Key {kid}: could not parse remaining tokens header '{remaining}': {e}")
        except Exception as e:
            logger.warning(f"[KeyPool] Redis error recording response for key {kid}: {e}")

    def mark_exhausted(self, api_key: str, retry_after_seconds: float = 62.0) -> None:
        """
        Called on a 429 — marks this key unavailable until the cooldown expires.
        Also zeros out its remaining-token count so it won't be selected.
        """
        kid = _key_id(api_key)
        cooldown_until = time.time() + retry_after_seconds
        ttl = int(retry_after_seconds) + 10
        try:
            self.redis.set(f"{KEY_POOL_PREFIX}:{kid}:cooldown", cooldown_until, ex=ttl)
            self.redis.set(f"{KEY_POOL_PREFIX}:{kid}:remaining", 0, ex=ttl)
            logger.warning(
                f"[KeyPool] Key {kid} marked exhausted for {retry_after_seconds:.0f}s "
                f"(cooldown until +{retry_after_seconds:.0f}s from now)"
            )
        except Exception as e:
            logger.error(f"[KeyPool] Redis error marking key {kid} exhausted: {e}")

    def status(self) -> list[dict]:
        """
        For the admin monitoring endpoint.
        Returns per-key utilization snapshot — identified only by key_id, never raw key.
        """
        now = time.time()
        result = []
        for key in self.api_keys:
            kid = _key_id(key)
            try:
                remaining_raw = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:remaining")
                cooldown_raw = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:cooldown")
                is_cooling = bool(cooldown_raw and float(cooldown_raw) > now)
                cooldown_remaining_s = (
                    max(0.0, float(cooldown_raw) - now) if cooldown_raw else None
                )
                result.append({
                    "key_id": kid,
                    "remaining_tokens": int(remaining_raw) if remaining_raw is not None else None,
                    "cooling_down": is_cooling,
                    "cooldown_remaining_seconds": (
                        round(cooldown_remaining_s, 1) if cooldown_remaining_s is not None and is_cooling else None
                    ),
                })
            except Exception as e:
                result.append({
                    "key_id": kid,
                    "remaining_tokens": None,
                    "cooling_down": False,
                    "cooldown_remaining_seconds": None,
                    "error": str(e),
                })
        return result

    def __len__(self) -> int:
        return len(self.api_keys)
