# Trixon — Antigravity Changes Prompt: Multi-Key Groq Pool
### Parallel Report Generation Using Multiple Independent Groq Accounts

---

## CONTEXT & GOAL

Currently, all LLM calls (report generation, chat, changelog summaries, action item prompts) go through a single Groq API key with a 7,000 TPM budget, forcing reports to generate sequentially with ~60s sleeps between calls to avoid hitting the limit.

By configuring 3-4 Groq API keys from **separate Groq accounts** (each with its own independent 7,000 TPM budget), we get two benefits:
1. **Aggregate capacity** — effectively ~21,000-28,000 TPM across the pool instead of 7,000
2. **Real concurrency** — multiple reports can generate at the same time, each using a different key, instead of waiting in a sequential queue

The system must work correctly with just 1 key (today's setup, no regression) and scale automatically as more keys are added — no code changes needed to add a 5th key later, just an env var update.

---

## CHANGES

### 1. Config — Multiple Keys

#### [MODIFY] `.env` / `config.py`

```bash
# Comma-separated list of Groq API keys, each from a separate Groq account
GROQ_API_KEYS=key1,key2,key3,key4
```

```python
groq_api_keys: list[str] = []  # parsed from comma-separated GROQ_API_KEYS at startup

@field_validator("groq_api_keys", mode="before")
def parse_keys(cls, v):
    if isinstance(v, str):
        return [k.strip() for k in v.split(",") if k.strip()]
    return v
```

Keep backward compatibility: if only `GROQ_API_KEY` (singular, existing) is set and `GROQ_API_KEYS` is absent, treat it as a pool of 1.

---

### 2. Redis-Backed Key Pool Service

#### [NEW] `backend/services/key_pool.py`

Each key's rate-limit state is tracked in Redis (not in-memory) so it's consistent across RQ worker processes. Never log raw API keys — use a short hash for identification in logs.

```python
import hashlib
import time
import redis

KEY_POOL_PREFIX = "groq_key_pool"
DEFAULT_TPM_BUDGET = 7000

def _key_id(api_key: str) -> str:
    """Short, non-reversible identifier for logging — never log the real key."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:8]


class GroqKeyPool:
    def __init__(self, api_keys: list[str], redis_client: redis.Redis):
        self.api_keys = api_keys
        self.redis = redis_client
        if not api_keys:
            raise ValueError("GroqKeyPool requires at least one API key")

    def get_best_key(self) -> str:
        """
        Returns the key with the most remaining token headroom.
        Falls back to round-robin if no usage data exists yet for any key.
        Skips keys currently marked as cooling down (rate-limited).
        """
        now = time.time()
        candidates = []

        for key in self.api_keys:
            kid = _key_id(key)
            cooldown_until = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:cooldown")
            if cooldown_until and float(cooldown_until) > now:
                continue  # still cooling down from a 429

            remaining = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:remaining")
            remaining = int(remaining) if remaining else DEFAULT_TPM_BUDGET  # assume full if unknown
            candidates.append((remaining, key))

        if not candidates:
            # All keys are cooling down — return the one with the soonest cooldown expiry
            soonest = min(
                self.api_keys,
                key=lambda k: float(self.redis.get(f"{KEY_POOL_PREFIX}:{_key_id(k)}:cooldown") or 0)
            )
            return soonest

        # Pick the key with the most headroom
        candidates.sort(reverse=True)
        return candidates[0][1]

    def record_response(self, api_key: str, headers: dict) -> None:
        """
        Parse rate-limit headers from the Groq API response and update Redis.
        Groq uses OpenAI-compatible headers: x-ratelimit-remaining-tokens,
        x-ratelimit-reset-tokens. Defensive parsing — don't crash if headers
        are missing or in an unexpected format.
        """
        kid = _key_id(api_key)
        remaining = headers.get("x-ratelimit-remaining-tokens")
        if remaining is not None:
            try:
                self.redis.set(f"{KEY_POOL_PREFIX}:{kid}:remaining", int(remaining), ex=120)
            except (ValueError, TypeError):
                pass

    def mark_exhausted(self, api_key: str, retry_after_seconds: float = 60) -> None:
        """Called on a 429 — marks this key unavailable until cooldown expires."""
        kid = _key_id(api_key)
        cooldown_until = time.time() + retry_after_seconds
        self.redis.set(f"{KEY_POOL_PREFIX}:{kid}:cooldown", cooldown_until, ex=int(retry_after_seconds) + 10)
        self.redis.set(f"{KEY_POOL_PREFIX}:{kid}:remaining", 0, ex=int(retry_after_seconds) + 10)

    def status(self) -> list[dict]:
        """For the admin monitoring endpoint — per-key utilization snapshot."""
        now = time.time()
        result = []
        for key in self.api_keys:
            kid = _key_id(key)
            remaining = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:remaining")
            cooldown = self.redis.get(f"{KEY_POOL_PREFIX}:{kid}:cooldown")
            result.append({
                "key_id": kid,
                "remaining_tokens": int(remaining) if remaining else None,
                "cooling_down": bool(cooldown and float(cooldown) > now),
            })
        return result
```

Instantiate as a singleton (similar pattern to existing `redis_client.py`), e.g. in `core/key_pool_client.py`:

```python
_pool_instance = None

def get_key_pool() -> GroqKeyPool:
    global _pool_instance
    if _pool_instance is None:
        _pool_instance = GroqKeyPool(settings.groq_api_keys, get_redis())
    return _pool_instance
```

---

### 3. Provider Call Wrapper — Automatic Retry Across Keys

#### [MODIFY] `groq.py` (or `openai_compatible.py`, whichever currently makes the actual HTTP call)

Wrap every LLM call with key selection + automatic failover:

```python
def call_groq_with_pool(messages: list[dict], system: str | None = None, **kwargs) -> dict:
    """
    Replaces direct API calls. Picks the best available key, makes the request,
    and on a 429, automatically retries with the next available key — up to
    len(api_keys) attempts before giving up.
    """
    pool = get_key_pool()
    attempted_keys = set()
    last_error = None

    for _ in range(len(pool.api_keys)):
        key = pool.get_best_key()
        if key in attempted_keys:
            continue
        attempted_keys.add(key)

        try:
            response = _make_groq_request(api_key=key, messages=messages, system=system, **kwargs)
            pool.record_response(key, response.headers)
            return response.json()

        except RateLimitError as e:
            retry_after = getattr(e, "retry_after", 60)
            pool.mark_exhausted(key, retry_after_seconds=retry_after)
            last_error = e
            continue  # try the next key

    raise Exception(f"All {len(pool.api_keys)} keys exhausted. Last error: {last_error}")
```

Confirm the exact rate-limit header names Groq returns by inspecting a real response (`x-ratelimit-remaining-tokens` is the OpenAI-compatible standard, but verify against actual Groq API responses before relying on it — log a warning once if the expected headers are absent, rather than failing silently).

---

### 4. Concurrent Report Generation in the Worker

#### [MODIFY] `analyze.py`

Replace the sequential `for report_type in selected: generate(); sleep()` loop with concurrent execution, capped at the pool size:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def generate_all_reports(analysis_id: str, project_id: str, selected_reports: list[str], layers: dict):
    pool = get_key_pool()
    max_workers = min(len(selected_reports), len(pool.api_keys))

    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(generate_single_report, report_type, analysis_id, project_id, layers): report_type
            for report_type in selected_reports
        }
        for future in as_completed(futures):
            report_type = futures[future]
            try:
                results[report_type] = future.result()
            except Exception as e:
                logger.error(f"Failed to generate {report_type} for analysis {analysis_id}: {e}")
                results[report_type] = None

    # IMPORTANT: this is a join point — only proceed to diff/score recomputation
    # after ALL concurrent report generations have completed (success or failure)
    return results
```

After `generate_all_reports()` returns (all threads joined), proceed with the existing steps in order: action item extraction (per successfully generated report), score recomputation (Fix from the previous prompt — average only the 4 category-mapped scores), and diff computation. These steps should NOT run inside the thread pool — they run once, after the join, against the complete set of results.

**Remove the old adaptive `time.sleep()` logic between report calls** — with the key pool's automatic failover, sleeping is no longer the primary defense against rate limits. Keep one lightweight safety net: if `call_groq_with_pool()` raises "all keys exhausted," catch it at the `generate_single_report` level and retry once after a short delay (10-15s) rather than failing the whole report immediately.

---

### 5. Apply the Pool to Chat and Other LLM Calls Too

Confirm `chat.py`'s streaming call, the changelog summary generation in `diff_engine.py`, and the `ai_prompt` generation in `action_extractor.py` all route through `call_groq_with_pool()` — not just the main report generation. All LLM usage in the app should benefit from the expanded pool, not only analysis.

---

### 6. Admin Monitoring Endpoint

#### [NEW] route in an existing admin router or `key_pool.py` API file

```
GET /api/v1/admin/key-pool-status
— Returns pool.status(): per-key remaining tokens and cooldown state,
  identified only by the short hash (key_id), never the raw key.
  Useful for spotting an unevenly-loaded pool (e.g. one account
  getting exhausted far more than the others).
```

---

### 7. Graceful Single-Key Fallback

If `GROQ_API_KEYS` has only 1 entry (or just `GROQ_API_KEY` is set), the system must behave correctly — `max_workers` will naturally compute to 1, so reports generate one at a time through the same code path, no special-casing needed. Confirm this explicitly works without errors as part of testing, since it's likely how local development will run day-to-day even after this feature ships.

---

## SUCCESS CRITERIA

- [ ] With 1 key configured, behavior matches today (sequential, correct, no crashes) — this is the regression check
- [ ] With 3-4 keys configured, a 3-report analysis completes in well under a minute instead of ~3 minutes (verify via timestamps in logs)
- [ ] A simulated 429 on one key automatically retries on another key without failing the overall analysis (test by temporarily using an invalid/over-limit key as one of the pool entries)
- [ ] Raw API keys never appear in logs — only the short hashed `key_id`
- [ ] `GET /api/v1/admin/key-pool-status` shows accurate per-key state during and after a concurrent analysis run
- [ ] Chat, changelog summaries, and action item prompt generation all route through the pool (spot check by triggering each and watching `key-pool-status` change)
- [ ] Diff computation and score recomputation only run after ALL concurrent report generations have completed (no race condition where diff runs against a partially-complete report set)
