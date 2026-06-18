"""
Trixon Backend — Public Share API Routes

Endpoints for public, read-only access to shared reports.
No JWT authentication required.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/share", tags=["Share"])

class PublicReportResponse(BaseModel):
    id: str
    report_type: str
    content_markdown: str
    content_json: dict
    repo_name: str

@router.get("/{token}", response_model=PublicReportResponse)
async def get_shared_report(token: str) -> PublicReportResponse:
    """
    Retrieve a public report using its share token.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    report_resp = (
        supabase.table("reports")
        .select("id, report_type, content_markdown, content_json, share_enabled, analyses(projects(repo_name))")
        .eq("share_token", token)
        .maybe_single()
        .execute()
    )

    if not report_resp.data:
        raise HTTPException(status_code=404, detail="Shared report not found")

    if not report_resp.data.get("share_enabled"):
        raise HTTPException(status_code=403, detail="Sharing is disabled for this report")

    try:
        repo_name = report_resp.data["analyses"]["projects"]["repo_name"]
    except (KeyError, TypeError):
        repo_name = "Unknown Repository"

    return PublicReportResponse(
        id=report_resp.data["id"],
        report_type=report_resp.data["report_type"],
        content_markdown=report_resp.data["content_markdown"] or "",
        content_json=report_resp.data["content_json"] or {},
        repo_name=repo_name
    )
