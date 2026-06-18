"""
Trixon Backend — Analyses API Routes

Endpoints for polling analysis status and retrieving generated reports.
Used by the frontend to poll every 3 seconds during active analysis.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyses", tags=["Analyses"])

VALID_REPORT_TYPES = {
    "executive_summary",
    "architecture",
    "tech_debt",
    "security",
    "scalability",
    "onboarding",
    "investor",
    "team_readiness",
}


class AnalysisStatusResponse(BaseModel):
    id: str
    project_id: str
    status: str
    health_score: int | None
    security_score: int | None
    scalability_score: int | None
    quality_score: int | None
    docs_score: int | None
    language_breakdown: dict | None
    dependencies: dict | None
    third_party_services: dict | None
    stats: dict | None
    error_message: str | None
    started_at: str | None
    completed_at: str | None
    created_at: str
    selected_reports: list[str] | None = None


class ReportSummary(BaseModel):
    id: str
    report_type: str
    created_at: str


class ReportDetail(BaseModel):
    id: str
    analysis_id: str
    report_type: str
    content_markdown: str
    content_json: dict
    share_token: str | None
    share_enabled: bool
    created_at: str


def _verify_analysis_ownership(supabase, analysis_id: str, user_id: str) -> dict:
    """Helper to verify that an analysis exists and its project belongs to the user."""
    analysis_resp = (
        supabase.table("analyses")
        .select("*")
        .eq("id", analysis_id)
        .maybe_single()
        .execute()
    )
    if not analysis_resp or not analysis_resp.data:
        logger.warning(f"Analysis {analysis_id} not found in database.")
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis = analysis_resp.data

    project_resp = (
        supabase.table("projects")
        .select("user_id")
        .eq("id", analysis["project_id"])
        .maybe_single()
        .execute()
    )
    if not project_resp or not project_resp.data or project_resp.data["user_id"] != user_id:
        owner_id = project_resp.data.get("user_id") if (project_resp and project_resp.data) else "None"
        logger.warning(
            f"Ownership check failed for analysis {analysis_id}. "
            f"Project owner: {owner_id}, "
            f"Requesting user: {user_id}"
        )
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


@router.get("/{analysis_id}", response_model=AnalysisStatusResponse)
async def get_analysis(user: CurrentUser, analysis_id: str) -> AnalysisStatusResponse:
    """
    Get analysis status and scores. Used by the frontend for polling.
    Only accessible to the owner of the project.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    a = _verify_analysis_ownership(supabase, analysis_id, user["id"])
    return AnalysisStatusResponse(
        id=a["id"],
        project_id=a["project_id"],
        status=a["status"],
        health_score=a.get("health_score"),
        security_score=a.get("security_score"),
        scalability_score=a.get("scalability_score"),
        quality_score=a.get("quality_score"),
        docs_score=a.get("docs_score"),
        language_breakdown=a.get("language_breakdown"),
        dependencies=a.get("dependencies"),
        third_party_services=a.get("third_party_services"),
        stats=a.get("stats"),
        error_message=a.get("error_message"),
        started_at=a.get("started_at"),
        completed_at=a.get("completed_at"),
        created_at=a["created_at"],
        selected_reports=a.get("selected_reports"),
    )


@router.get("/{analysis_id}/reports", response_model=list[ReportSummary])
async def list_reports(user: CurrentUser, analysis_id: str) -> list[ReportSummary]:
    """List all generated reports for an analysis run."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    _verify_analysis_ownership(supabase, analysis_id, user["id"])

    reports_resp = (
        supabase.table("reports")
        .select("id, report_type, created_at")
        .eq("analysis_id", analysis_id)
        .execute()
    )

    return [
        ReportSummary(id=r["id"], report_type=r["report_type"], created_at=r["created_at"])
        for r in reports_resp.data
    ]


@router.get("/{analysis_id}/reports/{report_type}", response_model=ReportDetail)
async def get_report(
    user: CurrentUser,
    analysis_id: str,
    report_type: str,
) -> ReportDetail:
    """Get a specific report by type (e.g. 'executive_summary', 'security')."""
    if report_type not in VALID_REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report type. Must be one of: {', '.join(VALID_REPORT_TYPES)}",
        )

    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    analysis = _verify_analysis_ownership(supabase, analysis_id, user["id"])

    # Access control: check if user has purchased full audit for this project
    from backend.core.config import get_settings
    settings = get_settings()
    has_full_access = False
    
    if settings.beta_mode:
        has_full_access = True
    else:
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
        has_full_access = plan == "pro"

    # If the user doesn't have full access, they can only view free reports
    is_free_report = report_type in {"executive_summary", "team_readiness"}
    if not has_full_access and not is_free_report:
        from fastapi import status
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "full_audit_required",
                "upgrade_url": "/pricing",
            },
        )

    report_resp = (
        supabase.table("reports")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("report_type", report_type)
        .maybe_single()
        .execute()
    )

    if report_resp is None or not report_resp.data:
        raise HTTPException(
            status_code=404,
            detail=f"Report '{report_type}' not found. The analysis may still be running.",
        )

    r = report_resp.data
    return ReportDetail(
        id=r["id"],
        analysis_id=r["analysis_id"],
        report_type=r["report_type"],
        content_markdown=r.get("content_markdown", ""),
        content_json=r.get("content_json") or {},
        share_token=r.get("share_token"),
        share_enabled=r.get("share_enabled", False),
        created_at=r["created_at"],
    )


# -----------------------------------------------
# Admin Only
# -----------------------------------------------

from fastapi import Depends
from backend.api.health import verify_admin

class BackfillResponse(BaseModel):
    processed_analyses: int
    items_created: int
    skipped: int

@router.post("/admin/backfill-action-items", response_model=BackfillResponse, dependencies=[Depends(verify_admin)])
async def backfill_action_items() -> BackfillResponse:
    """
    One-time backfill route to extract action items from existing stored reports.
    Requires user to have admin flag (or for this to be called locally).
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Fetch all complete analyses
    analyses_resp = supabase.table("analyses").select("id, project_id").eq("status", "complete").execute()
    analyses = analyses_resp.data or []

    total_processed = 0
    total_skipped = 0
    total_created = 0

    from backend.services.action_extractor import extract_from_report_json

    for analysis in analyses:
        analysis_id = analysis["id"]
        project_id = analysis["project_id"]

        # Does this analysis already have action items?
        count_resp = supabase.table("action_items").select("id", count="exact").eq("analysis_id", analysis_id).limit(1).execute()
        if count_resp.count and count_resp.count > 0:
            total_skipped += 1
            continue

        total_processed += 1

        # Get repo name for prompt template
        proj_resp = supabase.table("projects").select("repo_name").eq("id", project_id).maybe_single().execute()
        repo_name = proj_resp.data["repo_name"] if proj_resp.data else "unknown_repo"

        # Fetch its reports
        reports_resp = supabase.table("reports").select("report_type, content_json").eq("analysis_id", analysis_id).execute()
        
        for row in (reports_resp.data or []):
            rtype = row["report_type"]
            cjson = row.get("content_json")
            if not cjson:
                continue

            created = extract_from_report_json(rtype, cjson, project_id, analysis_id, repo_name)
            total_created += created

    return BackfillResponse(
        processed_analyses=total_processed,
        items_created=total_created,
        skipped=total_skipped,
    )


class ScoreBackfillResponse(BaseModel):
    fixed_count: int


@router.post("/admin/backfill-analysis-scores", response_model=ScoreBackfillResponse, dependencies=[Depends(verify_admin)])
async def backfill_analysis_scores() -> ScoreBackfillResponse:
    """
    For every analysis, derive the TRUE selected_reports list from the reports
    table (source of truth, never wiped), and recompute scores.
    Fixes any analysis where the bug already caused selected_reports or score columns
    to be wrong/NULL.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    analyses = supabase.table("analyses").select("id, selected_reports").execute().data or []

    fixed_count = 0
    from backend.workers.analyze import recompute_scores

    for analysis in analyses:
        analysis_id = analysis["id"]

        # Get the TRUE list of generated report types from the reports table
        reports = (
            supabase.table("reports")
            .select("report_type")
            .eq("analysis_id", analysis_id)
            .execute()
            .data
        ) or []
        true_selected_reports = sorted(set(r["report_type"] for r in reports))

        stored_selected_reports = sorted(analysis.get("selected_reports") or [])

        if true_selected_reports != stored_selected_reports:
            # Mismatch detected — this analysis was corrupted by the bug
            supabase.table("analyses").update({
                "selected_reports": true_selected_reports
            }).eq("id", analysis_id).execute()
            recompute_scores(analysis_id)
            fixed_count += 1
            logger.info(
                f"Backfilled analysis {analysis_id}: "
                f"{stored_selected_reports} -> {true_selected_reports}"
            )

    logger.info(f"Backfill complete. Fixed {fixed_count} analyses.")
    return ScoreBackfillResponse(fixed_count=fixed_count)
