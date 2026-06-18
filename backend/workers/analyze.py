"""
Trixon Backend — Analysis Worker Job (v3.0 + v3.1)

Core RQ background job that orchestrates the full codebase analysis pipeline:

  Step 0:   Pre-flight & load project
  Step 0.5: Resolve snapshot_number, previous_analysis_id, selected_reports (v3.1)
  Step 1:   Fetch repo via GitHub/GitLab API
  Step 2:   Static extraction (languages, frameworks, deps, routes, etc.)
  Step 2.5: Build context layers ONCE for all reports (v3.1)
  Step 3:   Resolve selected_reports (v3.1)
  Step 4:   Generate AI reports using layered context (v3.1)
  Step 5:   Store reports in Supabase
  Step 6:   Compute health scores and mark complete
  Step 7:   Extract action_items from reports (v3.0)
  Step 8:   Run diff engine if snapshot_number > 1 (v3.0)
  Step 9:   Send email notification if webhook-triggered (v3.0)

Invoked via: rq.Queue.enqueue(analyze_project, project_id, analysis_id, ...)
"""

import logging
from datetime import datetime, timezone

from backend.core.encryption import decrypt_token
from backend.core.supabase_client import get_supabase
from backend.services import llm_client, repo_fetcher, static_extractor

logger = logging.getLogger(__name__)

ALL_REPORT_TYPES = [
    "executive_summary",
    "architecture",
    "tech_debt",
    "security",
    "scalability",
    "onboarding",
    "investor",
    "team_readiness",
]

# Default reports used when no selection is made (Snapshot #1 or no prior selection)
DEFAULT_REPORTS = ["executive_summary", "architecture", "tech_debt"]


def run_analysis_job(
    project_id: str,
    analysis_id: str,
    report_types: list[str] | None = None,
    commit_sha: str | None = None,
    commit_message: str | None = None,
    commit_author: str | None = None,
    trigger_source: str = "manual",
) -> None:
    """
    Full analysis pipeline for a single project.

    Args:
        project_id: UUID of the project row in Supabase
        analysis_id: UUID of the analysis row in Supabase (pre-created with status='queued')
        report_types: Optional list of specific report types to generate (v3.1 selected_reports)
        commit_sha: Git commit SHA that triggered this analysis (v3.0)
        commit_message: Commit message text (v3.0)
        commit_author: Commit author name (v3.0)
        trigger_source: 'manual' | 'webhook' | 'scheduled' (v3.0)
    """
    supabase = get_supabase()
    if supabase is None:
        logger.error(f"[{analysis_id}] Supabase unavailable — aborting job")
        return

    def _update_analysis(data: dict) -> None:
        supabase.table("analyses").update(data).eq("id", analysis_id).execute()

    def _fail(reason: str) -> None:
        logger.error(f"[{analysis_id}] Analysis failed: {reason}")
        _update_analysis({
            "status": "failed",
            "error_message": reason,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

    try:
        # -----------------------------------------------
        # Step 0: Pre-flight & load project
        # -----------------------------------------------
        from backend.core.config import get_settings
        settings = get_settings()

        if settings.llm_provider.lower() == "ollama":
            import httpx
            try:
                logger.info(f"[{analysis_id}] Performing Ollama health check at {settings.ollama_url}...")
                resp = httpx.get(f"{settings.ollama_url.rstrip('/')}/api/tags", timeout=5.0)
                resp.raise_for_status()
            except Exception as e:
                logger.error(f"[{analysis_id}] Ollama health check failed: {e}")
                return _fail("Local AI provider (Ollama) is offline or unreachable. Please start Ollama and try again.")

        _update_analysis({
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "trigger_source": trigger_source,
            "commit_sha": commit_sha,
            "commit_message": commit_message,
            "commit_author": commit_author,
        })

        project_resp = (
            supabase.table("projects")
            .select("*, vcs_connections(platform, access_token, platform_username)")
            .eq("id", project_id)
            .single()
            .execute()
        )

        if not project_resp.data:
            return _fail("Project not found")

        project = project_resp.data
        vcs = project.get("vcs_connections")
        if not vcs:
            return _fail("VCS connection not found for this project")

        platform = project.get("platform", vcs.get("platform"))
        repo_name = project.get("repo_name", "")
        default_branch = project.get("default_branch", "main")

        encrypted_token = vcs.get("access_token", "")
        access_token = decrypt_token(encrypted_token)

        logger.info(f"[{analysis_id}] Starting analysis of {repo_name} on {platform}")

        # -----------------------------------------------
        # Step 0.5: Snapshot tracking (v3.0)
        # -----------------------------------------------
        # Count existing completed analyses for this project to get snapshot_number
        existing_resp = (
            supabase.table("analyses")
            .select("id,snapshot_number,selected_reports")
            .eq("project_id", project_id)
            .in_("status", ["complete"])
            .order("snapshot_number", desc=True)
            .execute()
        )
        existing_analyses = existing_resp.data or []
        
        # Determine snapshot_number and previous_analysis_id
        current_analysis = {}
        if trigger_source == "add_reports":
            try:
                analysis_resp = (
                    supabase.table("analyses")
                    .select("snapshot_number, previous_analysis_id, selected_reports")
                    .eq("id", analysis_id)
                    .maybe_single()
                    .execute()
                )
                if analysis_resp and analysis_resp.data:
                    current_analysis = analysis_resp.data
            except Exception as e:
                logger.warning(f"[{analysis_id}] Failed to fetch current analysis: {e}")

        if trigger_source == "add_reports" and current_analysis:
            snapshot_number = current_analysis.get("snapshot_number", 1)
            previous_analysis_id = current_analysis.get("previous_analysis_id")
        else:
            if existing_analyses:
                last_snapshot_number = existing_analyses[0].get("snapshot_number") or len(existing_analyses)
                snapshot_number = last_snapshot_number + 1
                previous_analysis_id = existing_analyses[0]["id"]
            else:
                snapshot_number = 1
                previous_analysis_id = None

        # Resolve selected_reports (v3.1)
        selected_reports = _resolve_selected_reports(
            supabase=supabase,
            report_types=report_types,
            existing_analyses=existing_analyses,
            snapshot_number=snapshot_number,
        )

        # Update analysis record with snapshot info (union of old and new reports for add_reports)
        db_selected = selected_reports
        if trigger_source == "add_reports" and current_analysis:
            existing_selected = current_analysis.get("selected_reports") or []
            db_selected = list(set(existing_selected + selected_reports))

        _update_analysis({
            "snapshot_number": snapshot_number,
            "previous_analysis_id": previous_analysis_id,
            "selected_reports": db_selected,
        })

        logger.info(
            f"[{analysis_id}] Snapshot #{snapshot_number}. "
            f"Previous: {previous_analysis_id}. "
            f"Reports: {selected_reports}"
        )

        # -----------------------------------------------
        # Step 1: Fetch repository files
        # -----------------------------------------------
        fetched: repo_fetcher.FetchedRepo

        if platform == "github":
            parts = repo_name.split("/")
            if len(parts) < 2:
                return _fail(f"Invalid GitHub repo name format: {repo_name}")
            owner, repo = parts[0], parts[1]
            fetched = await_sync(repo_fetcher.fetch_github_repo(owner, repo, default_branch, access_token))

        elif platform == "gitlab":
            project_id_gl = project.get("repo_id")
            if not project_id_gl:
                return _fail("GitLab project ID not stored")
            fetched = await_sync(repo_fetcher.fetch_gitlab_repo(int(project_id_gl), default_branch, access_token))

        else:
            return _fail(f"Unsupported platform: {platform}")

        if fetched.error:
            return _fail(f"Repo fetch failed: {fetched.error}")

        if not fetched.files:
            return _fail("No files fetched from repository")

        logger.info(f"[{analysis_id}] Fetched {len(fetched.files)} files")

        # -----------------------------------------------
        # Step 2: Static extraction
        # -----------------------------------------------
        extraction = static_extractor.extract(fetched.files)

        logger.info(
            f"[{analysis_id}] Static analysis complete: "
            f"{len(extraction.language_breakdown)} languages, "
            f"{len(extraction.frameworks)} frameworks, "
            f"{len(extraction.api_routes)} routes"
        )

        # Save partial results immediately
        if isinstance(extraction.stats, dict):
            extraction.stats["frameworks"] = extraction.frameworks

        _update_analysis({
            "language_breakdown": extraction.language_breakdown,
            "dependencies": extraction.dependencies,
            "third_party_services": {"services": extraction.third_party_services},
            "stats": extraction.stats,
        })

        try:
            supabase.table("code_snapshots").insert({
                "analysis_id": analysis_id,
                "key_files": extraction.key_files
            }).execute()
        except Exception as e:
            logger.error(f"[{analysis_id}] Failed to save code snapshot: {e}")

        # -----------------------------------------------
        # Step 2.5: Build AI context layers ONCE (v3.1)
        # -----------------------------------------------
        ai_context = {
            "repo_name": repo_name,
            "platform": platform,
            "stats": extraction.stats,
            "language_breakdown": extraction.language_breakdown,
            "frameworks": extraction.frameworks,
            "dependencies": extraction.dependencies,
            "api_routes": extraction.api_routes,
            "env_vars_referenced": extraction.env_vars_referenced,
            "third_party_services": extraction.third_party_services,
            "db_models": extraction.db_models_detected,
            "key_files": extraction.key_files,
        }

        # Build layered context (v3.1) — done once, reused per report
        context_layers = llm_client.build_context_layers(ai_context, extraction=extraction)

        # -----------------------------------------------
        # Step 4: Generate AI reports using layered context (v3.1)
        # -----------------------------------------------
        scores: dict[str, int] = {}
        report_outputs: list[llm_client.ReportOutput] = []

        from concurrent.futures import ThreadPoolExecutor

        def _generate_report_thread(report_type: str) -> llm_client.ReportOutput:
            # Build per-report context using the layered approach
            report_context = llm_client.build_report_context(
                report_type=report_type,
                layers=context_layers,
                raw_files=fetched.files,
            )
            logger.info(f"[{analysis_id}] Concurrent worker started: Generating report {report_type}")
            output = _generate_report_with_context(report_type, report_context)
            logger.info(f"[{analysis_id}] Concurrent worker finished: Report {report_type} (Success: {not output.error})")
            return output

        max_workers = min(len(selected_reports), 4)
        logger.info(f"[{analysis_id}] Generating {len(selected_reports)} reports concurrently with {max_workers} threads")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # executor.map maintains original order of selected_reports
            results = executor.map(_generate_report_thread, selected_reports)
            report_outputs = list(results)

        for output in report_outputs:
            if output.error:
                logger.warning(f"[{analysis_id}] Report {output.report_type} failed: {output.error}")
            else:
                scores[output.report_type] = output.score
                logger.info(f"[{analysis_id}] {output.report_type} score: {output.score}")

        # -----------------------------------------------
        # Step 5: Store reports in Supabase
        # -----------------------------------------------
        for output in report_outputs:
            try:
                insert_data = {
                    "analysis_id": analysis_id,
                    "report_type": output.report_type,
                    "content_markdown": output.content_markdown,
                    "content_json": output.content_json,
                }

                # Extract effort estimates from tech_debt report (kept for backwards compat)
                if output.report_type == "tech_debt" and not output.error:
                    effort_estimates = _extract_effort_estimates(output.content_json)
                    if effort_estimates:
                        insert_data["effort_estimates"] = effort_estimates

                supabase.table("reports").insert(insert_data).execute()
            except Exception as e:
                logger.error(f"[{analysis_id}] Failed to store report {output.report_type}: {e}")

        # -----------------------------------------------
        # Step 6: Compute health scores and mark complete
        # -----------------------------------------------
        successful_reports = [o for o in report_outputs if not o.error]

        # Ensure we have at least one report stored in the DB
        db_reports_resp = (
            supabase.table("reports")
            .select("report_type")
            .eq("analysis_id", analysis_id)
            .execute()
        )
        if not db_reports_resp.data:
            return _fail("All report generations failed.")

        final_status = "complete"

        # Recompute scores using the unified function
        try:
            recompute_scores(analysis_id)
        except Exception as e:
            logger.error(f"[{analysis_id}] Failed to recompute scores: {e}")

        key_findings = None
        for output in successful_reports:
            if output.report_type == "executive_summary" and output.content_json:
                key_findings = output.content_json.get("key_findings", None)
                break

        # If key_findings wasn't in this run's successful reports, try to find it in stored executive_summary
        if not key_findings:
            try:
                exec_summary_resp = (
                    supabase.table("reports")
                    .select("content_json")
                    .eq("analysis_id", analysis_id)
                    .eq("report_type", "executive_summary")
                    .maybe_single()
                    .execute()
                )
                if exec_summary_resp and exec_summary_resp.data:
                    c_json = exec_summary_resp.data.get("content_json") or {}
                    key_findings = c_json.get("key_findings")
            except Exception as e:
                logger.warning(f"[{analysis_id}] Failed to fetch key_findings from DB: {e}")

        update_data = {
            "status": final_status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        if key_findings:
            update_data["key_findings"] = key_findings

        try:
            _update_analysis(update_data)
        except Exception as e:
            if "key_findings" in str(e) and key_findings:
                logger.warning(f"[{analysis_id}] key_findings column not found — completing without it.")
                update_data.pop("key_findings", None)
                _update_analysis(update_data)
            else:
                raise

        # Update the project's last_synced_at
        supabase.table("projects").update({
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", project_id).execute()

        logger.info(
            f"[{analysis_id}] Analysis complete. "
            f"Reports generated: {len(successful_reports)}/{len(selected_reports)}"
        )

        try:
            from backend.services.analytics import track_event
            duration_seconds = (datetime.now(timezone.utc) - datetime.fromisoformat(update_data["completed_at"].replace("Z", "+00:00"))).total_seconds()
            track_event(
                user_id=project.get("user_id"),
                event_type="analysis_completed",
                project_id=project_id,
                properties={
                    "duration_seconds": duration_seconds,
                    "reports_generated": len(successful_reports)
                }
            )
        except Exception as e:
            logger.warning(f"Failed to track analysis_completed: {e}")

        # -----------------------------------------------
        # Step 7: Extract action items from reports (v3.0)
        # -----------------------------------------------
        try:
            from backend.services.action_extractor import extract_and_store_action_items
            action_item_count = extract_and_store_action_items(
                report_outputs=successful_reports,
                analysis_id=analysis_id,
                project_id=project_id,
                repo_name=repo_name,
            )
            logger.info(f"[{analysis_id}] Created {action_item_count} action items")
        except Exception as e:
            logger.error(f"[{analysis_id}] Action item extraction failed (non-fatal): {e}")

        # -----------------------------------------------
        # Step 8: Run diff engine if Snapshot #2+ (v3.0)
        # -----------------------------------------------
        if previous_analysis_id:
            try:
                from backend.services.diff_engine import compute_diff
                diff = compute_diff(
                    project_id=project_id,
                    new_analysis_id=analysis_id,
                    previous_analysis_id=previous_analysis_id,
                )
                if diff:
                    logger.info(f"[{analysis_id}] Diff computed: verdict={diff.get('verdict')}")
            except Exception as e:
                logger.error(f"[{analysis_id}] Diff engine failed (non-fatal): {e}")

        # -----------------------------------------------
        # Step 9: Email notification for webhook-triggered snapshots (v3.0)
        # -----------------------------------------------
        if trigger_source == "webhook":
            try:
                _send_changelog_email(
                    supabase=supabase,
                    project_id=project_id,
                    analysis_id=analysis_id,
                    repo_name=repo_name,
                )
            except Exception as e:
                logger.error(f"[{analysis_id}] Email notification failed (non-fatal): {e}")

    except Exception as e:
        logger.exception(f"[{analysis_id}] Unexpected error in analyze_project: {e}")
        _fail(f"Unexpected error: {str(e)}")


def _resolve_selected_reports(
    supabase,
    report_types: list[str] | None,
    existing_analyses: list[dict],
    snapshot_number: int,
) -> list[str]:
    """
    Resolve which reports to generate for this snapshot.
    
    Priority:
    1. Explicitly passed report_types → use those
    2. Snapshot #1 (baseline) with no selection → use catalog defaults (is_default = True)
    3. Snapshot #2+ with no selection → inherit from previous snapshot's selected_reports
    """
    if report_types:
        # Validate against known report types
        valid = [r for r in report_types if r in ALL_REPORT_TYPES]
        if valid:
            return valid

    # Fetch default report types from catalog
    defaults = []
    try:
        defaults_resp = (
            supabase.table("report_catalog")
            .select("id")
            .eq("is_default", True)
            .execute()
        )
        if defaults_resp and defaults_resp.data:
            defaults = [row["id"] for row in defaults_resp.data]
    except Exception as e:
        logger.warning(f"Failed to fetch default reports from report_catalog: {e}")

    # Fallback to hardcoded list if query failed or returned empty
    if not defaults:
        defaults = ["executive_summary", "architecture", "tech_debt"]

    if snapshot_number == 1 or not existing_analyses:
        return defaults

    # Inherit from previous snapshot
    prev_selected = existing_analyses[0].get("selected_reports")
    if prev_selected:
        valid_prev = [r for r in prev_selected if r in ALL_REPORT_TYPES]
        if valid_prev:
            return valid_prev

    return defaults


def _generate_report_with_context(report_type: str, context_str: str) -> "llm_client.ReportOutput":
    """Generate a single report using a pre-built context string."""
    from backend.core.config import get_settings
    settings = get_settings()

    system_prompt = llm_client.SYSTEM_PROMPTS.get(report_type)
    if not system_prompt:
        return llm_client.ReportOutput(
            report_type=report_type,
            content_json={},
            content_markdown="",
            score=0,
            error=f"Unknown report type: {report_type}",
        )

    if settings.llm_provider.lower() == "groq":
        from backend.services.providers.groq import generate_groq_report
        return generate_groq_report(report_type, context_str, system_prompt)
    elif settings.llm_provider.lower() == "ollama":
        from backend.services.providers.ollama import generate_ollama_report
        return generate_ollama_report(report_type, context_str, system_prompt)
    else:
        from backend.services.providers.gemini import generate_gemini_report
        return generate_gemini_report(report_type, context_str, system_prompt)


def _send_changelog_email(supabase, project_id: str, analysis_id: str, repo_name: str) -> None:
    """Send email notification for webhook-triggered snapshot completion."""
    from backend.core.config import get_settings
    settings = get_settings()

    if not settings.resend_api_key:
        logger.info(f"[{analysis_id}] RESEND_API_KEY not set — skipping email notification")
        return

    # Get the diff record
    diff_resp = (
        supabase.table("analysis_diffs")
        .select("verdict,summary_markdown,score_deltas")
        .eq("to_analysis_id", analysis_id)
        .maybe_single()
        .execute()
    )
    diff = diff_resp.data if diff_resp else None

    # Get user email
    project_resp = supabase.table("projects").select("user_id").eq("id", project_id).single().execute()
    user_id = project_resp.data.get("user_id") if project_resp.data else None
    if not user_id:
        return

    profile_resp = supabase.from_("profiles").select("email").eq("id", user_id).maybe_single().execute()
    user_email = profile_resp.data.get("email") if profile_resp and profile_resp.data else None
    if not user_email:
        logger.info(f"[{analysis_id}] No user email found — skipping notification")
        return

    verdict = diff.get("verdict", "unknown") if diff else "complete"
    summary = diff.get("summary_markdown", "") if diff else ""

    verdict_display = {
        "improved": "✅ Improved",
        "regressed": "⚠️ New Risk Detected",
        "mixed": "🔄 Mixed Changes",
        "no_change": "➡️ No Change",
    }.get(verdict, "📊 Analysis Complete")

    repo_display = repo_name.split("/")[-1] if "/" in repo_name else repo_name

    import httpx
    
    subject = f"[Trixon] {repo_display} analysis complete — {verdict_display}"

    body = f"""Your latest commit to <strong>{repo_name}</strong> has been analyzed by Trixon.

<h3>{verdict_display}</h3>

{f'<p>{summary}</p>' if summary else ''}

<p><a href="https://app.trixon.cloud/projects/{project_id}">View full report →</a></p>

<hr>
<small>You received this because you connected {repo_name} to Trixon with auto-tracking enabled.</small>
"""

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Trixon <noreply@trixon.cloud>",
                    "to": [user_email],
                    "subject": subject,
                    "html": body,
                },
            )
            if resp.status_code == 200:
                logger.info(f"[{analysis_id}] Email notification sent to {user_email}")
            else:
                logger.warning(f"[{analysis_id}] Email send failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"[{analysis_id}] Email send error: {e}")


def await_sync(coro):
    """
    Run an async coroutine synchronously inside an RQ worker
    (which runs in a regular synchronous Python process).
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def _extract_effort_estimates(content_json: dict) -> list[dict] | None:
    """
    Extract effort estimates from tech_debt report JSON.
    Kept for backwards compatibility with existing reports schema.
    """
    try:
        issues = content_json.get("issues", [])
        estimates = []

        for issue in issues:
            effort = issue.get("effort", {})
            if effort and isinstance(effort, dict):
                estimates.append({
                    "finding_id": effort.get("finding_id", ""),
                    "severity": issue.get("severity", "Medium"),
                    "effort_level": effort.get("effort_level", "moderate"),
                    "effort_description": effort.get("effort_description", ""),
                    "trixon_timeline": effort.get("trixon_timeline", ""),
                })

        return estimates if estimates else None

    except Exception:
        return None


REPORT_TO_SCORE_CATEGORY = {
    "security": "security_score",
    "scalability": "scalability_score",
    "tech_debt": "quality_score",
    "onboarding": "docs_score",
}


def recompute_scores(analysis_id: str) -> dict:
    """
    Fetches all reports for this analysis, maps only the 4 category-relevant
    report types to their score columns, and computes health_score as the
    average of whichever category scores are actually populated.
    """
    supabase = get_supabase()
    if supabase is None:
        logger.error(f"[{analysis_id}] Supabase unavailable in recompute_scores")
        return {}

    reports = (
        supabase.table("reports")
        .select("report_type, content_json")
        .eq("analysis_id", analysis_id)
        .execute()
        .data
    ) or []

    category_scores = {}  # e.g. {"security_score": 55, "quality_score": 65}

    for report in reports:
        report_type = report["report_type"]
        score_column = REPORT_TO_SCORE_CATEGORY.get(report_type)
        if score_column is None:
            continue  # executive_summary, architecture, investor — not category-mapped

        content = report.get("content_json")
        if content and "score" in content:
            try:
                category_scores[score_column] = int(content["score"])
            except (ValueError, TypeError):
                pass

    # health_score = average of only the categories that are actually populated
    if category_scores:
        health_score = round(sum(category_scores.values()) / len(category_scores))
    else:
        health_score = None

    update_data = {
        "health_score": health_score,
        "security_score": category_scores.get("security_score"),
        "scalability_score": category_scores.get("scalability_score"),
        "quality_score": category_scores.get("quality_score"),
        "docs_score": category_scores.get("docs_score"),
    }

    supabase.table("analyses").update(update_data).eq("id", analysis_id).execute()
    return update_data
