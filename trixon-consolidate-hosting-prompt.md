# Trixon — Antigravity Changes Prompt: Consolidate to Single Backend Service for Free Hosting

---

## CONTEXT & GOAL

Collapse 4 local dev processes (`uvicorn`, `npm run dev`, `docker-compose redis`, `python -m backend.worker`) down to 2 deployable services: the Next.js frontend (Vercel) and a single FastAPI backend (Render free tier) that handles both API requests and background analysis processing in-process — no separate worker, no Redis.

This is a deliberate trade-off appropriate for beta scale (job durability and blast-radius isolation decrease slightly; both are acceptable risks given reports/scores write progressively to Supabase). Revisit this decision once there's real paying-customer traffic or hosting budget.

---

## CHANGES

### 1. Replace RQ Job Dispatch with FastAPI BackgroundTasks

#### [MODIFY] API routes that currently enqueue jobs (`projects.py`, `webhooks.py`, `action_items.py`/`reports/add` endpoint)

Replace every place that does something like `queue.enqueue(analyze_project, ...)` or `.delay(...)` with FastAPI's `BackgroundTasks`:

```python
from fastapi import BackgroundTasks

@router.post("/projects/{project_id}/analyze")
async def trigger_analysis(
    project_id: str,
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
):
    # Create the analysis row synchronously so status="queued" is visible immediately
    analysis_id = create_analysis_row(project_id, status="queued", ...)

    background_tasks.add_task(
        run_analysis_job,
        project_id=project_id,
        analysis_id=analysis_id,
        commit_sha=body.commit_sha,
        commit_message=body.commit_message,
        commit_author=body.commit_author,
        trigger_source=body.trigger_source or "manual",
        selected_reports=body.selected_reports,
    )

    return {"analysis_id": analysis_id, "status": "queued"}
```

Apply the same pattern to the webhook handler (`POST /api/v1/webhooks/github`) and the targeted `/reports/add` endpoint — both currently enqueue RQ jobs and should switch to `background_tasks.add_task(...)`.

`run_analysis_job` is the renamed/refactored former RQ job function (previously `analyze_project` invoked via `.delay()`/`.enqueue()`) — same internal logic, just called as a plain function instead of going through a queue.

---

### 2. Move Key Pool from Redis to In-Process Thread-Safe State

#### [MODIFY] `backend/services/key_pool.py`

Replace the Redis-backed implementation with a `threading.Lock`-guarded in-memory version. This is simpler AND more reliable in a single-process deployment — no network round-trip, true atomicity guaranteed by the lock:

```python
import threading
import time
import hashlib

def _key_id(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()[:8]


class InProcessKeyPool:
    def __init__(self, api_keys: list[str]):
        if not api_keys:
            raise ValueError("InProcessKeyPool requires at least one API key")
        self.api_keys = api_keys
        self._lock = threading.Lock()
        self._counter = 0
        self._cooldowns: dict[str, float] = {}  # key_id -> cooldown_until timestamp

    def get_best_key(self) -> str:
        with self._lock:
            now = time.time()
            num_keys = len(self.api_keys)
            for offset in range(num_keys):
                idx = (self._counter + offset) % num_keys
                key = self.api_keys[idx]
                kid = _key_id(key)
                if self._cooldowns.get(kid, 0) <= now:
                    self._counter += 1
                    return key
            # All keys cooling down — return whichever clears soonest
            self._counter += 1
            return min(self.api_keys, key=lambda k: self._cooldowns.get(_key_id(k), 0))

    def mark_exhausted(self, api_key: str, retry_after_seconds: float = 60) -> None:
        with self._lock:
            kid = _key_id(api_key)
            self._cooldowns[kid] = time.time() + retry_after_seconds

    def record_response(self, api_key: str, headers: dict) -> None:
        # No-op for now — round-robin + cooldown is sufficient without remaining-token tracking.
        # Kept as a method stub in case header-based tracking is reintroduced later.
        pass

    def status(self) -> list[dict]:
        with self._lock:
            now = time.time()
            return [
                {"key_id": _key_id(k), "cooling_down": self._cooldowns.get(_key_id(k), 0) > now}
                for k in self.api_keys
            ]
```

#### [MODIFY] singleton instantiation — create once at app startup, not lazily

```python
# backend/core/key_pool_client.py
key_pool: InProcessKeyPool | None = None

def init_key_pool(api_keys: list[str]) -> None:
    global key_pool
    key_pool = InProcessKeyPool(api_keys)

def get_key_pool() -> InProcessKeyPool:
    if key_pool is None:
        raise RuntimeError("Key pool not initialized — call init_key_pool() at startup")
    return key_pool
```

In `main.py`'s lifespan/startup handler, call `init_key_pool(settings.groq_api_keys)` once. This removes the lazy-singleton race condition pattern entirely (no `if _pool_instance is None` check needed, since it's created deterministically before any request can arrive).

---

### 3. Remove Redis and RQ Dependencies

#### [MODIFY] `requirements.txt`
Remove `redis` and `rq` packages (unless something else in the codebase still needs Redis directly — confirm nothing else depends on it before removing).

#### [DELETE or clearly deprecate] `backend/worker.py`
This file is no longer run as a separate process. Either delete it, or leave it with a comment at the top: `# DEPRECATED — analysis jobs now run via FastAPI BackgroundTasks in main.py. This file is not used.`

#### [MODIFY] `backend/core/redis_client.py`
Remove or deprecate — no longer needed for RQ queue setup or key pool state.

#### [MODIFY] `.env.example` / `config.py`
Remove `REDIS_URL` and any RQ-specific settings.

#### [MODIFY] local dev instructions / README
Update to reflect the new 2-process local dev setup: `uvicorn backend.main:app --reload` and `npm run dev`. Remove references to `docker-compose up redis` and `python -m backend.worker`.

---

### 4. Confirm No Reliance on Persistent Local Disk

Render's free tier disk is ephemeral — anything written to local disk is lost on restart/spin-down. Confirm the repo-fetching step in `static_extractor.py` / wherever repo content is fetched uses the GitHub/GitLab API directly (fetching file contents over HTTP) rather than a literal `git clone` to a persistent local directory. If it does use a local temp directory mid-job, confirm it's cleaned up within that same job's execution and never assumed to persist across separate requests or restarts — this should already be the case, just verify.

---

### 5. Render Deployment Config

#### [NEW] `render.yaml` (repo root)

```yaml
services:
  - type: web
    name: trixon-backend
    runtime: python
    plan: free
    buildCommand: "pip install -r backend/requirements.txt"
    startCommand: "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
    healthCheckPath: /health
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: GROQ_API_KEYS
        sync: false
      - key: GITHUB_CLIENT_ID
        sync: false
      - key: GITHUB_CLIENT_SECRET
        sync: false
      - key: GITHUB_WEBHOOK_SECRET
        sync: false
      - key: GITLAB_CLIENT_ID
        sync: false
      - key: GITLAB_CLIENT_SECRET
        sync: false
      - key: ENCRYPTION_KEY
        sync: false
      - key: BETA_MODE
        value: "true"
      - key: CORS_ALLOWED_ORIGINS
        sync: false  # set to the deployed Vercel frontend URL after first deploy
```

`sync: false` means Render will prompt you to enter each value securely in the dashboard rather than committing secrets into the repo.

#### CORS update

#### [MODIFY] `main.py` — CORS middleware

Confirm allowed origins are read from an env var (`CORS_ALLOWED_ORIGINS`), not hardcoded to `localhost:3000`:

```python
import os

allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

After the Render backend is deployed, set `CORS_ALLOWED_ORIGINS` to the actual Vercel frontend URL (and update it again if/when a custom domain is added).

#### Frontend env var update

On Vercel, set `NEXT_PUBLIC_API_URL` to the deployed Render backend URL (e.g. `https://trixon-backend.onrender.com`) once the backend is live.

---

## KNOWN LIMITATION TO COMMUNICATE (not a code fix — just awareness)

Render's free web service spins down after 15 minutes with zero inbound traffic. The existing 3-second polling UI during an active analysis counts as inbound traffic, so manually-triggered analyses are safe from being killed mid-job. Webhook-triggered (auto-tracking) analyses have no such guarantee — if nobody is actively viewing the dashboard when a push-triggered analysis runs, and it takes several minutes with no other inbound requests, the service could spin down mid-job. This is acceptable as a "best effort" limitation during free-tier beta; revisit if auto-tracking reliability becomes a priority before upgrading to a paid always-on tier.

---

## SUCCESS CRITERIA

- [ ] Local dev only requires 2 commands: `uvicorn backend.main:app --reload` and `npm run dev` — no Redis, no separate worker process
- [ ] Triggering an analysis via the API returns immediately with `status: "queued"`, and the analysis completes correctly via `BackgroundTasks` without a separate worker process running
- [ ] Key pool round-robin and cooldown behavior work correctly under concurrent `ThreadPoolExecutor` report generation, verified via logs (each concurrent report's first attempt should use a different key, matching the fix from the previous round)
- [ ] `requirements.txt` no longer includes `redis` or `rq`
- [ ] `render.yaml` deploys successfully to a new Render free web service
- [ ] `/health` endpoint responds correctly once deployed, confirming Supabase connectivity (no Redis check needed anymore — remove that part of the health check if it still references Redis)
- [ ] CORS correctly allows requests from the deployed Vercel frontend URL
- [ ] A manually-triggered analysis on the deployed instance completes successfully end-to-end (connect repo → analyze → view reports → action items populated)
