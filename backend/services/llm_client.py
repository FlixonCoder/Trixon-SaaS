"""
Trixon Backend — Unified LLM Client Router

Provides provider-agnostic access to LLM services (Gemini or Ollama).
Includes shared context builders, prompts, and robust JSON recovery logic.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

# -----------------------------------------------
# Report system prompts
# -----------------------------------------------

SYSTEM_PROMPTS = {
    "executive_summary": """You are a brilliant technical co-founder explaining a codebase to a non-technical founder.
Write exactly 3 paragraphs. Zero jargon. No bullet points in the summary paragraphs.
Use plain English that a business-school graduate with no engineering background can understand.

Your output must be valid JSON with this exact shape:
{
  "title": "Executive Summary",
  "paragraphs": ["<paragraph 1>", "<paragraph 2>", "<paragraph 3>"],
  "key_findings": ["<short plain-English finding 1>", "<short plain-English finding 2>", "<short plain-English finding 3>"],
  "score": <integer 0-100 reflecting overall code health>,
  "one_liner": "<one sentence summary of what this product is>"
}""",

    "architecture": """You are a senior software architect explaining a system to a non-technical founder.
Describe how the system's components connect. Use analogies. Avoid raw code.

Your output must be valid JSON with this exact shape:
{
  "title": "Architecture Overview",
  "overview": "<2-3 sentence plain-English overview>",
  "components": [
    {"name": "<component name>", "role": "<what it does in plain English>", "technology": "<tech used>"}
  ],
  "data_flow": "<how data moves through the system, in plain English>",
  "score": <integer 0-100 reflecting architecture quality>
}""",

    "tech_debt": """You are a senior engineer auditing a codebase for technical debt.
Identify issues categorized by severity. Lead with what the founder should care about.

For each finding, you must also include effort metadata in a nested object.

effort_level definitions (use these precisely):
- quick-win: < 1 engineer-day
- moderate: 1-5 engineer-days
- complex: 1-3 engineer-weeks
- architectural: requires structural redesign, 3+ weeks

Your output must be valid JSON with this exact shape:
{
  "title": "Tech Debt Report",
  "summary": "<2-sentence plain-English summary for a non-technical founder>",
  "issues": [
    {
      "severity": "High|Medium|Low",
      "title": "<short issue title>",
      "description": "<plain English description, no jargon>",
      "impact": "<what this means for the business>",
      "recommendation": "<what to do about it>",
      "effort": {
        "finding_id": "<unique-slug-for-this-finding>",
        "effort_level": "quick-win|moderate|complex|architectural",
        "effort_description": "<One plain-English sentence, e.g. A senior engineer can fix this in about 2 days.>",
        "trixon_timeline": "<e.g. Week 1 of a Trixon engagement>"
      }
    }
  ],
  "score": <integer 0-100, higher = less debt>
}""",

    "security": """You are a security engineer reviewing a codebase for a non-technical founder.
Focus on business risk, not CVE numbers. Use plain English.

Your output must be valid JSON with this exact shape:
{
  "title": "Security Risk Scan",
  "summary": "<2-sentence plain-English security posture summary>",
  "risks": [
    {
      "severity": "Critical|High|Medium|Low",
      "title": "<risk title>",
      "description": "<what the risk is, in plain English>",
      "business_impact": "<what could happen if exploited>",
      "recommendation": "<how to fix it>"
    }
  ],
  "score": <integer 0-100, higher = more secure>
}""",

    "onboarding": """You are writing a day-1 onboarding guide for a new developer joining this project.
Be practical and specific. Include file paths and commands where relevant.

Your output must be valid JSON with this exact shape:
{
  "title": "Developer Onboarding Guide",
  "overview": "<2-sentence project overview for a new developer>",
  "setup_steps": [
    {"step": "<step title>", "description": "<what to do and why>", "command": "<command if applicable or null>"}
  ],
  "key_files": [
    {"path": "<file path>", "purpose": "<what this file does>"}
  ],
  "architecture_notes": "<important architectural decisions the dev should know>",
  "gotchas": ["<common mistake or non-obvious thing to know>"],
  "score": <integer 0-100 reflecting documentation quality>
}""",

    "scalability": """You are a senior backend/infrastructure engineer reviewing a codebase for a non-technical founder.
Identify scalability bottlenecks and what breaks first at 10x users. Be specific and practical.

Your output must be valid JSON with this exact shape:
{
  "title": "Scalability Assessment",
  "summary": "<2-sentence plain-English scalability summary>",
  "current_capacity": "<estimate of what the system can handle right now>",
  "bottlenecks": [
    {
      "severity": "High|Medium|Low",
      "title": "<bottleneck title>",
      "description": "<what the bottleneck is, in plain English>",
      "impact": "<what happens if this isn't fixed>",
      "recommendation": "<how to fix it>"
    }
  ],
  "positives": ["<things that scale well already>"],
  "score": <integer 0-100, higher = more scalable>
}""",

    "investor": """You are writing a technical due-diligence 1-pager for a VC looking at this startup.
Be honest, balanced, and concise. Cover strengths, risks, and team needs.

Your output must be valid JSON with this exact shape:
{
  "title": "Investor Technical Summary",
  "headline": "<one line headline capturing the tech posture>",
  "maturity_level": "MVP|Early-stage|Growth-ready|Production-grade",
  "technical_risk": "Low|Medium|High",
  "strengths": [
    {"title": "<strength title>", "description": "<description>"}
  ],
  "risks": [
    {"title": "<risk title>", "description": "<description>", "severity": "High|Medium|Low"}
  ],
  "scalability_outlook": "<1-2 sentence scalability outlook>",
  "risk_notes": "<overall risk assessment paragraph>",
  "recommended_next_hires": ["<role 1>", "<role 2>"],
  "score": <integer 0-100 reflecting investor-readiness>
}""",

    "team_readiness": """You are a senior engineering org designer and technical recruiter reviewing a codebase for a non-technical founder.

Based on the codebase analysis provided, generate a Team Readiness Report. This should read like advice from a trusted technical co-founder — zero jargon, grounded in what's actually in this specific codebase.

Your output must be valid JSON with this exact shape:
{
  "title": "Team Readiness Report",
  "codebase_origin": "<2-3 sentences: Was this AI-built? Solo dev? Agency? What signals support this?>",
  "immediate_hires": [
    {
      "role": "<Role Title>",
      "why_needed": "<Tied to specific codebase finding. Plain English.>",
      "skills_to_look_for": ["<skill 1>", "<skill 2>", "<skill 3>"],
      "red_flags": ["<red flag 1>", "<red flag 2>"],
      "market_rate": "<$X-$Y/year, USD, 2024-2025 range>"
    }
  ],
  "future_hires": [
    {
      "role": "<Role Title>",
      "why_needed": "<reason tied to codebase>",
      "skills_to_look_for": ["<skill 1>", "<skill 2>", "<skill 3>"],
      "red_flags": ["<red flag 1>", "<red flag 2>"],
      "market_rate": "<$X-$Y/year>"
    }
  ],
  "team_structure": "<2-3 paragraphs: org structure, who leads, teams, reporting lines>",
  "hiring_order": [
    {"order": 1, "role": "<role>", "consequence": "<what breaks if wrong>"}
  ],
  "trixon_note": "Building and vetting a technical team is one of the hardest things a non-technical founder does alone. Trixon's Build-Operate-Transfer model was designed for exactly this: we hire, install, and manage your engineering team — then formally hand it over to you. By the time we leave, you own the team, the code, and the hiring playbook. If you'd like to talk through what this looks like for your situation, we offer a free 30-minute scoping call.",
  "score": <integer 0-100 reflecting team readiness>
}

RULES:
- Every hire recommendation must reference something specific found in this codebase.
- Market rates must be realistic 2024-2025 US ranges.
- Write for a non-technical founder who has never managed engineers before.
- The Trixon note must feel like advice, not an ad.
""",
}


@dataclass
class ReportOutput:
    """Result from a single LLM report generation call."""
    report_type: str
    content_json: dict
    content_markdown: str
    score: int
    error: Optional[str] = None
    is_rate_limit_error: bool = False


def build_context_prompt(context: dict[str, Any]) -> str:
    """Convert the structured extraction context into a prompt string.
    
    Legacy function kept for backwards compatibility.
    New code should use build_context_layers() + build_report_context().
    """
    parts = []

    parts.append("=== CODEBASE ANALYSIS CONTEXT ===\n")

    if context.get("repo_name"):
        parts.append(f"Repository: {context['repo_name']}")
    if context.get("platform"):
        parts.append(f"Platform: {context['platform']}")

    stats = context.get("stats", {})
    if stats:
        parts.append(f"\nStats:")
        parts.append(f"  - Total files: {stats.get('total_files', 'unknown')}")
        parts.append(f"  - Total lines of code: {stats.get('total_lines', 'unknown')}")
        parts.append(f"  - API endpoints detected: {stats.get('total_endpoints', 0)}")
        parts.append(f"  - Dependencies: {stats.get('total_dependencies', 0)}")

    if context.get("language_breakdown"):
        parts.append(f"\nLanguage Breakdown:")
        for lang, pct in context["language_breakdown"].items():
            parts.append(f"  - {lang}: {pct}%")

    if context.get("frameworks"):
        parts.append(f"\nFrameworks Detected: {', '.join(context['frameworks'])}")

    if context.get("third_party_services"):
        parts.append(f"\nThird-Party Services: {', '.join(context['third_party_services'])}")

    if context.get("dependencies"):
        deps = context["dependencies"].get("all", [])
        if deps:
            parts.append(f"\nDependencies ({len(deps)} total):")
            parts.append(f"  {', '.join(deps[:40])}")

    if context.get("api_routes"):
        routes = context["api_routes"][:30]
        parts.append(f"\nAPI Routes Detected ({len(context['api_routes'])} total):")
        for r in routes:
            parts.append(f"  - {r}")

    if context.get("env_vars_referenced"):
        parts.append(f"\nEnvironment Variables Referenced:")
        parts.append(f"  {', '.join(context['env_vars_referenced'][:30])}")

    if context.get("db_models"):
        parts.append(f"\nDatabase Models: {', '.join(context['db_models'])}")

    if context.get("key_files"):
        parts.append("\n=== KEY FILES ===")
        # Severely restrict key files to avoid 413 Payload Too Large
        for path, content in list(context["key_files"].items())[:7]:
            parts.append(f"\n--- {path} ---")
            parts.append(content[:1500])  # Only include top 1500 chars

    final_prompt = "\n".join(parts)
    
    # Hard limit on total payload size to prevent HTTP 413 from Groq
    MAX_PROMPT_LENGTH = 20000
    if len(final_prompt) > MAX_PROMPT_LENGTH:
        final_prompt = final_prompt[:MAX_PROMPT_LENGTH] + "\n...[TRUNCATED DUE TO SIZE LIMITS]..."
        
    return final_prompt


# -----------------------------------------------
# v3.1: Layered context builder
# -----------------------------------------------

TOKEN_BUDGET_PER_CALL = 5500   # Conservative under 6000 tokens
PROMPT_OVERHEAD_ESTIMATE = 500  # System prompt + task instruction tokens


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token (conservative)."""
    return len(text) // 4


# File selector definitions per report type
# Each selector specifies which file lists to pull from ExtractionResult and what extraction mode to use
FILE_SELECTORS: dict[str, dict] = {
    "executive_summary": {
        "file_lists": ["readme_path"],  # single path, not a list
        "mode": "full",
        "max_files": 1,
    },
    "architecture": {
        "file_lists": ["entry_point_files"],
        "mode": "signatures",
        "max_files": 5,
    },
    "tech_debt": {
        "file_lists": ["largest_files", "most_complex_files"],
        "mode": "signatures_plus_flagged_lines",
        "max_files": 5,
    },
    "security": {
        "file_lists": ["files_with_env_usage", "auth_related_files"],
        "mode": "full_for_env_lines",
        "max_files": 5,
    },
    "scalability": {
        "file_lists": ["db_query_files", "entry_point_files"],
        "mode": "signatures",
        "max_files": 4,
    },
    "onboarding": {
        "file_lists": ["readme_path", "entry_point_files"],
        "mode": "signatures",
        "max_files": 3,
    },
    "investor": {
        "file_lists": [],  # No raw code — Layer 1+2 only
        "mode": None,
        "max_files": 0,
    },
    "team_readiness": {
        "file_lists": [],  # No raw code needed
        "mode": None,
        "max_files": 0,
    },
}


def build_context_layers(context: dict[str, Any], extraction=None) -> dict:
    """
    Build the layered context package ONCE per snapshot.
    Reused across all selected report generation calls.
    
    Args:
        context: The ai_context dict from analyze.py (stats, languages, etc.)
        extraction: The ExtractionResult object (for v3.1 selector fields)
    
    Returns:
        Dict with layer1 (repo_summary), layer2 (signals), and metadata.
    """
    repo_name = context.get("repo_name", "unknown")
    platform = context.get("platform", "")
    stats = context.get("stats", {})
    lang_breakdown = context.get("language_breakdown", {})
    frameworks = context.get("frameworks", [])
    dependencies = context.get("dependencies", {}).get("all", [])
    api_routes = context.get("api_routes", [])
    env_vars = context.get("env_vars_referenced", [])
    services = context.get("third_party_services", [])
    db_models = context.get("db_models", [])

    # Layer 1: Repo summary — always included, full repo coverage
    layer1_parts = [
        f"=== CODEBASE OVERVIEW ===",
        f"Repository: {repo_name}  |  Platform: {platform}",
        f"Files: {stats.get('total_files', '?')}  |  Lines: {stats.get('total_lines', '?')}  |  Endpoints: {stats.get('total_endpoints', 0)}",
    ]
    if lang_breakdown:
        layer1_parts.append(f"Languages: {', '.join(f'{l}: {p}%' for l, p in list(lang_breakdown.items())[:8])}")
    if frameworks:
        layer1_parts.append(f"Frameworks: {', '.join(frameworks)}")
    if dependencies:
        layer1_parts.append(f"Dependencies ({len(dependencies)}): {', '.join(dependencies[:50])}")
    if extraction and hasattr(extraction, 'file_tree_compact') and extraction.file_tree_compact:
        tree_sample = extraction.file_tree_compact[:40]
        layer1_parts.append(f"\nFile Tree (depth ≤ 3):\n" + "\n".join(f"  {p}" for p in tree_sample))

    # Layer 2: Signals — always included
    layer2_parts = ["\n=== SIGNALS ==="]
    if api_routes:
        layer2_parts.append(f"API Routes ({len(api_routes)} total):")
        for r in api_routes[:25]:
            layer2_parts.append(f"  {r}")
    if env_vars:
        layer2_parts.append(f"Env Vars Referenced: {', '.join(env_vars[:30])}")
    if services:
        layer2_parts.append(f"Third-Party Services: {', '.join(services)}")
    if db_models:
        layer2_parts.append(f"DB Models: {', '.join(db_models)}")

    return {
        "repo_name": repo_name,
        "platform": platform,
        "layer1": "\n".join(layer1_parts),
        "layer2": "\n".join(layer2_parts),
        "extraction": extraction,  # ExtractionResult object for file selectors
        "raw_files": {},           # populated by caller if file content is needed
    }


def build_report_context(
    report_type: str,
    layers: dict,
    raw_files: dict[str, str] | None = None,
) -> str:
    """
    Build the final context string for a specific report type.
    Applies the FILE_SELECTOR for this report type to Layer 3.
    
    Args:
        report_type: e.g. 'security', 'tech_debt'
        layers: Output from build_context_layers()
        raw_files: Dict of {path: content} from the repo fetch
    
    Returns:
        Complete context string ready to pass to the LLM
    """
    from backend.services import static_extractor

    base = layers["layer1"] + "\n" + layers["layer2"]
    base_tokens = estimate_tokens(base)
    remaining_budget = TOKEN_BUDGET_PER_CALL - base_tokens - PROMPT_OVERHEAD_ESTIMATE

    selector = FILE_SELECTORS.get(report_type, {"file_lists": [], "mode": None, "max_files": 0})
    extraction = layers.get("extraction")
    files = raw_files or {}

    targeted_parts: list[str] = []

    if selector["mode"] and extraction and files:
        # Collect file paths from the selector's file_lists
        selected_paths: list[str] = []
        for list_name in selector["file_lists"]:
            if list_name == "readme_path":
                # readme_path is a single str, not a list
                readme = getattr(extraction, "readme_path", None)
                if readme and readme in files:
                    selected_paths.append(readme)
            else:
                paths = getattr(extraction, list_name, [])
                for p in paths:
                    if p in files and p not in selected_paths:
                        selected_paths.append(p)

        # Apply max_files cap
        selected_paths = selected_paths[:selector["max_files"]]

        # Apply extraction mode and token budget
        targeted_parts.append("\n=== TARGETED FILES ===")
        for path in selected_paths:
            content = files.get(path, "")
            if not content:
                continue

            mode = selector["mode"]
            if mode == "full":
                extracted = content[:3000]  # Full mode: cap at 3000 chars (README is usually small)
            elif mode == "signatures":
                extracted = static_extractor.extract_signatures(path, content)
            elif mode == "signatures_plus_flagged_lines":
                extracted = static_extractor.extract_flagged_lines(path, content)
            elif mode == "full_for_env_lines":
                extracted = static_extractor.extract_env_lines(path, content)
            else:
                extracted = content[:1500]

            file_section = f"\n--- {path} ---\n{extracted}"
            file_tokens = estimate_tokens(file_section)

            if file_tokens > remaining_budget:
                # Drop this file (don't truncate mid-thought)
                logger.info(
                    f"[context] Dropping {path} from {report_type} context "
                    f"(would exceed budget: {file_tokens} tokens, {remaining_budget} remaining)"
                )
                continue

            targeted_parts.append(file_section)
            remaining_budget -= file_tokens

    final_context = base
    if len(targeted_parts) > 1:  # More than just the header
        final_context += "\n" + "\n".join(targeted_parts)

    total_tokens = estimate_tokens(final_context)
    logger.info(
        f"[context] {report_type}: ~{total_tokens} tokens "
        f"({len(targeted_parts) - 1} targeted files)"
    )

    return final_context


# -----------------------------------------------
# v3.0: Action item prompt + changelog summary
# -----------------------------------------------

def generate_action_item_prompt(
    title: str,
    description: str,
    recommendation: str,
    severity: str,
    file_paths: list[str],
    repo_name: str,
    category: str,
) -> str:
    """
    Generate a ready-to-paste AI coding prompt for a single action item.
    Uses a deterministic template — no LLM call needed.
    """
    files_str = ", ".join(f"`{p}`" for p in file_paths[:3]) if file_paths else "the relevant file"
    category_map = {
        "security": "security fix",
        "tech_debt": "code cleanup",
        "scalability": "performance improvement",
        "quality": "code quality improvement",
        "docs": "documentation improvement",
    }
    action_type = category_map.get(category, "code improvement")
    severity_instruction = {
        "critical": "This is a critical issue — fix this before any other work.",
        "high": "This is a high-priority issue — address soon.",
        "medium": "This is a medium-priority improvement.",
        "low": "This is a low-priority cleanup.",
    }.get(severity.lower(), "")

    prompt = (
        f"In {files_str}, do the following {action_type}:\n\n"
        f"{recommendation}\n\n"
        f"Context: {description}\n\n"
        f"{severity_instruction}\n"
        f"Make only this specific change. Do not refactor other parts of the code."
    )
    return prompt.strip()


def generate_changelog_summary(
    resolved: list[dict],
    new_findings: list[dict],
    score_deltas: dict,
    commit_message: str | None,
) -> str:
    """
    Generate a 2-3 sentence AI changelog summary for a snapshot diff.
    Makes a single Groq call.
    """
    from backend.core.config import get_settings
    settings = get_settings()

    resolved_count = len(resolved)
    new_count = len(new_findings)
    net_health = score_deltas.get("health", 0)

    prompt = (
        f"Write a 2-3 sentence plain-English changelog summary for this codebase snapshot diff.\n"
        f"Be direct, specific, and honest. Tone: a trusted technical advisor talking to a non-technical founder.\n\n"
        f"Commit message: {commit_message or 'No commit message provided'}\n"
        f"Issues resolved: {resolved_count}\n"
        f"New issues found: {new_count}\n"
        f"Score changes: {score_deltas}\n"
        f"Net health delta: {net_health:+d} points\n\n"
        f"Resolved items: {[r.get('title', '') for r in resolved[:3]]}\n"
        f"New items: {[n.get('title', '') for n in new_findings[:3]]}\n\n"
        f"Output only the 2-3 sentence summary. No bullet points, no headers."
    )

    system_prompt = (
        "You are Trixon, a technical advisor writing a changelog summary for a non-technical founder. "
        "Be concise, honest, and end with what the founder should focus on next."
    )

    if settings.llm_provider.lower() == "groq":
        from backend.services.providers.groq import call_groq_simple
        return call_groq_simple(prompt, system_prompt, max_tokens=256)
    else:
        # Fallback: deterministic template
        if resolved_count > 0 and new_count == 0:
            return f"This commit resolved {resolved_count} issue(s), improving your overall health score by {net_health:+d} points. No new issues were introduced. Keep up the momentum."
        elif new_count > 0 and resolved_count == 0:
            return f"This commit introduced {new_count} new issue(s). Your health score changed by {net_health:+d} points. Review the new findings and address the highest-severity ones first."
        else:
            return f"This commit resolved {resolved_count} issue(s) and introduced {new_count} new one(s). Net health change: {net_health:+d} points. Review the new findings before your next release."


def extract_json_from_text(raw_text: str) -> dict:
    """Robust JSON recovery logic optimized for smaller local models."""
    raw_text = raw_text.strip()
    
    # Clean standard markdown blocks
    if raw_text.startswith("```"):
        raw_text = re.sub(r'^```(?:json)?\n?', '', raw_text)
        raw_text = re.sub(r'\n?```$', '', raw_text)
        
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
        
    # Regex fallback to extract the first {...} block
    match = re.search(r'(\{.*\})', raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
            
    raise ValueError(f"Could not extract valid JSON. Raw output: {raw_text[:200]}...")


def json_to_markdown(report_type: str, data: dict) -> str:
    """Convert structured JSON report output to readable Markdown."""
    lines = []
    title = data.get("title", report_type.replace("_", " ").title())
    lines.append(f"# {title}\n")

    if report_type == "executive_summary":
        if data.get('one_liner'):
            lines.append(f"*{data.get('one_liner')}*\n")
        for para in data.get("paragraphs", []):
            lines.append(f"{para}\n")

    elif report_type == "architecture":
        lines.append(f"{data.get('overview', '')}\n")
        lines.append("## Components\n")
        for comp in data.get("components", []):
            lines.append(f"### {comp.get('name', '')}")
            lines.append(f"**Technology:** {comp.get('technology', '')}")
            lines.append(f"{comp.get('role', '')}\n")
        if data.get("data_flow"):
            lines.append("## Data Flow\n")
            lines.append(data.get("data_flow", ""))

    elif report_type == "tech_debt":
        lines.append(f"{data.get('summary', '')}\n")
        lines.append("## Issues\n")
        for issue in data.get("issues", []):
            sev = issue.get("severity", "Medium")
            lines.append(f"### [{sev}] {issue.get('title', '')}")
            lines.append(f"{issue.get('description', '')}")
            lines.append(f"\n**Business Impact:** {issue.get('impact', '')}")
            lines.append(f"\n**Recommendation:** {issue.get('recommendation', '')}\n")

    elif report_type == "security":
        lines.append(f"{data.get('summary', '')}\n")
        lines.append("## Risks\n")
        for risk in data.get("risks", []):
            sev = risk.get("severity", "Medium")
            lines.append(f"### [{sev}] {risk.get('title', '')}")
            lines.append(f"{risk.get('description', '')}")
            lines.append(f"\n**Business Impact:** {risk.get('business_impact', '')}")
            lines.append(f"\n**Recommendation:** {risk.get('recommendation', '')}\n")

    elif report_type == "onboarding":
        lines.append(f"{data.get('overview', '')}\n")
        lines.append("## Setup Steps\n")
        for i, step in enumerate(data.get("setup_steps", []), 1):
            lines.append(f"### Step {i}: {step.get('step', '')}")
            lines.append(step.get("description", ""))
            if step.get("command"):
                lines.append(f"\n```bash\n{step['command']}\n```\n")
        if data.get("key_files"):
            lines.append("## Key Files\n")
            for f in data["key_files"]:
                lines.append(f"- **`{f.get('path', '')}`** — {f.get('purpose', '')}")
        if data.get("gotchas"):
            lines.append("\n## Watch Out For\n")
            for g in data["gotchas"]:
                lines.append(f"- {g}")

    elif report_type == "scalability":
        lines.append(f"{data.get('summary', '')}\n")
        if data.get("current_capacity"):
            lines.append(f"## Current Capacity\n")
            lines.append(f"{data['current_capacity']}\n")
        if data.get("bottlenecks"):
            lines.append("## Bottlenecks\n")
            for b in data["bottlenecks"]:
                sev = b.get("severity", "Medium")
                lines.append(f"### [{sev}] {b.get('title', '')}")
                lines.append(f"{b.get('description', '')}")
                lines.append(f"\n**Impact:** {b.get('impact', '')}")
                lines.append(f"\n**Recommendation:** {b.get('recommendation', '')}\n")
        if data.get("positives"):
            lines.append("## What Scales Well\n")
            for p in data["positives"]:
                lines.append(f"- {p}")

    elif report_type == "investor":
        if data.get("headline"):
            lines.append(f"*{data['headline']}*\n")
        if data.get("maturity_level"):
            lines.append(f"**Maturity:** {data['maturity_level']}\n")
        if data.get("technical_risk"):
            lines.append(f"**Technical Risk:** {data['technical_risk']}\n")
        if data.get("strengths"):
            lines.append("## Strengths\n")
            for s in data["strengths"]:
                lines.append(f"### {s.get('title', '')}")
                lines.append(f"{s.get('description', '')}\n")
        if data.get("risks"):
            lines.append("## Risks\n")
            for r in data["risks"]:
                lines.append(f"### [{r.get('severity', 'Medium')}] {r.get('title', '')}")
                lines.append(f"{r.get('description', '')}\n")
        if data.get("scalability_outlook"):
            lines.append(f"## Scalability Outlook\n{data['scalability_outlook']}\n")
        if data.get("risk_notes"):
            lines.append(f"## Risk Notes\n{data['risk_notes']}\n")
        if data.get("recommended_next_hires"):
            lines.append("## Recommended Next Hires\n")
            for role in data["recommended_next_hires"]:
                lines.append(f"- {role}")

    elif report_type == "team_readiness":
        if data.get("codebase_origin"):
            lines.append("## What your codebase tells us about who built it\n")
            lines.append(f"{data['codebase_origin']}\n")
        if data.get("immediate_hires"):
            lines.append("## Hires you need in the next 0-3 months\n")
            for hire in data["immediate_hires"]:
                lines.append(f"### {hire.get('role', '')}")
                lines.append(f"- **Why you need them:** {hire.get('why_needed', '')}")
                lines.append(f"- **What to look for:** {', '.join(hire.get('skills_to_look_for', []))}")
                lines.append(f"- **Red flags:** {', '.join(hire.get('red_flags', []))}")
                lines.append(f"- **Market rate:** {hire.get('market_rate', '')}\n")
        if data.get("future_hires"):
            lines.append("## Hires you'll need in 3-12 months\n")
            for hire in data["future_hires"]:
                lines.append(f"### {hire.get('role', '')}")
                lines.append(f"- **Why you need them:** {hire.get('why_needed', '')}")
                lines.append(f"- **What to look for:** {', '.join(hire.get('skills_to_look_for', []))}")
                lines.append(f"- **Red flags:** {', '.join(hire.get('red_flags', []))}")
                lines.append(f"- **Market rate:** {hire.get('market_rate', '')}\n")
        if data.get("team_structure"):
            lines.append("## How your team should be structured\n")
            lines.append(f"{data['team_structure']}\n")
        if data.get("hiring_order"):
            lines.append("## Hiring order and why\n")
            for item in data["hiring_order"]:
                lines.append(f"{item.get('order', '')}. **{item.get('role', '')}** — {item.get('consequence', '')}")
        if data.get("trixon_note"):
            lines.append(f"\n---\n\n## A note from Trixon\n")
            lines.append(f"{data['trixon_note']}\n")

    return "\n".join(lines)


def generate_report(
    report_type: str,
    context: dict[str, Any],
    max_retries: int = 1,
) -> ReportOutput:
    """
    Generate a single analysis report routing to the active LLM provider.
    """
    settings = get_settings()

    system_prompt = SYSTEM_PROMPTS.get(report_type)
    if not system_prompt:
        return ReportOutput(
            report_type=report_type,
            content_json={},
            content_markdown="",
            score=0,
            error=f"Unknown report type: {report_type}",
        )

    context_prompt = build_context_prompt(context)

    if settings.llm_provider.lower() == "groq":
        from backend.services.providers.groq import generate_groq_report
        return generate_groq_report(report_type, context_prompt, system_prompt, max_retries)
    elif settings.llm_provider.lower() == "ollama":
        from backend.services.providers.ollama import generate_ollama_report
        return generate_ollama_report(report_type, context_prompt, system_prompt, max_retries)
    else:
        from backend.services.providers.gemini import generate_gemini_report
        return generate_gemini_report(report_type, context_prompt, system_prompt, max_retries)


def simplify_text(text: str) -> str:
    """
    Takes a complex technical section and uses the configured LLM to explain it simply.
    """
    settings = get_settings()
    
    system_prompt = (
        "You are a brilliant technical co-founder explaining a concept to a non-technical founder. "
        "Explain the provided text simply, using analogies if helpful. Keep it concise. "
        "Do not use jargon. Respond ONLY with the simplified explanation."
    )
    
    if settings.llm_provider.lower() == "groq":
        from backend.services.providers.groq import simplify_text_groq
        return simplify_text_groq(text, system_prompt)
    elif settings.llm_provider.lower() == "ollama":
        from backend.services.providers.ollama import simplify_text_ollama
        return simplify_text_ollama(text, system_prompt)
    else:
        from backend.services.providers.gemini import simplify_text_gemini
        return simplify_text_gemini(text, system_prompt)
