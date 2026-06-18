"""
Trixon Backend — Project Chat API Routes (v3.3)

Routes:
  GET  /api/v1/projects/{id}/chat  — Paginated chat history
  POST /api/v1/projects/{id}/chat  — Send message (SSE streaming)

v3.3 Changes:
  - Strict system prompt with topic boundaries (refuses off-topic questions)
  - Report content fetched from Supabase reports table and injected into context
  - Lightweight keyword-based retrieval: only relevant reports sent per message
  - Context injected in user turn (not system), keeping rolling history clean
  - Only the user's original question stored in project_chats (not context block)

TPM Protection:
  If an analysis is queued/running for this project when a chat message is sent,
  the endpoint returns HTTP 202 with a "Trixon is busy" message instead of making
  a Groq API call. This prevents TPM budget collisions during active analysis jobs.
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.core.auth import CurrentUser
from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["chat"])

# In-memory set of project IDs with active chat requests
_active_chat_projects: set[str] = set()

MAX_HISTORY_FOR_CONTEXT = 10  # Rolling window of messages to include as context

# -----------------------------------------------
# System Prompt — Strict Boundaries (v3.3)
# -----------------------------------------------

CHAT_SYSTEM_PROMPT = """You are Trixon, an AI technical advisor embedded in the Trixon platform.

You have been given full context about a specific software project: its codebase analysis, generated reports, open action items, and conversation history. Your entire job is to help the founder understand and improve THIS specific project.

STRICT RULES:
1. You ONLY answer questions about the connected project ({project_name}, repo: {repo_url}).
2. If asked anything unrelated to this project's codebase, architecture, security, tech debt, scalability, team readiness, or developer onboarding, you must decline. Say: "I can only help with questions about your {project_name} codebase. What would you like to know about it?"
3. Never answer general knowledge questions (geography, sports, definitions, news, etc.).
4. Never answer questions about other projects or codebases not in your context.
5. You have access to the generated reports, action items, and analysis history for this project. Reference them specifically — do not give generic advice.
6. Always end your response with a concrete next step the founder can take.
7. If you don't know the answer from the provided context, say so honestly rather than guessing.

Current project context is provided below. Use it as your exclusive source of truth."""

# -----------------------------------------------
# Keyword → Report Mapping (v3.3 Lightweight Retrieval)
# -----------------------------------------------

REPORT_KEYWORD_MAP: dict[str, list[str]] = {
    "executive_summary": [
        "overview", "summary", "what did you build", "what is this",
        "explain", "what does this do", "describe", "general", "executive",
        "what is", "tell me about", "overview of"
    ],
    "architecture": [
        "architecture", "how does it work", "structure", "components",
        "frontend", "backend", "database", "connect", "flow", "system design",
        "services", "api", "how is it built", "design", "layers", "modules"
    ],
    "tech_debt": [
        "tech debt", "messy", "refactor", "clean up", "improve", "quality",
        "todo", "fixme", "issues", "problems", "code quality", "maintainability",
        "debt", "cleanup", "smells", "duplicate"
    ],
    "security": [
        "security", "vulnerability", "exploit", "secret", "key", "token",
        "auth", "authentication", "authorization", "password", "exposed",
        "hardcoded", "env", "environment variable", "risk", "safe", "secure",
        "injection", "xss", "csrf", "breach", "hack", "attack"
    ],
    "scalability": [
        "scale", "scalability", "performance", "slow", "bottleneck",
        "10x", "growth", "load", "traffic", "users", "handle", "capacity",
        "concurrent", "latency", "throughput", "optimize"
    ],
    "onboarding": [
        "onboard", "new developer", "hire", "team", "join", "getting started",
        "setup", "how to start", "contribute", "new hire", "documentation",
        "readme", "docs", "setup guide", "developer"
    ],
    "investor": [
        "investor", "due diligence", "raise", "funding", "pitch",
        "investment", "vc", "valuation", "technical summary", "audit",
        "investor report", "fundraise"
    ],
}

TOKEN_BUDGET_FOR_REPORTS = 3000  # chars / 4 ≈ tokens; leaves room for history + scores


# -----------------------------------------------
# Request / Response Models
# -----------------------------------------------

class ChatMessageRequest(BaseModel):
    message: str


# -----------------------------------------------
# GET — Chat History
# -----------------------------------------------

@router.get("/projects/{project_id}/chat")
async def get_chat_history(
    project_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, le=50),
    user: CurrentUser = None,
):
    """Paginated chat history for a project."""
    user_id = user["id"] if user else None
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

    offset = (page - 1) * page_size
    result = (
        supabase.table("project_chats")
        .select("id, role, content, created_at, referenced_action_items")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(page_size)
        .offset(offset)
        .execute()
    )

    messages = list(reversed(result.data or []))

    return {
        "messages": messages,
        "page": page,
        "page_size": page_size,
        "total": len(messages),
    }


# -----------------------------------------------
# POST — Send Chat Message (SSE streaming)
# -----------------------------------------------

@router.post("/projects/{project_id}/chat")
async def send_chat_message(
    project_id: str,
    body: ChatMessageRequest,
    user: CurrentUser,
):
    """
    Send a chat message and receive a streamed response.
    Returns text/event-stream for incremental rendering.
    Returns 202 + busy message if an analysis is running.
    """
    user_id = user["id"]
    supabase = get_supabase()

    # Verify ownership
    project_resp = (
        supabase.table("projects")
        .select("id, repo_name, repo_url")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_name = project_resp.data.get("repo_name", "your repo")
    repo_url = project_resp.data.get("repo_url", "")

    # -----------------------------------------------
    # TPM Busy Guard: Check for active analysis jobs
    # -----------------------------------------------
    active_analysis_resp = (
        supabase.table("analyses")
        .select("id, status")
        .eq("project_id", project_id)
        .in_("status", ["queued", "running"])
        .limit(1)
        .execute()
    )

    if active_analysis_resp.data:
        busy_message = (
            "Trixon is busy analyzing your latest commit right now — "
            "I'll be ready in about 2-3 minutes. Try asking again shortly!"
        )
        _store_message(supabase, project_id, user_id, "user", body.message)
        _store_message(supabase, project_id, user_id, "assistant", busy_message)

        async def busy_stream():
            yield f"data: {busy_message}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            busy_stream(),
            status_code=202,
            media_type="text/event-stream",
            headers={
                "X-Trixon-Busy": "true",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # -----------------------------------------------
    # Concurrency Guard: 1 active chat per project
    # -----------------------------------------------
    if project_id in _active_chat_projects:
        raise HTTPException(
            status_code=429,
            detail="Another chat request is in progress for this project. Please wait.",
        )

    _active_chat_projects.add(project_id)

    try:
        # -----------------------------------------------
        # Fetch rolling chat history
        # -----------------------------------------------
        history_resp = (
            supabase.table("project_chats")
            .select("role, content")
            .eq("project_id", project_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(MAX_HISTORY_FOR_CONTEXT)
            .execute()
        )
        db_history = list(reversed(history_resp.data or []))

        # -----------------------------------------------
        # Build context (system prompt + context block)
        # -----------------------------------------------
        system_prompt, context_block = await _build_chat_context(
            supabase, project_id, body.message, repo_name, repo_url
        )

        # -----------------------------------------------
        # Assemble messages for the LLM
        # Context is prepended to the user turn, not as a separate system message.
        # This keeps rolling history clean (stores only the original question).
        # -----------------------------------------------
        messages = []

        # Rolling chat history (raw questions + answers, not context blocks)
        for msg in db_history:
            messages.append({"role": msg["role"], "content": msg["content"]})

        # Current user message WITH context prepended
        messages.append({
            "role": "user",
            "content": (
                f"Here is the current context for this project:\n\n"
                f"{context_block}\n\n"
                f"---\n\n"
                f"My question: {body.message}"
            ),
        })

        # -----------------------------------------------
        # Store the user's ORIGINAL message (not context block)
        # -----------------------------------------------
        _store_message(supabase, project_id, user_id, "user", body.message)

        # -----------------------------------------------
        # Stream response from Groq
        # -----------------------------------------------
        full_response: list[str] = []

        async def generate_stream():
            try:
                from backend.services.providers.groq import stream_chat_groq
                import json

                gen = stream_chat_groq(
                    messages=messages,
                    system_prompt=system_prompt,
                )

                for chunk in gen:
                    full_response.append(chunk)
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                    await asyncio.sleep(0)

                yield "data: [DONE]\n\n"

            except Exception as e:
                error_msg = f"Sorry, I encountered an error: {str(e)}"
                full_response.append(error_msg)
                yield f"data: {error_msg}\n\n"
                yield "data: [DONE]\n\n"
            finally:
                if full_response:
                    complete_response = "".join(full_response)
                    _store_message(supabase, project_id, user_id, "assistant", complete_response)

                _active_chat_projects.discard(project_id)

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except HTTPException:
        _active_chat_projects.discard(project_id)
        raise
    except Exception as e:
        _active_chat_projects.discard(project_id)
        logger.error(f"Chat error for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------
# v3.3 Core Helpers
# -----------------------------------------------

def _fetch_project_reports(supabase, project_id: str, analysis_id: str) -> dict[str, str]:
    """
    Fetches report markdown content from the reports table.
    Returns a dict keyed by report_type: { 'executive_summary': '...', ... }
    Only fetches reports that are selected in analyses.selected_reports for this analysis.
    """
    try:
        analysis_resp = (
            supabase.table("analyses")
            .select("selected_reports")
            .eq("id", analysis_id)
            .maybe_single()
            .execute()
        )
        if not analysis_resp or not analysis_resp.data:
            return {}

        selected = analysis_resp.data.get("selected_reports") or []
        reports: dict[str, str] = {}

        for report_type in selected:
            row = (
                supabase.table("reports")
                .select("content_markdown")
                .eq("analysis_id", analysis_id)
                .eq("report_type", report_type)
                .maybe_single()
                .execute()
            )
            if row and row.data and row.data.get("content_markdown"):
                reports[report_type] = row.data["content_markdown"]

        return reports
    except Exception as e:
        logger.warning(f"Failed to fetch project reports for analysis {analysis_id}: {e}")
        return {}


def _retrieve_relevant_reports(user_message: str, available_reports: dict[str, str]) -> str:
    """
    Selects which report(s) to include based on keyword matching against the user's message.
    Returns a formatted string of selected report content, token-budgeted.
    Falls back to executive_summary if no keywords match.
    """
    message_lower = user_message.lower()
    scores: dict[str, int] = {}

    for report_type, keywords in REPORT_KEYWORD_MAP.items():
        if report_type not in available_reports:
            continue
        match_count = sum(1 for kw in keywords if kw in message_lower)
        if match_count > 0:
            scores[report_type] = match_count

    # Sort by most keyword matches, take top 2
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    selected_types = [r[0] for r in ranked[:2]]

    # Fallback: if no keywords matched, use executive_summary
    if not selected_types and "executive_summary" in available_reports:
        selected_types = ["executive_summary"]

    context_parts: list[str] = []
    used_chars = 0
    budget_chars = TOKEN_BUDGET_FOR_REPORTS * 4  # ~chars per token

    for report_type in selected_types:
        content = available_reports[report_type]
        if used_chars + len(content) > budget_chars:
            remaining = budget_chars - used_chars
            content = content[:remaining] + "\n\n[Report truncated for context window]"
            context_parts.append(f"### {report_type.replace('_', ' ').title()} Report\n{content}")
            break
        context_parts.append(f"### {report_type.replace('_', ' ').title()} Report\n{content}")
        used_chars += len(content)

    return "\n\n---\n\n".join(context_parts)


async def _build_chat_context(
    supabase,
    project_id: str,
    user_message: str,
    repo_name: str,
    repo_url: str,
) -> tuple[str, str]:
    """
    Returns (system_prompt, context_block) ready to pass to the LLM.
    system_prompt: strict boundary prompt with project name interpolated
    context_block: scores + action items + diff + relevant report content
    """
    system_prompt = CHAT_SYSTEM_PROMPT.format(project_name=repo_name, repo_url=repo_url)

    # 1. Fetch latest completed analysis with commit info
    latest_resp = (
        supabase.table("analyses")
        .select("id, health_score, security_score, scalability_score, quality_score, docs_score, "
                "completed_at, snapshot_number, language_breakdown, stats, commit_sha, commit_message, commit_author, trigger_source")
        .eq("project_id", project_id)
        .eq("status", "complete")
        .order("snapshot_number", desc=True)
        .limit(1)
        .execute()
    )
    latest = latest_resp.data[0] if (latest_resp and latest_resp.data) else None

    # 1b. Fetch recent snapshot history (up to 5)
    history_resp = (
        supabase.table("analyses")
        .select("snapshot_number, commit_sha, commit_message, commit_author, completed_at, health_score")
        .eq("project_id", project_id)
        .eq("status", "complete")
        .order("snapshot_number", desc=True)
        .limit(5)
        .execute()
    )
    history = history_resp.data if history_resp else []

    if not latest:
        return system_prompt, "No completed analysis found for this project yet."

    # 2. Fetch open action items (top 8 by severity)
    items_resp = (
        supabase.table("action_items")
        .select("title, category, severity, effort_level, description")
        .eq("project_id", project_id)
        .eq("status", "open")
        .order("severity")
        .limit(8)
        .execute()
    )
    action_items = items_resp.data or []

    # 3. Fetch latest diff summary
    diff_resp = (
        supabase.table("analysis_diffs")
        .select("verdict, summary_markdown, score_deltas")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    latest_diff = diff_resp.data[0] if (diff_resp and diff_resp.data) else None

    # 4. Fetch reports and do keyword-based retrieval
    available_reports = _fetch_project_reports(supabase, project_id, latest["id"])
    relevant_report_context = _retrieve_relevant_reports(user_message, available_reports)

    # 5. Build language/stats block
    langs = latest.get("language_breakdown") or {}
    lang_str = ", ".join(f"{l} ({p}%)" for l, p in list(langs.items())[:5]) if langs else "not analyzed"
    stats = latest.get("stats") or {}

    # 6. Assemble context block
    scores_block = (
        f"## Project: {repo_name}\n"
        f"Last analyzed: Snapshot #{latest.get('snapshot_number', '?')} "
        f"({(latest.get('completed_at') or '')[:10]})\n"
        f"Languages: {lang_str}\n"
        f"Files: {stats.get('total_files', '?')} | Lines: {stats.get('total_lines', '?')}\n\n"
        f"### Health Scores\n"
        f"- Overall: {latest.get('health_score', '?')}/100\n"
        f"- Security: {latest.get('security_score', '?')}/100\n"
        f"- Scalability: {latest.get('scalability_score', '?')}/100\n"
        f"- Quality: {latest.get('quality_score', '?')}/100\n"
        f"- Documentation: {latest.get('docs_score', '?')}/100"
    )

    action_items_block = "### Open Action Items\n" + "\n".join([
        f"- [{item['severity'].upper()}] {item['title']} ({item.get('effort_level', 'unknown')} effort)"
        for item in action_items
    ]) if action_items else "### Open Action Items\nNo open items."

    commit_block = ""
    if latest and latest.get("commit_sha"):
        commit_block = f"""### Latest Commit
- SHA: `{latest['commit_sha'][:8]}`
- Message: {latest.get('commit_message') or 'No commit message'}
- Author: {latest.get('commit_author') or 'Unknown'}
- Analysis triggered by: {latest.get('trigger_source', 'manual')}"""

    diff_block = ""
    if latest_diff:
        verdict = latest_diff.get("verdict", "").upper()
        summary = latest_diff.get("summary_markdown") or ""
        diff_block = f"### Latest Change Summary\nVerdict: {verdict}\n{summary}"

    history_block = ""
    if history and len(history) > 1:
        history_lines = []
        for s in history:
            completed_str = (s.get("completed_at") or "")[:10]
            line = f"- Snapshot #{s['snapshot_number']} ({completed_str}): health {s['health_score']}/100"
            if s.get("commit_sha"):
                line += f" — `{s['commit_sha'][:8]}` {(s.get('commit_message') or '')[:60]}"
            history_lines.append(line)
        history_block = "### Recent Snapshot History\n" + "\n".join(history_lines)

    report_block = (
        f"### Relevant Report Content\n{relevant_report_context}"
        if relevant_report_context
        else ""
    )

    context_parts = [scores_block, action_items_block]
    if commit_block:
        context_parts.append(commit_block)
    if diff_block:
        context_parts.append(diff_block)
    if history_block:
        context_parts.append(history_block)
    if report_block:
        context_parts.append(report_block)

    context_block = "\n\n".join(context_parts)
    return system_prompt, context_block


# -----------------------------------------------
# Storage Helper
# -----------------------------------------------

def _store_message(
    supabase,
    project_id: str,
    user_id: str,
    role: str,
    content: str,
) -> None:
    """Store a chat message in project_chats table."""
    try:
        supabase.table("project_chats").insert({
            "project_id": project_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.error(f"Failed to store chat message: {e}")
