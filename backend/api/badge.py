"""
Trixon Backend — Public Badge & Project Summary API

Two unauthenticated public endpoints:
  GET /api/badge/{project_id}         — SVG health score badge (for GitHub READMEs)
  GET /api/public/project/{project_id} — Public project summary (for the public page)

These bypass JWT auth intentionally — GitHub's image proxy and anonymous visitors
send no auth headers. Data returned is deliberately limited to aggregate scores.
The service_role client is used to bypass RLS for these public read-only queries.
"""

import logging
from fastapi import APIRouter, HTTPException, Response

from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Public"])


# -----------------------------------------------
# SVG Badge Helpers
# -----------------------------------------------

def _score_to_color(score: int) -> str:
    """Returns a hex color code based on the health score."""
    if score >= 75:
        return "#039a85"   # signal green — good
    if score >= 50:
        return "#F59E0B"   # amber — warning
    return "#E53E3E"       # red — critical


def _cache_headers(seconds: int) -> dict:
    return {
        "Cache-Control": f"public, max-age={seconds}",
        "Content-Type": "image/svg+xml",
    }


def _render_badge(left_text: str, right_text: str, right_color: str) -> str:
    """
    Generates a flat-style SVG badge matching the shields.io aesthetic.
    Left side: dark (#1e1b1b), right side: color-coded by score.
    Font: DejaVu Sans (standard for badges — renders consistently without web fonts).
    """
    left_width = max(len(left_text) * 6.5 + 16, 80)
    right_width = max(len(right_text) * 6.5 + 16, 60)
    total_width = left_width + right_width

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect rx="3" width="{total_width}" height="20" fill="#1e1b1b"/>
  <rect rx="3" x="{left_width}" width="{right_width}" height="20" fill="{right_color}"/>
  <rect x="{left_width}" width="4" height="20" fill="{right_color}"/>
  <rect rx="3" width="{total_width}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{left_width / 2}" y="15" fill="#010101" fill-opacity=".3">{left_text}</text>
    <text x="{left_width / 2}" y="14">{left_text}</text>
    <text x="{left_width + right_width / 2}" y="15" fill="#010101" fill-opacity=".3">{right_text}</text>
    <text x="{left_width + right_width / 2}" y="14">{right_text}</text>
  </g>
</svg>"""


# -----------------------------------------------
# Endpoints
# -----------------------------------------------

@router.get("/api/badge/{project_id}")
async def get_project_badge(project_id: str) -> Response:
    """
    Returns a dynamically-generated SVG badge showing the latest health score.

    No authentication required — called by GitHub's image proxy each time someone
    views a README. Target response time < 200ms (query is single-table, indexed).
    Cache-Control: public, max-age=300 (5-min cache).
    """
    supabase = get_supabase()
    if supabase is None:
        return Response(
            content=_render_badge("Trixon", "unavailable", "#837e80"),
            media_type="image/svg+xml",
            headers=_cache_headers(60),
        )

    try:
        resp = (
            supabase.table("analyses")
            .select("health_score, status, completed_at")
            .eq("project_id", project_id)
            .eq("status", "complete")
            .order("snapshot_number", desc=True)
            .limit(1)
            .execute()
        )

        if not resp.data:
            return Response(
                content=_render_badge("Trixon", "not analyzed", "#837e80"),
                media_type="image/svg+xml",
                headers=_cache_headers(300),
            )

        score = resp.data[0].get("health_score")
        if score is None:
            return Response(
                content=_render_badge("Trixon", "not analyzed", "#837e80"),
                media_type="image/svg+xml",
                headers=_cache_headers(300),
            )

        color = _score_to_color(score)
        label = f"{score}/100"

        return Response(
            content=_render_badge("Trixon Health", label, color),
            media_type="image/svg+xml",
            headers=_cache_headers(300),
        )

    except Exception as e:
        logger.error(f"[badge] Failed to generate badge for {project_id}: {e}")
        return Response(
            content=_render_badge("Trixon", "error", "#837e80"),
            media_type="image/svg+xml",
            headers=_cache_headers(30),
        )


@router.get("/api/public/project/{project_id}")
async def get_public_project(project_id: str) -> dict:
    """
    Returns aggregate project data for the public summary page.

    No authentication required. Deliberately limited to what a founder consented
    to make public by embedding the badge:
      - Project name, repo URL, analyzed date
      - Health + sub-scores
      - Language breakdown, frameworks, third-party services
      - Open action item COUNT only (not the items themselves)
      - Last 5 health score snapshots for sparkline trend

    Does NOT expose: report content, action item details, chat history, key files.
    """
    supabase = get_supabase()
    if supabase is None:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    try:
        # Fetch project metadata
        project_resp = (
            supabase.table("projects")
            .select("repo_name, repo_url")
            .eq("id", project_id)
            .maybe_single()
            .execute()
        )

        if not project_resp.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project = project_resp.data

        # Fetch latest completed analysis
        analysis_resp = (
            supabase.table("analyses")
            .select(
                "id, health_score, security_score, scalability_score, quality_score, "
                "docs_score, language_breakdown, third_party_services, stats, completed_at, snapshot_number"
            )
            .eq("project_id", project_id)
            .eq("status", "complete")
            .order("snapshot_number", desc=True)
            .limit(1)
            .execute()
        )

        if not analysis_resp.data:
            raise HTTPException(status_code=404, detail="No completed analysis found")

        analysis = analysis_resp.data[0]
        analysis_id = analysis["id"]

        # Fetch open action item COUNT only
        action_count_resp = (
            supabase.table("action_items")
            .select("id", count="exact")
            .eq("project_id", project_id)
            .eq("status", "open")
            .limit(1)
            .execute()
        )
        open_count = action_count_resp.count or 0

        # Fetch last 5 snapshots for sparkline
        trend_resp = (
            supabase.table("analyses")
            .select("snapshot_number, health_score")
            .eq("project_id", project_id)
            .eq("status", "complete")
            .order("snapshot_number", desc=True)
            .limit(5)
            .execute()
        )
        # Reverse so trend goes oldest → newest
        snapshot_trend = list(reversed([
            {"snapshot": r["snapshot_number"], "score": r["health_score"]}
            for r in (trend_resp.data or [])
            if r.get("health_score") is not None
        ]))

        # Extract frameworks from stats if available
        stats = analysis.get("stats") or {}
        frameworks = stats.get("frameworks", [])

        # Extract services list
        services_raw = analysis.get("third_party_services") or {}
        services = services_raw.get("services", []) if isinstance(services_raw, dict) else []

        return {
            "project_name": project["repo_name"].split("/")[-1],
            "repo_name": project["repo_name"],
            "repo_url": project["repo_url"],
            "snapshot_number": analysis.get("snapshot_number"),
            "analyzed_at": analysis.get("completed_at"),
            "health_score": analysis.get("health_score"),
            "security_score": analysis.get("security_score"),
            "scalability_score": analysis.get("scalability_score"),
            "quality_score": analysis.get("quality_score"),
            "docs_score": analysis.get("docs_score"),
            "language_breakdown": analysis.get("language_breakdown") or {},
            "frameworks": frameworks,
            "third_party_services": services,
            "open_action_items_count": open_count,
            "snapshot_trend": snapshot_trend,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[public] Failed to fetch public project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
