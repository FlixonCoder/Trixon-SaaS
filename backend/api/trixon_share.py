"""
Trixon Backend — Trixon Share API Routes

"Share with Trixon" feature — founder sends their audit to the Trixon team
for a free 15-minute expert readout. This is the highest-intent lead capture.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.config import get_settings
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trixon-share", tags=["Trixon Share"])


# -----------------------------------------------
# Request / Response Models
# -----------------------------------------------

class TrixonShareRequest(BaseModel):
    analysis_id: str
    founder_message: str | None = None


class TrixonShareResponse(BaseModel):
    session_id: str
    status: str


class TrixonShareStatusResponse(BaseModel):
    id: str
    status: str
    created_at: str


# -----------------------------------------------
# Endpoints
# -----------------------------------------------

@router.post("", response_model=TrixonShareResponse, status_code=status.HTTP_201_CREATED)
async def create_trixon_share(user: CurrentUser, body: TrixonShareRequest) -> TrixonShareResponse:
    """
    Send an audit to the Trixon team for expert review.
    Creates a share session and sends an email notification.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    # Verify the analysis belongs to this user
    analysis_resp = (
        supabase.table("analyses")
        .select("id, project_id, health_score")
        .eq("id", body.analysis_id)
        .maybe_single()
        .execute()
    )

    if not analysis_resp or not analysis_resp.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis_data_row = analysis_resp.data

    # Verify project ownership
    project_resp = (
        supabase.table("projects")
        .select("user_id, repo_name")
        .eq("id", analysis_data_row["project_id"])
        .maybe_single()
        .execute()
    )

    if not project_resp or not project_resp.data or project_resp.data["user_id"] != user["id"]:
        logger.warning(
            f"Ownership check failed for shared analysis {body.analysis_id}. "
            f"Project owner: {project_resp.data.get('user_id') if project_resp and project_resp.data else 'None'}, "
            f"Requesting user: {user['id']}"
        )
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Combine for email compatibility
    analysis_for_email = {
        "id": analysis_data_row["id"],
        "project_id": analysis_data_row["project_id"],
        "health_score": analysis_data_row["health_score"],
        "projects": {
            "user_id": project_resp.data["user_id"],
            "repo_name": project_resp.data["repo_name"]
        }
    }

    try:
        # Create the share session
        session_resp = (
            supabase.table("trixon_share_sessions")
            .insert({
                "analysis_id": body.analysis_id,
                "user_id": user["id"],
                "founder_message": body.founder_message,
                "status": "pending",
            })
            .execute()
        )

        session = session_resp.data[0]

        # Send email to Trixon team (best-effort)
        _send_trixon_share_email(
            user_id=user["id"],
            analysis=analysis_for_email,
            founder_message=body.founder_message,
        )

        return TrixonShareResponse(
            session_id=session["id"],
            status="sent",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create trixon share: {e}")
        raise HTTPException(status_code=500, detail="Failed to send to Trixon team")


@router.get("/{session_id}", response_model=TrixonShareStatusResponse)
async def get_trixon_share_status(user: CurrentUser, session_id: str) -> TrixonShareStatusResponse:
    """Check the status of a Trixon share session."""
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    session_resp = (
        supabase.table("trixon_share_sessions")
        .select("id, status, created_at")
        .eq("id", session_id)
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )

    if not session_resp or not session_resp.data:
        raise HTTPException(status_code=404, detail="Share session not found")

    s = session_resp.data
    return TrixonShareStatusResponse(
        id=s["id"],
        status=s["status"],
        created_at=s["created_at"],
    )


# -----------------------------------------------
# Helpers
# -----------------------------------------------

def _send_trixon_share_email(
    user_id: str,
    analysis: dict,
    founder_message: str | None,
) -> None:
    """
    Send notification email to the Trixon team.
    
    When Resend API key is configured: sends via Resend.
    When not configured (local dev): logs the full email content to console.
    This ensures the share feature works in dev without a live email setup.
    
    To enable real email: set RESEND_API_KEY in backend/.env and
    configure a verified sending domain in your Resend dashboard.
    """
    settings = get_settings()

    try:
        supabase = get_supabase()
        if supabase is None:
            return

        # Get founder profile
        profile_resp = (
            supabase.table("profiles")
            .select("full_name, company_name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        founder_name = "Unknown"
        company_name = "Unknown"
        if profile_resp and profile_resp.data:
            founder_name = profile_resp.data.get("full_name", "Unknown")
            company_name = profile_resp.data.get("company_name", "Unknown")

        # Get top findings from executive summary report
        top_findings = ""
        try:
            exec_report = (
                supabase.table("reports")
                .select("content_json")
                .eq("analysis_id", analysis["id"])
                .eq("report_type", "executive_summary")
                .maybe_single()
                .execute()
            )
            if exec_report and exec_report.data:
                paragraphs = exec_report.data.get("content_json", {}).get("paragraphs", [])
                top_findings = paragraphs[0] if paragraphs else ""
        except Exception:
            pass

        repo_name = analysis.get("projects", {}).get("repo_name", "Unknown repo")
        health_score = analysis.get("health_score", "N/A")

        message_section = ""
        if founder_message:
            message_section = f"""
                <h3>Founder's Message:</h3>
                <blockquote style="border-left: 3px solid #039a85; padding-left: 12px; color: #555;">
                    {founder_message}
                </blockquote>
            """

        email_subject = f"[Trixon Audit] New founder share — {company_name}"
        email_html = f"""
                <h2>🔥 New Founder Share — Priority Inbound</h2>
                <table style="border-collapse: collapse;">
                    <tr><td style="padding: 4px 12px 4px 0; color: #888;">Founder:</td><td><strong>{founder_name}</strong></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #888;">Company:</td><td><strong>{company_name}</strong></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #888;">Repository:</td><td>{repo_name}</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #888;">Health Score:</td><td><strong>{health_score}/100</strong></td></tr>
                </table>
                {message_section}
                {f'<h3>Executive Summary (excerpt):</h3><p style="color: #555;">{top_findings}</p>' if top_findings else ''}
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #888; font-size: 12px;">
                    This founder has shared their audit with the Trixon team. Respond within 24 hours.
                </p>
            """

        # ── Send via Resend if configured, otherwise log to console ──
        if not settings.resend_api_key:
            logger.info(
                f"[TRIXON SHARE — EMAIL FALLBACK] Resend not configured, logging email instead.\n"
                f"  TO: {settings.trixon_team_email}\n"
                f"  SUBJECT: {email_subject}\n"
                f"  FOUNDER: {founder_name} ({company_name})\n"
                f"  REPO: {repo_name}\n"
                f"  HEALTH SCORE: {health_score}\n"
                f"  FOUNDER MESSAGE: {founder_message or '(none)'}\n"
                f"  TOP FINDING: {top_findings[:200] or '(none)'}\n"
                f"  ---\n"
                f"  To enable real email delivery, set RESEND_API_KEY in backend/.env\n"
                f"  and configure a verified sending domain at https://resend.com/domains"
            )
            return

        import resend
        resend.api_key = settings.resend_api_key

        resend.Emails.send({
            "from": "Trixon Audit <noreply@trixon.cloud>",
            "to": [settings.trixon_team_email],
            "subject": email_subject,
            "html": email_html,
        })

        logger.info(f"Trixon share email sent for user {user_id}")

    except Exception as e:
        logger.warning(f"Failed to send Trixon share email: {e}")

