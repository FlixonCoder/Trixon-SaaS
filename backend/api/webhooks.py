"""
Trixon Backend — Webhook Routes (v3.0)

Routes:
  POST /api/v1/projects/{id}/webhook/enable   — Register push webhook with GitHub/GitLab
  POST /api/v1/projects/{id}/webhook/disable  — Remove webhook from GitHub/GitLab + DB
  POST /api/v1/webhooks/github                — Receive GitHub push events
  POST /api/v1/webhooks/gitlab                — Receive GitLab push events
"""

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.config import get_settings
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["webhooks"])


class WebhookEnableRequest(BaseModel):
    platform: str = "github"  # 'github' | 'gitlab'
    webhook_url: str | None = None  # Override the default Trixon webhook URL


class WebhookDisableResponse(BaseModel):
    success: bool
    message: str


# -----------------------------------------------
# Enable webhook for a project
# -----------------------------------------------

@router.post("/projects/{project_id}/webhook/enable")
async def enable_webhook(
    project_id: str,
    body: WebhookEnableRequest,
    user: CurrentUser,
):
    """Register a push webhook with GitHub/GitLab and store the connection."""
    user_id = user["id"]
    supabase = get_supabase()
    settings = get_settings()

    # Verify project belongs to user
    project_resp = (
        supabase.table("projects")
        .select("*, vcs_connections(platform, access_token)")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_resp.data
    vcs = project.get("vcs_connections") or {}
    repo_name = project.get("repo_name", "")
    platform = body.platform or project.get("platform", vcs.get("platform", "github"))

    # Check if already enabled
    existing = (
        supabase.table("webhook_connections")
        .select("id,is_active")
        .eq("project_id", project_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        return {
            "status": "already_active",
            "message": "Webhook is already enabled for this project",
            "webhook_connection_id": existing.data["id"],
        }

    # Generate a signing secret
    webhook_secret = secrets.token_hex(32)

    # Determine the Trixon webhook receiver URL
    base_url = body.webhook_url or getattr(settings, "backend_url", None) or getattr(settings, "app_url", None) or "https://api.trixon.cloud"
    if platform == "github":
        receiver_url = f"{base_url}/api/v1/webhooks/github"
    else:
        receiver_url = f"{base_url}/api/v1/webhooks/gitlab"

    webhook_id = None

    if platform == "github":
        webhook_id = await _register_github_webhook(
            repo_name=repo_name,
            access_token=vcs.get("access_token", ""),
            webhook_url=receiver_url,
            secret=webhook_secret,
        )
    elif platform == "gitlab":
        from backend.core.encryption import decrypt_token
        token = decrypt_token(vcs.get("access_token", ""))
        webhook_id = await _register_gitlab_webhook(
            project_id_gl=vcs.get("repo_id") or project.get("repo_id"),
            access_token=token,
            webhook_url=receiver_url,
            secret=webhook_secret,
        )

    # Store the connection
    record = {
        "project_id": project_id,
        "platform": platform,
        "webhook_id": str(webhook_id) if webhook_id else None,
        "webhook_secret": webhook_secret,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = supabase.table("webhook_connections").insert(record).execute()
    created = result.data[0] if result.data else record

    logger.info(f"Webhook enabled for project {project_id} on {platform} (id: {webhook_id})")

    return {
        "status": "enabled",
        "webhook_connection_id": created.get("id"),
        "platform": platform,
        "receiver_url": receiver_url,
    }


# -----------------------------------------------
# Disable webhook for a project
# -----------------------------------------------

@router.post("/projects/{project_id}/webhook/disable")
async def disable_webhook(
    project_id: str,
    user: CurrentUser,
) -> WebhookDisableResponse:
    """Remove webhook from GitHub/GitLab and mark as inactive in DB."""
    user_id = user["id"]
    supabase = get_supabase()

    # Verify project ownership
    project_resp = (
        supabase.table("projects")
        .select("repo_name, platform, vcs_connections(access_token)")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find active webhook
    webhook_resp = (
        supabase.table("webhook_connections")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not webhook_resp or not webhook_resp.data:
        return WebhookDisableResponse(success=False, message="No active webhook found")

    webhook = webhook_resp.data
    project = project_resp.data

    # Try to delete from GitHub/GitLab
    try:
        if webhook["platform"] == "github" and webhook.get("webhook_id"):
            vcs = project.get("vcs_connections") or {}
            from backend.core.encryption import decrypt_token
            token = decrypt_token(vcs.get("access_token", ""))
            await _delete_github_webhook(
                repo_name=project.get("repo_name", ""),
                access_token=token,
                webhook_id=webhook["webhook_id"],
            )
    except Exception as e:
        logger.warning(f"Failed to delete remote webhook: {e}")  # Non-fatal

    # Mark as inactive in DB
    supabase.table("webhook_connections").update({
        "is_active": False,
    }).eq("id", webhook["id"]).execute()

    logger.info(f"Webhook disabled for project {project_id}")
    return WebhookDisableResponse(success=True, message="Webhook disabled successfully")


# -----------------------------------------------
# Receive GitHub push events
# -----------------------------------------------

@router.post("/webhooks/github")
async def receive_github_webhook(
    request: Request,
    x_github_event: str = Header(default=""),
    x_hub_signature_256: str = Header(default=""),
):
    """Receive and process GitHub push events."""
    body = await request.body()
    payload_str = body.decode("utf-8")

    logger.info(f"[webhook/github] Received event: {x_github_event}")

    # Only process push events
    if x_github_event not in ("push", "create"):
        return {"status": "ignored", "reason": f"Event '{x_github_event}' not processed"}

    try:
        payload = json.loads(payload_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    repo_full_name = payload.get("repository", {}).get("full_name", "")
    ref = payload.get("ref", "")
    commit_sha = payload.get("after", "")
    commit_message = payload.get("head_commit", {}).get("message", "")
    commit_author = payload.get("head_commit", {}).get("author", {}).get("name", "")

    logger.info(f"[webhook/github] Push to {repo_full_name} ref={ref} sha={commit_sha[:8]}")

    # Find the project by repo name
    supabase = get_supabase()
    project_resp = (
        supabase.table("projects")
        .select("id, default_branch")
        .eq("repo_name", repo_full_name)
        .maybe_single()
        .execute()
    )

    if not project_resp or not project_resp.data:
        logger.warning(f"[webhook/github] No project found for repo: {repo_full_name}")
        return {"status": "no_project"}

    project = project_resp.data
    default_branch = project.get("default_branch", "main")

    # Only trigger on pushes to the default branch
    expected_ref = f"refs/heads/{default_branch}"
    if ref != expected_ref:
        return {"status": "ignored", "reason": f"Push to non-default branch: {ref}"}

    # Verify HMAC-SHA256 signature
    webhook_resp = (
        supabase.table("webhook_connections")
        .select("webhook_secret")
        .eq("project_id", project["id"])
        .eq("platform", "github")
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )

    if webhook_resp and webhook_resp.data:
        secret = webhook_resp.data.get("webhook_secret", "")
        if x_hub_signature_256 and secret:
            expected_sig = "sha256=" + hmac.new(
                secret.encode("utf-8"),
                body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(x_hub_signature_256, expected_sig):
                logger.warning(f"[webhook/github] Signature mismatch for {repo_full_name}")
                raise HTTPException(status_code=401, detail="Invalid signature")

    # Update last_triggered_at
    if webhook_resp.data:
        supabase.table("webhook_connections").update({
            "last_triggered_at": datetime.now(timezone.utc).isoformat()
        }).eq("project_id", project["id"]).eq("platform", "github").execute()

    # Queue analysis
    _queue_analysis(
        project_id=project["id"],
        commit_sha=commit_sha,
        commit_message=commit_message,
        commit_author=commit_author,
        trigger_source="webhook",
    )

    return {"status": "queued", "project_id": project["id"]}


# -----------------------------------------------
# Receive GitLab push events
# -----------------------------------------------

@router.post("/webhooks/gitlab")
async def receive_gitlab_webhook(
    request: Request,
    x_gitlab_event: str = Header(default=""),
    x_gitlab_token: str = Header(default=""),
):
    """Receive and process GitLab push events."""
    body = await request.body()

    if "Push Hook" not in x_gitlab_event:
        return {"status": "ignored", "reason": f"Event '{x_gitlab_event}' not processed"}

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    repo_full_name = payload.get("project", {}).get("path_with_namespace", "")
    ref = payload.get("ref", "")
    commit_sha = payload.get("checkout_sha", "")
    commits = payload.get("commits", [])
    commit_message = commits[0].get("message", "") if commits else ""
    commit_author = commits[0].get("author", {}).get("name", "") if commits else ""

    supabase = get_supabase()
    project_resp = (
        supabase.table("projects")
        .select("id, default_branch")
        .eq("repo_name", repo_full_name)
        .maybe_single()
        .execute()
    )

    if not project_resp or not project_resp.data:
        return {"status": "no_project"}

    project = project_resp.data
    default_branch = project.get("default_branch", "main")

    if ref != f"refs/heads/{default_branch}":
        return {"status": "ignored", "reason": f"Push to non-default branch: {ref}"}

    # Verify GitLab token
    webhook_resp = (
        supabase.table("webhook_connections")
        .select("webhook_secret")
        .eq("project_id", project["id"])
        .eq("platform", "gitlab")
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )

    if webhook_resp and webhook_resp.data:
        secret = webhook_resp.data.get("webhook_secret", "")
        if x_gitlab_token and secret and x_gitlab_token != secret:
            raise HTTPException(status_code=401, detail="Invalid GitLab token")

        supabase.table("webhook_connections").update({
            "last_triggered_at": datetime.now(timezone.utc).isoformat()
        }).eq("project_id", project["id"]).eq("platform", "gitlab").execute()

    _queue_analysis(
        project_id=project["id"],
        commit_sha=commit_sha,
        commit_message=commit_message,
        commit_author=commit_author,
        trigger_source="webhook",
    )

    return {"status": "queued", "project_id": project["id"]}


# -----------------------------------------------
# Helpers
# -----------------------------------------------

def _queue_analysis(
    project_id: str,
    commit_sha: str,
    commit_message: str,
    commit_author: str,
    trigger_source: str = "webhook",
) -> None:
    """Create analysis record and enqueue the RQ job."""
    from datetime import datetime, timezone
    supabase = get_supabase()

    # Create the analysis record
    new_analysis = {
        "project_id": project_id,
        "status": "queued",
        "trigger_source": trigger_source,
        "commit_sha": commit_sha,
        "commit_message": commit_message,
        "commit_author": commit_author,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = supabase.table("analyses").insert(new_analysis).execute()
    analysis_id = result.data[0]["id"] if result.data else None

    if not analysis_id:
        logger.error(f"Failed to create analysis record for project {project_id}")
        return

    # Enqueue RQ job
    try:
        from rq import Queue
        from redis import Redis
        from backend.core.config import get_settings
        settings = get_settings()

        redis = Redis.from_url(settings.redis_url)
        q = Queue("default", connection=redis)
        q.enqueue(
            "backend.workers.analyze.analyze_project",
            project_id,
            analysis_id,
            commit_sha=commit_sha,
            commit_message=commit_message,
            commit_author=commit_author,
            trigger_source=trigger_source,
            job_timeout=600,
        )
        logger.info(f"Enqueued analysis job for project {project_id}, analysis {analysis_id}")
    except Exception as e:
        logger.error(f"Failed to enqueue analysis job: {e}")


async def _register_github_webhook(
    repo_name: str, access_token: str, webhook_url: str, secret: str
) -> str | None:
    """Register a webhook with GitHub API."""
    from backend.core.encryption import decrypt_token
    token = decrypt_token(access_token)

    owner, repo = repo_name.split("/", 1) if "/" in repo_name else (repo_name, repo_name)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/hooks",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json={
                "name": "web",
                "active": True,
                "events": ["push"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": secret,
                    "insecure_ssl": "0",
                },
            },
        )

    if resp.status_code in (200, 201):
        return str(resp.json().get("id", ""))
    else:
        logger.warning(f"GitHub webhook registration failed: {resp.status_code} {resp.text}")
        return None


async def _register_gitlab_webhook(
    project_id_gl: int | str, access_token: str, webhook_url: str, secret: str
) -> str | None:
    """Register a webhook with GitLab API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://gitlab.com/api/v4/projects/{project_id_gl}/hooks",
            headers={"PRIVATE-TOKEN": access_token},
            json={
                "url": webhook_url,
                "push_events": True,
                "token": secret,
                "enable_ssl_verification": True,
            },
        )

    if resp.status_code in (200, 201):
        return str(resp.json().get("id", ""))
    else:
        logger.warning(f"GitLab webhook registration failed: {resp.status_code}")
        return None


async def _delete_github_webhook(repo_name: str, access_token: str, webhook_id: str) -> None:
    """Delete a webhook from GitHub."""
    owner, repo = repo_name.split("/", 1) if "/" in repo_name else (repo_name, repo_name)
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(
            f"https://api.github.com/repos/{owner}/{repo}/hooks/{webhook_id}",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
