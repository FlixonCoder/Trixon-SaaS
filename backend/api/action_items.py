"""
Trixon Backend — Action Items API Routes (v3.0)

Routes:
  GET    /api/v1/projects/{id}/action-items    — List action items (filterable)
  PATCH  /api/v1/action-items/{id}             — Update status
  GET    /api/v1/action-items/{id}/prompt       — Get the ai_prompt
  GET    /api/v1/projects/{id}/timeline         — Get snapshot timeline
  GET    /api/v1/analyses/{id}/diff             — Get the diff for a snapshot
  GET    /api/v1/projects/{id}/diffs/{diff_id} — Full diff detail
  GET    /api/v1/report-catalog                — Get report catalog (v3.1)
  POST   /api/v1/projects/{id}/reports/add     — Add reports to existing snapshot (v3.1)
"""

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["action_items", "timeline"])

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
EFFORT_ORDER = {"quick-win": 0, "moderate": 1, "complex": 2, "architectural": 3}


class ActionItemStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved", "ignored"]


class AddReportsRequest(BaseModel):
    report_types: list[str]


# -----------------------------------------------
# Action Items
# -----------------------------------------------

@router.get("/projects/{project_id}/action-items")
async def list_action_items(
    project_id: str,
    status: str | None = Query(default=None),           # 'open' | 'resolved' | 'ignored' | 'in_progress'
    severity: str | None = Query(default=None),          # 'critical' | 'high' | 'medium' | 'low'
    category: str | None = Query(default=None),          # 'security' | 'tech_debt' | 'scalability'
    effort: str | None = Query(default=None),            # 'quick-win' | 'moderate' | 'complex'
    analysis_id: str | None = Query(default=None),       # Filter to specific snapshot
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """
    List action items for a project with optional filters.
    Default: open items, sorted by severity then effort (quick-wins first).
    """
    supabase = get_supabase()

    # Verify project ownership
    project_resp = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    query = (
        supabase.table("action_items")
        .select("*")
        .eq("project_id", project_id)
    )

    if status:
        query = query.eq("status", status)
    else:
        query = query.eq("status", "open")  # Default to open

    if severity:
        query = query.eq("severity", severity)

    if category:
        query = query.eq("category", category)

    if effort:
        query = query.eq("effort_level", effort)

    if analysis_id:
        query = query.eq("analysis_id", analysis_id)

    result = query.execute()
    items = result.data or []

    # Sort: severity first (critical→low), then effort (quick-win first)
    items.sort(key=lambda x: (
        SEVERITY_ORDER.get(x.get("severity", "low"), 4),
        EFFORT_ORDER.get(x.get("effort_level", "complex"), 4),
    ))

    return {
        "items": items,
        "total": len(items),
        "filters": {
            "status": status or "open",
            "severity": severity,
            "category": category,
            "effort": effort,
        },
    }


@router.patch("/action-items/{item_id}")
async def update_action_item(
    item_id: str,
    body: ActionItemStatusUpdate,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """Update the status of an action item."""
    supabase = get_supabase()

    # Fetch item and verify ownership via project
    item_resp = (
        supabase.table("action_items")
        .select("*, projects(user_id)")
        .eq("id", item_id)
        .single()
        .execute()
    )
    if not item_resp.data:
        raise HTTPException(status_code=404, detail="Action item not found")

    project = item_resp.data.get("projects") or {}
    if project.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data: dict = {"status": body.status}
    if body.status == "resolved":
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("action_items")
        .update(update_data)
        .eq("id", item_id)
        .execute()
    )
    
    from backend.services.analytics import track_event
    track_event(
        user_id=user_id,
        event_type="action_item_status_changed",
        project_id=item_resp.data.get("project_id"),
        properties={"status": body.status}
    )

    return result.data[0] if result.data else {"id": item_id, "status": body.status}


@router.get("/action-items/{item_id}/prompt")
async def get_action_item_prompt(
    item_id: str,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """Get the ready-to-paste AI prompt for an action item."""
    supabase = get_supabase()

    item_resp = (
        supabase.table("action_items")
        .select("ai_prompt, title, projects(user_id)")
        .eq("id", item_id)
        .single()
        .execute()
    )
    if not item_resp.data:
        raise HTTPException(status_code=404, detail="Action item not found")

    project = item_resp.data.get("projects") or {}
    if project.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "item_id": item_id,
        "title": item_resp.data.get("title"),
        "prompt": item_resp.data.get("ai_prompt") or "",
    }


# -----------------------------------------------
# Timeline
# -----------------------------------------------

@router.get("/projects/{project_id}/timeline")
async def get_project_timeline(
    project_id: str,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """
    Get the full snapshot timeline for a project.
    Returns analyses ordered by snapshot_number with scores and diff verdicts.
    """
    supabase = get_supabase()

    project_resp = (
        supabase.table("projects")
        .select("id, repo_name")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    analyses_resp = (
        supabase.table("analyses")
        .select(
            "id, snapshot_number, status, health_score, security_score, "
            "scalability_score, quality_score, docs_score, commit_sha, "
            "commit_message, commit_author, trigger_source, created_at, completed_at, "
            "selected_reports"
        )
        .eq("project_id", project_id)
        .in_("status", ["complete", "running"])
        .order("snapshot_number")
        .execute()
    )

    analyses = analyses_resp.data or []

    # Enrich with diff verdicts
    diff_resp = (
        supabase.table("analysis_diffs")
        .select("id, to_analysis_id, verdict, score_deltas")
        .eq("project_id", project_id)
        .execute()
    )
    diffs_by_analysis = {
        d["to_analysis_id"]: d for d in (diff_resp.data or [])
    }

    timeline = []
    for analysis in analyses:
        diff = diffs_by_analysis.get(analysis["id"])
        timeline.append({
            **analysis,
            "diff_id": diff["id"] if diff else None,
            "verdict": diff["verdict"] if diff else None,
            "score_deltas": diff["score_deltas"] if diff else None,
        })

    return {"timeline": timeline, "total": len(timeline)}


@router.get("/analyses/{analysis_id}/diff")
async def get_analysis_diff(
    analysis_id: str,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """Get the diff record for a specific snapshot analysis."""
    supabase = get_supabase()

    # Verify access via project ownership
    analysis_resp = (
        supabase.table("analyses")
        .select("id, project_id, projects(user_id)")
        .eq("id", analysis_id)
        .single()
        .execute()
    )
    if not analysis_resp.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    project = analysis_resp.data.get("projects") or {}
    if project.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    diff_resp = (
        supabase.table("analysis_diffs")
        .select("*")
        .eq("to_analysis_id", analysis_id)
        .maybe_single()
        .execute()
    )

    if not diff_resp.data:
        raise HTTPException(status_code=404, detail="No diff found for this analysis (first snapshot?)")

    return diff_resp.data


@router.get("/projects/{project_id}/diffs/{diff_id}")
async def get_diff_detail(
    project_id: str,
    diff_id: str,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """Get full diff detail including all findings."""
    supabase = get_supabase()

    project_resp = (
        supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    diff_resp = (
        supabase.table("analysis_diffs")
        .select("*")
        .eq("id", diff_id)
        .eq("project_id", project_id)
        .single()
        .execute()
    )

    if not diff_resp.data:
        raise HTTPException(status_code=404, detail="Diff not found")

    return diff_resp.data


# -----------------------------------------------
# Report Catalog (v3.1)
# -----------------------------------------------

@router.get("/report-catalog")
async def get_report_catalog(
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """
    Return the full report catalog.
    Annotates items with is_recommended based on the user's primary_goal.
    """
    supabase = get_supabase()

    catalog_resp = (
        supabase.table("report_catalog")
        .select("*")
        .order("display_order")
        .execute()
    )
    items = catalog_resp.data or []

    # Personalize based on primary_goal
    primary_goal = None
    if user_id:
        try:
            profile_resp = (
                supabase.table("profiles")
                .select("primary_goal")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            primary_goal = profile_resp.data.get("primary_goal") if profile_resp.data else None
        except Exception:
            pass

    GOAL_TO_BEST_FOR = {
        "prepare_investors": ["Raising a round", "Everyone"],
        "prepare_hire": ["Hiring devs", "Everyone"],
        "enterprise_security": ["Pre-launch, enterprise questions", "Everyone"],
        "recover_agency": ["Everyone"],
        "general_audit": ["Everyone"],
    }

    recommended_best_for = GOAL_TO_BEST_FOR.get(primary_goal or "", [])

    enriched = []
    for item in items:
        enriched.append({
            **item,
            "is_recommended": any(
                bf in (item.get("best_for") or "")
                for bf in recommended_best_for
            ) if recommended_best_for else item.get("is_default", False),
        })

    return {"catalog": enriched, "primary_goal": primary_goal}


# -----------------------------------------------
# Add Reports to Existing Snapshot (v3.1)
# -----------------------------------------------

@router.post("/projects/{project_id}/reports/add")
async def add_reports_to_snapshot(
    project_id: str,
    body: AddReportsRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = None,
):
    user_id = user["id"] if user else None
    """
    Trigger generation of additional reports for the latest snapshot.
    Uses the already-fetched static extraction — no full pipeline re-run.
    """
    supabase = get_supabase()

    # Verify project ownership
    project_resp = (
        supabase.table("projects")
        .select("id, repo_name")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get latest completed analysis
    analysis_resp = (
        supabase.table("analyses")
        .select("id, selected_reports")
        .eq("project_id", project_id)
        .eq("status", "complete")
        .order("snapshot_number", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not analysis_resp.data:
        raise HTTPException(status_code=404, detail="No completed analysis found. Run a full analysis first.")

    analysis = analysis_resp.data
    analysis_id = analysis["id"]
    current_selected = analysis.get("selected_reports") or []

    # Filter to only truly new report types
    existing_report_resp = (
        supabase.table("reports")
        .select("report_type")
        .eq("analysis_id", analysis_id)
        .execute()
    )
    existing_types = {r["report_type"] for r in (existing_report_resp.data or [])}
    new_types = [r for r in body.report_types if r not in existing_types]

    if not new_types:
        raise HTTPException(status_code=400, detail="All requested reports already exist for this snapshot")

    # Queue a targeted analysis job (only new report types)
    try:
        from backend.workers.analyze import run_analysis_job
        background_tasks.add_task(
            run_analysis_job,
            project_id=project_id,
            analysis_id=analysis_id,  # Re-use existing analysis_id
            report_types=new_types,
            trigger_source="add_reports"
        )
    except Exception as e:
        logger.error(f"Failed to queue add-reports job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue report generation: {str(e)}")

    # Update selected_reports to include the new types
    updated_selected = list(set(current_selected + new_types))
    supabase.table("analyses").update({
        "selected_reports": updated_selected
    }).eq("id", analysis_id).execute()

    return {
        "status": "queued",
        "analysis_id": analysis_id,
        "adding_reports": new_types,
        "updated_selected_reports": updated_selected,
    }
