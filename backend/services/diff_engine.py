"""
Trixon Backend — Diff Engine (v3.0)

Computes diffs between analysis snapshots:
- Matches action_items between snapshots (resolved vs new vs unchanged)
- Computes score deltas
- Determines verdict (improved/regressed/mixed/no_change)
- Generates AI changelog summary (1 LLM call)
- Stores analysis_diffs record

Called as the final step of analyze_project() when snapshot_number > 1.
"""

import logging
from datetime import datetime, timezone
from difflib import SequenceMatcher

from backend.core.supabase_client import get_supabase
from backend.services.llm_client import generate_changelog_summary

logger = logging.getLogger(__name__)


def compute_diff(
    project_id: str,
    new_analysis_id: str,
    previous_analysis_id: str,
) -> dict | None:
    """
    Compute the diff between two snapshots and store it in analysis_diffs.
    
    Args:
        project_id: UUID of the project
        new_analysis_id: UUID of the new (latest) analysis
        previous_analysis_id: UUID of the previous analysis to compare against
    
    Returns:
        The created analysis_diff record dict, or None on failure
    """
    supabase = get_supabase()
    if supabase is None:
        logger.error(f"[diff] Supabase unavailable — cannot compute diff")
        return None

    try:
        # --- Fetch action items for both snapshots ---
        new_items_resp = (
            supabase.table("action_items")
            .select("*")
            .eq("analysis_id", new_analysis_id)
            .execute()
        )
        prev_items_resp = (
            supabase.table("action_items")
            .select("*")
            .eq("analysis_id", previous_analysis_id)
            .eq("status", "open")  # Only diff against items that weren't already resolved/ignored
            .execute()
        )

        new_items = new_items_resp.data or []
        prev_items = prev_items_resp.data or []

        logger.info(
            f"[diff] Comparing {len(new_items)} new items vs {len(prev_items)} previous items"
        )

        # --- Match items between snapshots ---
        resolved = []
        new_findings = []
        unchanged = []

        for prev_item in prev_items:
            matched = _find_match(prev_item, new_items)
            if matched:
                unchanged.append(prev_item)
            else:
                resolved.append(prev_item)

        for new_item in new_items:
            if not _find_match(new_item, prev_items):
                new_findings.append(new_item)

        logger.info(
            f"[diff] Resolved: {len(resolved)}, New: {len(new_findings)}, Unchanged: {len(unchanged)}"
        )

        # --- Mark resolved items in DB ---
        for item in resolved:
            try:
                supabase.table("action_items").update({
                    "status": "resolved",
                    "resolved_in_analysis_id": new_analysis_id,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", item["id"]).execute()
            except Exception as e:
                logger.warning(f"[diff] Failed to mark item {item['id']} as resolved: {e}")

        # --- Compute score deltas ---
        score_deltas = _compute_score_deltas(supabase, new_analysis_id, previous_analysis_id)
        logger.info(f"[diff] Score deltas: {score_deltas}")

        # --- Determine verdict ---
        verdict = _determine_verdict(score_deltas, resolved, new_findings)
        logger.info(f"[diff] Verdict: {verdict}")

        # --- Generate changelog summary ---
        commit_message = _get_commit_message(supabase, new_analysis_id)
        try:
            summary_markdown = generate_changelog_summary(
                resolved=resolved,
                new_findings=new_findings,
                score_deltas=score_deltas,
                commit_message=commit_message,
            )
        except Exception as e:
            logger.warning(f"[diff] Changelog summary generation failed: {e}")
            summary_markdown = _fallback_summary(resolved, new_findings, score_deltas)

        # --- Store the diff ---
        diff_record = {
            "project_id": project_id,
            "from_analysis_id": previous_analysis_id,
            "to_analysis_id": new_analysis_id,
            "score_deltas": score_deltas,
            "resolved_findings": _slim_items(resolved),
            "new_findings": _slim_items(new_findings),
            "unchanged_findings": _slim_items(unchanged),
            "verdict": verdict,
            "summary_markdown": summary_markdown,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = supabase.table("analysis_diffs").insert(diff_record).execute()
        created = result.data[0] if result.data else diff_record

        logger.info(
            f"[diff] Created analysis_diff record. "
            f"Verdict: {verdict}, resolved: {len(resolved)}, new: {len(new_findings)}"
        )
        return created

    except Exception as e:
        logger.exception(f"[diff] Unexpected error computing diff: {e}")
        return None


def _find_match(item: dict, candidates: list[dict]) -> dict | None:
    """
    Find a matching item in candidates using title similarity + category.
    Uses SequenceMatcher for fuzzy title matching (threshold: 0.75).
    """
    item_title = item.get("title", "").lower().strip()
    item_category = item.get("category", "")

    for candidate in candidates:
        cand_title = candidate.get("title", "").lower().strip()
        cand_category = candidate.get("category", "")

        if item_category != cand_category:
            continue

        # Exact match
        if item_title == cand_title:
            return candidate

        # Fuzzy match
        ratio = SequenceMatcher(None, item_title, cand_title).ratio()
        if ratio >= 0.75:
            return candidate

    return None


def _compute_score_deltas(supabase, new_id: str, prev_id: str) -> dict:
    """Fetch scores for both analyses and compute deltas."""
    try:
        new_resp = supabase.table("analyses").select(
            "health_score,security_score,scalability_score,quality_score,docs_score"
        ).eq("id", new_id).single().execute()

        prev_resp = supabase.table("analyses").select(
            "health_score,security_score,scalability_score,quality_score,docs_score"
        ).eq("id", prev_id).single().execute()

        new_scores = new_resp.data or {}
        prev_scores = prev_resp.data or {}

        return {
            "health":       _delta(new_scores.get("health_score"), prev_scores.get("health_score")),
            "security":     _delta(new_scores.get("security_score"), prev_scores.get("security_score")),
            "scalability":  _delta(new_scores.get("scalability_score"), prev_scores.get("scalability_score")),
            "quality":      _delta(new_scores.get("quality_score"), prev_scores.get("quality_score")),
            "docs":         _delta(new_scores.get("docs_score"), prev_scores.get("docs_score")),
        }
    except Exception as e:
        logger.warning(f"[diff] Score delta computation failed: {e}")
        return {"health": 0, "security": 0, "scalability": 0, "quality": 0, "docs": 0}


def _delta(new_val, prev_val) -> int:
    if new_val is None or prev_val is None:
        return 0
    return int(new_val) - int(prev_val)


def _determine_verdict(
    score_deltas: dict,
    resolved: list,
    new_findings: list,
) -> str:
    """
    Determine the overall verdict based on score changes and finding counts.
    - 'improved': net positive (scores up OR resolved > new)
    - 'regressed': net negative (scores down OR new > resolved)  
    - 'mixed': both improvements and regressions
    - 'no_change': nothing changed significantly
    """
    # Filter out None/null values
    valid_deltas = [v for v in score_deltas.values() if isinstance(v, (int, float))]
    net_score = sum(valid_deltas)
    
    has_improvements = any(v > 0 for v in valid_deltas)
    has_regressions = any(v < 0 for v in valid_deltas)

    resolved_count = len(resolved)
    new_count = len(new_findings)

    findings_improved = resolved_count > 0 and new_count == 0
    findings_regressed = new_count > 0 and resolved_count == 0
    findings_mixed = resolved_count > 0 and new_count > 0

    if findings_mixed or (has_improvements and has_regressions) or (has_improvements and findings_regressed) or (has_regressions and findings_improved):
        return "mixed"
    elif net_score > 0 or findings_improved:
        return "improved"
    elif net_score < 0 or findings_regressed:
        return "regressed"
    else:
        return "no_change"


def _get_commit_message(supabase, analysis_id: str) -> str | None:
    """Fetch commit_message for an analysis."""
    try:
        resp = supabase.table("analyses").select("commit_message").eq("id", analysis_id).single().execute()
        return resp.data.get("commit_message") if resp.data else None
    except Exception:
        return None


def _slim_items(items: list[dict]) -> list[dict]:
    """Return a slimmed-down version of action items for JSONB storage."""
    return [
        {
            "id": item.get("id"),
            "title": item.get("title"),
            "category": item.get("category"),
            "severity": item.get("severity"),
            "effort_level": item.get("effort_level"),
        }
        for item in items
    ]


def _fallback_summary(resolved: list, new_findings: list, score_deltas: dict) -> str:
    """Deterministic fallback if LLM summary generation fails."""
    net_health = score_deltas.get("health", 0)
    r, n = len(resolved), len(new_findings)
    if r > 0 and n == 0:
        return f"This snapshot resolved {r} issue(s). Health score changed by {net_health:+d} points."
    elif n > 0 and r == 0:
        return f"This snapshot introduced {n} new issue(s). Health score changed by {net_health:+d} points."
    elif r > 0 and n > 0:
        return f"This snapshot resolved {r} issue(s) and introduced {n} new one(s). Net health: {net_health:+d}."
    else:
        return "No significant changes detected in this snapshot."
