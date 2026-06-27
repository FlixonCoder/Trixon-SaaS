"""
Trixon Backend — Codebase Search API (v3.6)

Routes:
  POST /api/v1/projects/{project_id}/search — Search code, reports, and action items

Search is purely string-matching — no LLM calls, no cost.
Target P50 response time: < 200ms for typical projects.
"""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Search"])


# -----------------------------------------------
# Request / Response Models
# -----------------------------------------------

class SearchRequest(BaseModel):
    query: str
    search_in: list[Literal["code", "reports", "action_items"]] = ["code", "reports", "action_items"]


class SearchResult(BaseModel):
    result_type: Literal["code", "report", "action_item"]
    title: str           # file path, report type label, or action item title
    snippet: str         # relevant excerpt with context
    line_number: int | None = None    # for code results only
    relevance_score: float            # for sorting
    report_type: str | None = None    # for report results — links to the report page
    item_id: str | None = None        # for action items — enables inline status updates
    severity: str | None = None       # for action items
    category: str | None = None       # for action items
    ai_prompt: str | None = None      # for action items
    status: str | None = None         # for action items


REPORT_LABELS: dict[str, str] = {
    "executive_summary": "Executive Summary",
    "architecture": "Architecture",
    "tech_debt": "Tech Debt",
    "security": "Security Risk Scan",
    "scalability": "Can It Handle Growth?",
    "onboarding": "Dev Onboarding Guide",
    "investor": "Investor Technical Summary",
    "team_readiness": "Team Readiness Report",
}


# -----------------------------------------------
# Search Helper Functions
# -----------------------------------------------

def _highlight_snippet(text: str, query: str, context_chars: int = 120) -> str:
    """
    Extracts a snippet of text around the first match, centered on the match.
    Returns up to context_chars * 2 characters of context.
    """
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx == -1:
        # Fallback: return start of text
        return text[:context_chars * 2].strip()

    start = max(0, idx - context_chars)
    end = min(len(text), idx + len(query) + context_chars)
    snippet = text[start:end].strip()

    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"

    return snippet


def _search_code(project_id: str, query: str, supabase) -> list[SearchResult]:
    """
    Scans key_files from latest code_snapshot for the project.
    Plain string matching with ±2 lines of context around each match.
    """
    # Get latest completed analysis ID
    latest_resp = (
        supabase.table("analyses")
        .select("id")
        .eq("project_id", project_id)
        .eq("status", "complete")
        .order("snapshot_number", desc=True)
        .limit(1)
        .execute()
    )

    if not latest_resp.data:
        return []

    analysis_id = latest_resp.data[0]["id"]

    # Fetch key_files from snapshot
    snapshot_resp = (
        supabase.table("code_snapshots")
        .select("key_files")
        .eq("analysis_id", analysis_id)
        .maybe_single()
        .execute()
    )

    if not snapshot_resp.data:
        return []

    key_files: dict = snapshot_resp.data.get("key_files") or {}
    query_lower = query.lower()
    results: list[SearchResult] = []

    for file_path, content in key_files.items():
        if not isinstance(content, str):
            continue
        lines = content.splitlines()
        for i, line in enumerate(lines):
            if query_lower in line.lower():
                # Get ±2 lines of context
                start = max(0, i - 2)
                end = min(len(lines), i + 3)
                context_lines = lines[start:end]
                snippet = "\n".join(context_lines)

                # Exact case match scores higher
                relevance = 1.0 if query in line else 0.7

                results.append(SearchResult(
                    result_type="code",
                    title=file_path,
                    snippet=snippet,
                    line_number=i + 1,
                    relevance_score=relevance,
                ))

                # Cap per-file matches to avoid flooding results with one file
                if sum(1 for r in results if r.title == file_path) >= 5:
                    break

    return results


def _search_reports(project_id: str, query: str, supabase) -> list[SearchResult]:
    """
    Scans content_markdown across all reports for the latest completed analysis.
    """
    latest_resp = (
        supabase.table("analyses")
        .select("id")
        .eq("project_id", project_id)
        .eq("status", "complete")
        .order("snapshot_number", desc=True)
        .limit(1)
        .execute()
    )

    if not latest_resp.data:
        return []

    analysis_id = latest_resp.data[0]["id"]

    reports_resp = (
        supabase.table("reports")
        .select("id, report_type, content_markdown")
        .eq("analysis_id", analysis_id)
        .execute()
    )

    if not reports_resp.data:
        return []

    query_lower = query.lower()
    results: list[SearchResult] = []

    for report in reports_resp.data:
        content = report.get("content_markdown") or ""
        if query_lower not in content.lower():
            continue

        snippet = _highlight_snippet(content, query, context_chars=120)
        label = REPORT_LABELS.get(report["report_type"], report["report_type"].replace("_", " ").title())

        results.append(SearchResult(
            result_type="report",
            title=label,
            snippet=snippet,
            line_number=None,
            relevance_score=0.8,
            report_type=report["report_type"],
        ))

    return results


def _search_action_items(project_id: str, query: str, supabase) -> list[SearchResult]:
    """
    Scans title and description fields of all action items for this project.
    """
    items_resp = (
        supabase.table("action_items")
        .select("id, title, description, severity, category, ai_prompt, status")
        .eq("project_id", project_id)
        .neq("status", "resolved")
        .execute()
    )

    if not items_resp.data:
        return []

    query_lower = query.lower()
    results: list[SearchResult] = []

    for item in items_resp.data:
        title = item.get("title") or ""
        description = item.get("description") or ""
        combined = f"{title} {description}"

        if query_lower not in combined.lower():
            continue

        # Relevance: higher if match is in title
        relevance = 0.95 if query_lower in title.lower() else 0.75

        snippet = _highlight_snippet(description, query) if description else title

        results.append(SearchResult(
            result_type="action_item",
            title=title,
            snippet=snippet,
            line_number=None,
            relevance_score=relevance,
            item_id=item["id"],
            severity=item.get("severity"),
            category=item.get("category"),
            ai_prompt=item.get("ai_prompt"),
            status=item.get("status"),
        ))

    return results


# -----------------------------------------------
# Search Endpoint
# -----------------------------------------------

@router.post("/projects/{project_id}/search")
async def search_project(
    project_id: str,
    body: SearchRequest,
    user: CurrentUser,
) -> dict:
    """
    Search across code, reports, and action items for a project.

    Ownership is verified — user must own the project.
    Results are sorted by relevance score and capped at 20.
    Search is purely string-matching (no LLM calls, no cost).
    """
    query = body.query.strip()
    if not query or len(query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

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

    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    results: list[SearchResult] = []

    try:
        if "code" in body.search_in:
            code_results = _search_code(project_id, query, supabase)
            results.extend(code_results)
            logger.info(f"[search] Code results for '{query}' in {project_id}: {len(code_results)}")

        if "reports" in body.search_in:
            report_results = _search_reports(project_id, query, supabase)
            results.extend(report_results)
            logger.info(f"[search] Report results for '{query}' in {project_id}: {len(report_results)}")

        if "action_items" in body.search_in:
            action_results = _search_action_items(project_id, query, supabase)
            results.extend(action_results)
            logger.info(f"[search] Action item results for '{query}' in {project_id}: {len(action_results)}")

    except Exception as e:
        logger.error(f"[search] Search failed for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

    # Sort by relevance (descending) and cap at 20
    results.sort(key=lambda x: x.relevance_score, reverse=True)
    top_results = results[:20]

    return {
        "query": query,
        "total": len(results),
        "results": [r.model_dump() for r in top_results],
    }
