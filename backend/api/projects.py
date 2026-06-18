"""
Trixon Backend — Projects API Routes

CRUD endpoints for managing connected repositories (projects).
Creating a project enqueues an analysis job automatically.
"""

import logging

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["Projects"])


# -----------------------------------------------
# Request / Response Models
# -----------------------------------------------

class CreateProjectRequest(BaseModel):
    vcs_connection_id: str
    repo_id: str           # Platform's internal repo ID
    repo_name: str         # "owner/repo" for GitHub, "namespace/repo" for GitLab
    repo_url: str
    platform: str          # "github" | "gitlab"
    default_branch: str = "main"


class AnalyzeRequest(BaseModel):
    report_types: list[str] | None = None
    selected_reports: list[str] | None = None
    commit_sha: str | None = None
    commit_message: str | None = None
    commit_author: str | None = None
    trigger_source: str = "manual"


class AnalysisStatus(BaseModel):
    id: str
    status: str
    health_score: int | None
    security_score: int | None
    scalability_score: int | None
    quality_score: int | None
    docs_score: int | None
    language_breakdown: dict | None
    third_party_services: dict | None
    stats: dict | None
    key_findings: list[str] | None = None
    started_at: str | None
    completed_at: str | None
    created_at: str
    commit_sha: str | None = None
    commit_message: str | None = None
    commit_author: str | None = None
    snapshot_number: int | None = None
    trigger_source: str | None = None
    selected_reports: list[str] | None = None


class ProjectResponse(BaseModel):
    id: str
    repo_name: str
    repo_url: str
    platform: str
    default_branch: str
    last_synced_at: str | None
    created_at: str
    latest_analysis: AnalysisStatus | None
    webhook_connected: bool = False


# -----------------------------------------------
# Endpoints
# -----------------------------------------------

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(user: CurrentUser, body: CreateProjectRequest) -> ProjectResponse:
    """
    Create a new project by linking a repository to a VCS connection.
    Does NOT automatically trigger an analysis.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify the VCS connection belongs to this user
    conn_resp = (
        supabase.table("vcs_connections")
        .select("id, platform")
        .eq("id", body.vcs_connection_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if conn_resp is None or not conn_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="VCS connection not found",
        )

    # Check if this repo is already connected
    existing = (
        supabase.table("projects")
        .select("id")
        .eq("user_id", user["id"])
        .eq("repo_id", body.repo_id)
        .eq("platform", body.platform)
        .maybe_single()
        .execute()
    )

    if existing is not None and existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This repository is already connected.",
        )

    try:
        # Create the project
        project_resp = (
            supabase.table("projects")
            .insert({
                "user_id": user["id"],
                "vcs_connection_id": body.vcs_connection_id,
                "repo_id": body.repo_id,
                "repo_name": body.repo_name,
                "repo_url": body.repo_url,
                "platform": body.platform,
                "default_branch": body.default_branch,
            })
            .execute()
        )
        project = project_resp.data[0]

        from backend.services.analytics import track_event
        track_event(user["id"], "repo_connected", project_id=project["id"])

        return _build_project_response(project, None)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail="Failed to create project")


@router.get("", response_model=list[ProjectResponse])
async def list_projects(user: CurrentUser) -> list[ProjectResponse]:
    """List all projects for the current user with their latest analysis status."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        projects_resp = (
            supabase.table("projects")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )

        project_ids = [p["id"] for p in projects_resp.data] if projects_resp.data else []
        active_webhooks = set()
        if project_ids:
            try:
                webhooks_resp = (
                    supabase.table("webhook_connections")
                    .select("project_id")
                    .in_("project_id", project_ids)
                    .eq("is_active", True)
                    .execute()
                )
                if webhooks_resp.data:
                    active_webhooks = {w["project_id"] for w in webhooks_resp.data}
            except Exception as w_err:
                logger.warning(f"Failed to query webhook_connections in list_projects: {w_err}")

        result = []
        for project in projects_resp.data:
            # Fetch the latest analysis for this project
            analysis_resp = (
                supabase.table("analyses")
                .select("*")
                .eq("project_id", project["id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            analysis = analysis_resp.data[0] if analysis_resp.data else None
            is_connected = project["id"] in active_webhooks
            result.append(_build_project_response(project, analysis, is_connected))

        return result

    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch projects")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(user: CurrentUser, project_id: str) -> ProjectResponse:
    """Get a single project with its latest analysis."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    project_resp = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if project_resp is None or not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_resp.data
    
    # Check if webhook is active
    webhook_connected = False
    try:
        webhook_resp = (
            supabase.table("webhook_connections")
            .select("id")
            .eq("project_id", project_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        webhook_connected = bool(webhook_resp.data) if (webhook_resp and webhook_resp.data) else False
    except Exception as w_err:
        logger.warning(f"Failed to query webhook_connections in get_project: {w_err}")

    analysis_resp = (
        supabase.table("analyses")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    analysis = analysis_resp.data[0] if analysis_resp.data else None
    return _build_project_response(project, analysis, webhook_connected)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(user: CurrentUser, project_id: str) -> None:
    """Remove a project and all its analyses/reports."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    existing = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if existing is None or not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Delete analyses and reports will cascade via Supabase FK constraints
        supabase.table("projects").delete().eq("id", project_id).execute()
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")


@router.get("/{project_id}/analyses", response_model=list[AnalysisStatus])
async def list_project_analyses(user: CurrentUser, project_id: str) -> list[AnalysisStatus]:
    """List all analysis runs for a specific project."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    project_resp = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if project_resp is None or not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    analyses_resp = (
        supabase.table("analyses")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .execute()
    )

    return [_build_analysis_status(a) for a in analyses_resp.data] if analyses_resp.data else []


@router.get("/{project_id}/access-level")
async def get_project_access_level(user: CurrentUser, project_id: str) -> dict:
    """Returns the user's access level for this project: 'basic' or 'full'."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify project ownership
    project_resp = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if project_resp is None or not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    from backend.core.config import get_settings
    settings = get_settings()
    if settings.beta_mode:
        return {"access": "full"}

    profile_resp = (
        supabase.table("profiles")
        .select("plan")
        .eq("id", user["id"])
        .maybe_single()
        .execute()
    )
    plan = "free"
    if profile_resp and profile_resp.data:
        plan = profile_resp.data.get("plan", "free")
        
    access = "full" if plan == "pro" else "basic"
    return {"access": access}


@router.post("/{project_id}/analyze", response_model=AnalysisStatus, status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis(
    user: CurrentUser, 
    project_id: str, 
    background_tasks: BackgroundTasks,
    body: AnalyzeRequest | None = None
) -> AnalysisStatus:
    """Trigger a new analysis run for an existing project."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    project_resp = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if project_resp is None or not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if an analysis is already running for THIS project
    running_resp = (
        supabase.table("analyses")
        .select("id")
        .eq("project_id", project_id)
        .in_("status", ["queued", "running"])
        .maybe_single()
        .execute()
    )

    if running_resp is not None and running_resp.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An analysis is already running for this project.",
        )

    # -----------------------------------------------
    # Rate Limiting (Beta Restrictions: 5 analyses/day/user)
    # -----------------------------------------------
    from datetime import datetime, timedelta, timezone
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    
    # Get all projects for this user to query their analyses
    user_projects_resp = (
        supabase.table("projects")
        .select("id")
        .eq("user_id", user["id"])
        .execute()
    )
    user_project_ids = [p["id"] for p in (user_projects_resp.data or [])]

    if user_project_ids:
        daily_analysis_resp = (
            supabase.table("analyses")
            .select("id", count="exact")
            .in_("project_id", user_project_ids)
            .gte("created_at", one_day_ago)
            .execute()
        )
        daily_analysis_count = daily_analysis_resp.count if daily_analysis_resp and daily_analysis_resp.count is not None else 0

        if daily_analysis_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have exceeded the beta testing limit of 5 analyses per day. Please try again tomorrow."
            )

    # Global Queue Protection: Prevent hardware overload
    from backend.core.config import get_settings
    if get_settings().llm_provider.lower() == "ollama":
        running_anywhere = (
            supabase.table("analyses")
            .select("id")
            .in_("status", ["queued", "running"])
            .limit(1)
            .execute()
        )
        if running_anywhere.data:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The local AI engine is currently busy analyzing another repository. Please wait for it to finish.",
            )

    try:
        selected = None
        if body:
            selected = body.selected_reports or body.report_types

        analysis_data = {
            "project_id": project_id,
            "status": "queued",
            "trigger_source": body.trigger_source if body else "manual",
            "commit_sha": body.commit_sha if body else None,
            "commit_message": body.commit_message if body else None,
            "commit_author": body.commit_author if body else None,
        }
        if selected:
            analysis_data["selected_reports"] = selected

        analysis_resp = (
            supabase.table("analyses")
            .insert(analysis_data)
            .execute()
        )
        analysis = analysis_resp.data[0]
        
        from backend.workers.analyze import run_analysis_job
        background_tasks.add_task(
            run_analysis_job,
            project_id=project_id,
            analysis_id=analysis["id"],
            report_types=selected,
            commit_sha=body.commit_sha if body else None,
            commit_message=body.commit_message if body else None,
            commit_author=body.commit_author if body else None,
            trigger_source=body.trigger_source if body else "manual"
        )
        logger.info(f"Background task added for analysis {analysis['id']}")

        from backend.services.analytics import track_event
        track_event(
            user_id=user["id"],
            event_type="analysis_triggered",
            project_id=project_id,
            properties={
                "trigger_source": body.trigger_source if body else "manual",
                "selected_reports": selected
            }
        )

        return _build_analysis_status(analysis)

    except Exception as e:
        logger.error(f"Failed to trigger analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to start analysis")


# -----------------------------------------------
# Helpers
# -----------------------------------------------


def _build_analysis_status(a: dict | None) -> AnalysisStatus | None:
    if a is None:
        return None
    return AnalysisStatus(
        id=a["id"],
        status=a["status"],
        health_score=a.get("health_score"),
        security_score=a.get("security_score"),
        scalability_score=a.get("scalability_score"),
        quality_score=a.get("quality_score"),
        docs_score=a.get("docs_score"),
        language_breakdown=a.get("language_breakdown"),
        third_party_services=a.get("third_party_services"),
        stats=a.get("stats"),
        key_findings=a.get("key_findings"),
        started_at=a.get("started_at"),
        completed_at=a.get("completed_at"),
        created_at=a["created_at"],
        commit_sha=a.get("commit_sha"),
        commit_message=a.get("commit_message"),
        commit_author=a.get("commit_author"),
        snapshot_number=a.get("snapshot_number"),
        trigger_source=a.get("trigger_source"),
        selected_reports=a.get("selected_reports"),
    )


def _build_project_response(project: dict, analysis: dict | None, webhook_connected: bool = False) -> ProjectResponse:
    return ProjectResponse(
        id=project["id"],
        repo_name=project["repo_name"],
        repo_url=project["repo_url"],
        platform=project["platform"],
        default_branch=project.get("default_branch", "main"),
        last_synced_at=project.get("last_synced_at"),
        created_at=project["created_at"],
        latest_analysis=_build_analysis_status(analysis),
        webhook_connected=webhook_connected,
    )
