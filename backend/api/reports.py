"""
Trixon Backend — Reports API Routes

Endpoints for interacting with generated reports (simplify, share).
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase
from backend.services.llm_client import simplify_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])


class SimplifyRequest(BaseModel):
    text: str

class SimplifyResponse(BaseModel):
    simplified_text: str

class ShareRequest(BaseModel):
    enabled: bool

class ShareResponse(BaseModel):
    share_token: str | None


@router.post("/{report_id}/simplify", response_model=SimplifyResponse)
async def simplify_report_section(user: CurrentUser, report_id: str, body: SimplifyRequest) -> SimplifyResponse:
    """
    Takes a complex technical section from a report and uses the local LLM
    to explain it in simple, non-technical terms for a founder.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify the report belongs to an analysis the user owns
    report_resp = (
        supabase.table("reports")
        .select("id, analysis_id, analyses(project_id, projects(user_id))")
        .eq("id", report_id)
        .maybe_single()
        .execute()
    )

    if not report_resp.data:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        user_id = report_resp.data["analyses"]["projects"]["user_id"]
        if user_id != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this report")
    except KeyError:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        simplified = simplify_text(body.text)
        return SimplifyResponse(simplified_text=simplified)
    except Exception as e:
        logger.error(f"Simplify failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to simplify text")


@router.post("/{report_id}/share", response_model=ShareResponse)
async def toggle_report_share(user: CurrentUser, report_id: str, body: ShareRequest) -> ShareResponse:
    """
    Enable or disable public sharing for a specific report.
    Returns the new share token if enabled, or null if disabled.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify ownership
    report_resp = (
        supabase.table("reports")
        .select("id, share_token, analyses(projects(id, user_id))")
        .eq("id", report_id)
        .maybe_single()
        .execute()
    )

    if not report_resp.data:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        user_id = report_resp.data["analyses"]["projects"]["user_id"]
        if user_id != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    except KeyError:
        raise HTTPException(status_code=403, detail="Not authorized")

    import uuid
    new_token = str(uuid.uuid4()) if body.enabled else None

    try:
        updated = (
            supabase.table("reports")
            .update({
                "share_enabled": body.enabled,
                "share_token": new_token
            })
            .eq("id", report_id)
            .execute()
        )
        
        if body.enabled:
            from backend.services.analytics import track_event
            track_event(
                user_id=user["id"],
                event_type="report_shared",
                project_id=report_resp.data["analyses"]["projects"]["id"] if "id" in report_resp.data.get("analyses", {}).get("projects", {}) else None
            )
            
        return ShareResponse(share_token=updated.data[0]["share_token"] if updated.data else None)
    except Exception as e:
        logger.error(f"Share toggle failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update sharing settings")
