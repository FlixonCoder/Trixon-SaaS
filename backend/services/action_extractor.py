"""
Trixon Backend — Action Item Extractor (v3.4)

Extracts structured action_items from already-generated report JSON.
No extra LLM call needed — the content_json has severity/title/description.
Only the ai_prompt uses a deterministic template.

v3.4 changes:
  - Fixed forward reference bug (REPORT_EXTRACTORS was defined before functions)
  - Rewrote extract_and_store_action_items() to accept either report_outputs list
    OR direct findings dict (for backfill route)
  - Added extract_from_report_json() for post-hoc extraction from stored reports
  - generate_ai_prompt_template() replaces LLM call — deterministic, no API call needed
  - All extractor functions handle BOTH old JSON schemas AND new flat findings schema
"""

import logging
from datetime import datetime, timezone

from backend.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

SEVERITY_NORMALIZE = {
    "critical": "critical", "high": "high", "medium": "medium", "low": "low",
    "Critical": "critical", "High": "high", "Medium": "medium", "Low": "low",
    "CRITICAL": "critical", "HIGH": "high", "MEDIUM": "medium", "LOW": "low",
}

EFFORT_NORMALIZE = {
    "quick-win": "quick-win", "quick_win": "quick-win",
    "moderate": "moderate",
    "complex": "complex",
    "architectural": "architectural",
}

# Reports that produce extractable findings
EXTRACTABLE_REPORT_TYPES = {"tech_debt", "security", "scalability"}


# -----------------------------------------------
# Public API
# -----------------------------------------------

def extract_and_store_action_items(
    report_outputs: list,  # list of llm_client.ReportOutput
    analysis_id: str,
    project_id: str,
    repo_name: str,
) -> int:
    """
    Extract action items from report outputs and store them in Supabase.
    Performs smart deduplication of existing open/in-progress items
    and auto-resolves any items from processed categories that are no longer found.

    Args:
        report_outputs: List of ReportOutput objects from the analysis pipeline
        analysis_id: UUID of the current analysis
        project_id: UUID of the project
        repo_name: Repository name for prompt context

    Returns:
        Number of new action items created
    """
    supabase = get_supabase()
    if supabase is None:
        logger.error(f"[{analysis_id}] Supabase unavailable — skipping action item extraction")
        return 0

    # 1. Fetch all existing action items for this project
    existing_items = []
    try:
        existing_resp = (
            supabase.table("action_items")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )
        existing_items = existing_resp.data or []
    except Exception as e:
        logger.error(f"[{analysis_id}] Failed to fetch existing action items: {e}")

    # Index existing open/in-progress items by (category, title)
    active_existing = {}
    for item in existing_items:
        if item.get("status") in ("open", "in_progress"):
            key = (item.get("category"), item.get("title"))
            active_existing[key] = item

    total_created = 0
    new_findings = []
    processed_categories = set()
    matched_existing_ids = set()

    # 2. Extract and match findings
    for output in report_outputs:
        if output.error:
            logger.debug(f"[{analysis_id}] Skipping {output.report_type} — has error")
            continue

        if output.report_type not in EXTRACTABLE_REPORT_TYPES:
            continue

        content_json = output.content_json
        if not content_json:
            logger.warning(f"[{analysis_id}] {output.report_type}: content_json is empty — skipping extraction")
            continue

        processed_categories.add(output.report_type)

        try:
            items = _extract_findings(output.report_type, content_json, repo_name)
            logger.info(f"[{analysis_id}] Extracted {len(items)} action items from {output.report_type}")

            for item in items:
                key = (item["category"], item["title"])
                if key in active_existing:
                    # Match found! Update the existing action item's metadata and analysis_id
                    existing_item = active_existing[key]
                    matched_existing_ids.add(existing_item["id"])
                    try:
                        supabase.table("action_items").update({
                            "analysis_id": analysis_id,
                            "description": item["description"],
                            "severity": item["severity"],
                            "effort_level": item["effort_level"],
                            "ai_prompt": item["ai_prompt"],
                            "file_paths": item["file_paths"],
                        }).eq("id", existing_item["id"]).execute()
                    except Exception as u_err:
                        logger.warning(f"[{analysis_id}] Failed to update matched action item {existing_item['id']}: {u_err}")
                else:
                    # No match: it's a new finding!
                    item["analysis_id"] = analysis_id
                    item["project_id"] = project_id
                    item["first_detected_at"] = datetime.now(timezone.utc).isoformat()
                    item["created_at"] = datetime.now(timezone.utc).isoformat()
                    new_findings.append(item)

        except Exception as e:
            logger.error(f"[{analysis_id}] Action item extraction failed for {output.report_type}: {e}", exc_info=True)

    # 3. Store new findings in Supabase
    if new_findings:
        try:
            result = supabase.table("action_items").insert(new_findings).execute()
            inserted = len(result.data) if result.data else len(new_findings)
            total_created += inserted
            logger.info(f"[{analysis_id}] Inserted {inserted} new action items")
        except Exception as i_err:
            logger.error(f"[{analysis_id}] Failed to insert new action items: {i_err}")

    # 4. Auto-resolve existing open/in-progress items that were NOT matched
    # and belong to categories that were processed in this run.
    items_to_resolve = []
    for item in existing_items:
        if item.get("status") in ("open", "in_progress"):
            category = item.get("category")
            if category in processed_categories and item["id"] not in matched_existing_ids:
                items_to_resolve.append(item["id"])

    if items_to_resolve:
        logger.info(f"[{analysis_id}] Auto-resolving {len(items_to_resolve)} action items not found in current run")
        for item_id in items_to_resolve:
            try:
                supabase.table("action_items").update({
                    "status": "resolved",
                    "resolved_in_analysis_id": analysis_id,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", item_id).execute()
            except Exception as r_err:
                logger.error(f"[{analysis_id}] Failed to resolve action item {item_id}: {r_err}")

    return total_created


def extract_from_report_json(
    report_type: str,
    content_json: dict,
    project_id: str,
    analysis_id: str,
    repo_name: str,
) -> int:
    """
    Extract action items from a stored report's content_json.
    Used for backfill of existing analyses.
    Includes deduplication and auto-resolution for this specific report category.
    """
    if report_type not in EXTRACTABLE_REPORT_TYPES:
        return 0

    supabase = get_supabase()
    if supabase is None:
        return 0

    # 1. Fetch existing action items for this project
    existing_items = []
    try:
        existing_resp = (
            supabase.table("action_items")
            .select("*")
            .eq("project_id", project_id)
            .execute()
        )
        existing_items = existing_resp.data or []
    except Exception as e:
        logger.error(f"[backfill] Failed to fetch existing items: {e}")

    # Index open/in-progress items
    active_existing = {}
    for item in existing_items:
        if item.get("status") in ("open", "in_progress"):
            key = (item.get("category"), item.get("title"))
            active_existing[key] = item

    try:
        items = _extract_findings(report_type, content_json, repo_name)
        if not items:
            logger.info(f"[backfill] {report_type}/{analysis_id[:8]}: no findings to extract")
            return 0

        new_findings = []
        matched_existing_ids = set()
        count = 0

        for item in items:
            key = (item["category"], item["title"])
            if key in active_existing:
                existing_item = active_existing[key]
                matched_existing_ids.add(existing_item["id"])
                supabase.table("action_items").update({
                    "analysis_id": analysis_id,
                    "description": item["description"],
                    "severity": item["severity"],
                    "effort_level": item["effort_level"],
                    "ai_prompt": item["ai_prompt"],
                    "file_paths": item["file_paths"],
                }).eq("id", existing_item["id"]).execute()
            else:
                item["analysis_id"] = analysis_id
                item["project_id"] = project_id
                item["first_detected_at"] = datetime.now(timezone.utc).isoformat()
                item["created_at"] = datetime.now(timezone.utc).isoformat()
                new_findings.append(item)

        if new_findings:
            result = supabase.table("action_items").insert(new_findings).execute()
            count += len(result.data) if result.data else len(new_findings)

        # Auto-resolve stale items for this report type
        items_to_resolve = []
        for item in existing_items:
            if item.get("status") in ("open", "in_progress"):
                if item.get("category") == report_type and item["id"] not in matched_existing_ids:
                    items_to_resolve.append(item["id"])

        for item_id in items_to_resolve:
            supabase.table("action_items").update({
                "status": "resolved",
                "resolved_in_analysis_id": analysis_id,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", item_id).execute()

        return count
    except Exception as e:
        logger.error(f"[backfill] Failed for {report_type}/{analysis_id[:8]}: {e}", exc_info=True)
        return 0


# -----------------------------------------------
# Deterministic AI Prompt Generator (no LLM call)
# -----------------------------------------------

def generate_ai_prompt_template(
    title: str,
    description: str,
    fix_summary: str,
    file_paths: list[str],
    report_type: str,
) -> str:
    """
    Generates an AI coding assistant prompt from structured data.
    Deterministic — no API call needed.
    """
    files_str = (
        "\n".join(f"- `{f}`" for f in file_paths)
        if file_paths
        else "- (file path not identified — search codebase for related code)"
    )

    return (
        f"## Fix: {title}\n\n"
        f"**What's wrong:**\n{description}\n\n"
        f"**What to do:**\n{fix_summary}\n\n"
        f"**Relevant files:**\n{files_str}\n\n"
        f"**Paste this into Cursor / Claude Code / your AI coding tool:**\n"
        f"> In the files listed above, {fix_summary.lower().rstrip('.')}. "
        f"Make sure to test the change works correctly before committing. "
        f"Do not change any other functionality."
    )


# -----------------------------------------------
# Internal Extraction Logic
# -----------------------------------------------

def _extract_findings(report_type: str, content_json: dict, repo_name: str) -> list[dict]:
    """
    Unified extractor that handles both old formats (issues, risks, bottlenecks)
    and the new format (findings).
    """
    # FIX 1: handle both "issues" (current format), "findings" (v3.4 new format), and others
    raw_items = (
        content_json.get("findings") or      # v3.4+ new format (future)
        content_json.get("issues") or        # tech_debt
        content_json.get("risks") or         # security
        content_json.get("bottlenecks") or   # scalability
        []
    )
    
    if not raw_items:
        logger.warning(f"No items found in content_json for {report_type}. Keys present: {list(content_json.keys())}")
        return []

    items = []
    for item in raw_items:
        # FIX 2: map field names from actual JSON → expected schema
        title = item.get("title", "Untitled finding")
        description = item.get("description", "")
        fix_summary = (
            item.get("fix_summary") or          # new format (v3.4+)
            item.get("recommendation") or        # current format
            "See description for details"
        )
        
        # FIX 3: lowercase severity
        raw_sev = str(item.get("severity", "medium")).lower()
        severity = SEVERITY_NORMALIZE.get(raw_sev, "medium")
        
        # FIX 4: default if missing, infer effort from severity for security/scalability if needed
        effort_level = item.get("effort_level", "moderate")
        if report_type == "security" and not item.get("effort_level"):
            if severity == "critical": effort_level = "quick-win"
        elif report_type == "scalability" and not item.get("effort_level"):
            if severity == "high": effort_level = "complex"
            elif severity == "critical": effort_level = "architectural"
            
        effort_level = EFFORT_NORMALIZE.get(effort_level, "moderate")
        
        # FIX 5: default if missing
        file_paths = item.get("file_paths", [])

        ai_prompt = generate_ai_prompt_template(
            title=title,
            description=description,
            fix_summary=fix_summary,
            file_paths=file_paths,
            report_type=report_type,
        )

        items.append({
            "category": report_type,
            "severity": severity,
            "title": title,
            "description": description,
            "effort_level": effort_level,
            "status": "open",
            "ai_prompt": ai_prompt,
            "file_paths": file_paths,
        })

    return items



# Legacy compatibility: kept so old imports don't break
def generate_action_item_prompt(
    title: str,
    description: str,
    recommendation: str,
    severity: str,
    file_paths: list[str],
    repo_name: str,
    category: str,
) -> str:
    """Legacy wrapper — delegates to generate_ai_prompt_template."""
    return generate_ai_prompt_template(
        title=title,
        description=description,
        fix_summary=recommendation,
        file_paths=file_paths,
        report_type=category,
    )
