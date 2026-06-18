# Trixon — Antigravity Changes Prompt v3.1
### Addendum: User-Selected Reports + Token-Constrained Analysis Pipeline (Beta)

---

## CONTEXT

This addendum modifies the analysis pipeline from v3.0 for **beta testing constraints**:

- **LLM Provider:** Grok API (`api.x.ai/v1` — OpenAI-compatible endpoint)
- **Models:** `qwen/qwen3-32b` or `openai/gpt-oss-120b`
- **Hard constraint:** 7,000 tokens/minute (TPM) rate limit

At this TPM, generating all 7 reports per snapshot via separate calls is not viable — both for cost and for rate-limit reasons during beta. This addendum (1) lets users select which reports to generate, and (2) restructures the context-building strategy so that "full coverage" doesn't mean "raw code dump."

---

## PART 1 — USER-SELECTED REPORTS

### New Concept: Report Catalog

Replace the fixed "always generate all 7" behavior. After static extraction completes (Step 2 of the pipeline — no AI calls yet), present the founder with a **Report Catalog** screen before triggering any AI generation.

### New table: `report_catalog` (seed data, not user-editable)

```sql
report_catalog (
  id text primary key,              -- 'executive_summary', 'architecture', 'tech_debt', etc.
  title text,
  description text,                 -- shown to user when selecting
  best_for text,                    -- "Best if you're: ..." — ties to onboarding primary_goal
  estimated_tokens integer,         -- rough cost estimate for this report's generation call
  is_default boolean default false  -- pre-checked for new users
)
```

Seed data:

| id | title | description | best_for | est. tokens | default |
|---|---|---|---|---|---|
| `executive_summary` | What You Built | A plain-English overview of your whole system | Everyone | ~1200 | ✅ |
| `architecture` | How It All Connects | How your frontend, backend, and database talk to each other | Hiring devs, understanding your system | ~1500 | ✅ |
| `tech_debt` | What's Messy & Risky | Issues ranked by severity, with fixes you can paste into your AI coding tool | Everyone | ~1800 | ✅ |
| `security` | Security Risk Scan | Hardcoded secrets, exposed endpoints, missing auth | Pre-launch, enterprise questions | ~1500 | off |
| `scalability` | Can It Handle Growth? | What breaks first if you 10x your users | Pre-launch, scaling up | ~1500 | off |
| `onboarding` | Dev Onboarding Guide | What a new hire needs to know on day 1 | Hiring devs | ~1500 | off |
| `investor` | Investor Technical Summary | A 1-pager framing your codebase for due diligence | Raising a round | ~1200 | off |

### Modify: `analyses` table
```sql
ALTER TABLE analyses
  ADD COLUMN selected_reports text[];  -- e.g. ['executive_summary', 'tech_debt', 'security']
```

### New API Route
```
GET    /api/v1/report-catalog
       — Returns the report_catalog, with `is_default` pre-flagged.
         If profiles.primary_goal is set, reorder/highlight reports whose
         `best_for` matches the founder's stated goal.
```

### Modify: `POST /api/v1/projects/{id}/analyze`
```
Body: { selected_reports?: string[], commit_sha?: string, trigger_source?: string }

If selected_reports is omitted:
  - For Snapshot #1 (first analysis): use is_default=true reports
  - For Snapshot #2+: reuse the selected_reports from the previous snapshot
    (so re-analysis stays consistent unless the user changes it)
```

### New Frontend Screen: Report Selection (before first analysis)

**Route:** Shown as a step in `/onboarding` after repo connection, before triggering analysis. Also accessible later via a "Change reports" link on the dashboard.

**UI:**
- Heading: "What do you want Trixon to look at?"
- Subtext: "Pick what's useful right now. You can always run others later — Trixon remembers your codebase, so adding a report later won't repeat work."
- Cards for each catalog item: title, description, checkbox (defaults pre-checked based on `is_default` and reordered by `primary_goal` match)
- A small note next to non-default items if locked by plan (tie into the Builder/Founder tiers from pricing discussion — e.g. Free tier = max 3 reports per snapshot, Builder+ = up to 7)
- CTA: "Run analysis →"

### Modify: `/projects/[id]/reports`
- Only show cards for reports in `analyses.selected_reports` for the latest snapshot
- Add a "+ Add report" card at the end → opens the Report Catalog modal, lets user select additional reports → triggers a **targeted generation call** (only for the newly selected reports, using existing snapshot's static extraction — no need to re-run the whole pipeline)

---

## PART 2 — TOKEN-CONSTRAINED CONTEXT PIPELINE

### The core principle

**"Full context" ≠ "raw code dump."** Your static extraction (Step 2 of the existing pipeline) already produces a compact structured summary of the *entire* repo — every file, every dependency, every route, every env var — regardless of repo size. That summary is small (typically 500-1500 tokens even for large repos) and is **never clipped**. This becomes the backbone of every report's context.

Raw code is only pulled in **selectively, per report type**, for a small number of specific files identified as relevant by the static extraction — not by arbitrary truncation.

### Context Layers (build once per snapshot, reuse across reports)

```python
def build_context_layers(project_id: str, analysis_id: str) -> dict:
    """
    Built ONCE per snapshot. Reused (sliced differently) for each
    selected report's generation call. This avoids re-fetching/re-processing
    the repo for every report.
    """
    static = get_static_extraction(analysis_id)  # already exists from Step 2

    return {
        # LAYER 1: Always included, ~500-1000 tokens, full repo coverage
        "repo_summary": {
            "languages": static.language_breakdown,
            "frameworks": static.frameworks,
            "dependencies": static.dependencies,          # names + versions only, not full lockfiles
            "file_tree": static.file_tree_compact,         # paths only, depth-limited (e.g. 3 levels)
            "stats": static.stats,                          # files, lines, endpoints, contributors
        },

        # LAYER 2: Always included, ~300-600 tokens
        "signals": {
            "routes": static.api_routes,                   # method + path only, e.g. "POST /api/users"
            "env_vars_referenced": static.env_var_names,   # names only, never values
            "third_party_services": static.third_party_services,
            "db_models": static.db_model_names,            # model/table names + field names, not full schema
            "git_stats": static.git_stats,
        },

        # LAYER 3: Built on-demand per report type (see below)
        "targeted_files": {}  # populated by report-specific selectors
    }
```

### Per-Report File Selection (Layer 3)

Each report type pulls in **only the files it needs**, and only the relevant *parts* of those files — not full source dumps. Define a selector per report type:

```python
FILE_SELECTORS = {
    "executive_summary": lambda static: {
        "files": [static.readme_path] if static.readme_path else [],
        "extraction": "full",  # README is usually small, include fully
        "max_files": 1,
    },
    "architecture": lambda static: {
        "files": static.entry_point_files,  # main.py, app.py, layout.tsx, index.ts etc.
        "extraction": "signatures",  # function/class signatures + imports only, not bodies
        "max_files": 5,
    },
    "tech_debt": lambda static: {
        "files": static.largest_files[:3] + static.most_complex_files[:2],
        "extraction": "signatures_plus_flagged_lines",
        # signatures for structure, but include full lines for anything matching
        # known anti-pattern regexes (TODO, FIXME, deeply nested code, long functions)
        "max_files": 5,
    },
    "security": lambda static: {
        "files": static.files_with_env_usage + static.auth_related_files,
        "extraction": "full_for_env_lines",
        # only the specific lines referencing env vars / secrets / auth, with
        # 2 lines of surrounding context — not the whole file
        "max_files": 5,
    },
    "scalability": lambda static: {
        "files": static.db_query_files + static.entry_point_files[:2],
        "extraction": "signatures",
        "max_files": 4,
    },
    "onboarding": lambda static: {
        "files": [static.readme_path, *static.entry_point_files[:2]],
        "extraction": "signatures",
        "max_files": 3,
    },
    "investor": lambda static: {
        "files": [],  # investor summary should derive entirely from repo_summary + signals,
        "extraction": None,  # no raw code needed — keeps this report's call very cheap
        "max_files": 0,
    },
}
```

### Extraction Modes (how "targeted_files" content is built)

- **`full`** — entire file content included (only for small files like README, < 100 lines)
- **`signatures`** — only function/class definitions, imports, and route decorators (strip function bodies). Use simple AST parsing (Python `ast` module / regex for JS/TS) — this is deterministic, no AI call needed, and is typically 80-90% smaller than full source
- **`signatures_plus_flagged_lines`** — signatures, plus full lines (± 2 lines context) for anything matching anti-pattern patterns (long functions by line count, deep nesting, `TODO`/`FIXME`/`HACK` comments, duplicate-looking blocks)
- **`full_for_env_lines`** — only lines referencing `process.env`, `os.environ`, `os.getenv`, hardcoded-looking strings near auth/payment keywords, ± 2 lines context

**Why this solves the "clipping" problem:** Instead of truncating a file at an arbitrary character limit (which might cut off mid-function and lose meaning), each extraction mode produces a *complete, meaningful unit* — a full signature, a full flagged block, a full README. Nothing is cut mid-thought. The tradeoff is breadth-for-depth: you see less of each file, but what you see is whole and the static layer ensures nothing in the repo is invisible to the model — it's described in Layer 1/2 even if not shown in full in Layer 3.

### Per-Report Token Budgeting

Given 7,000 TPM, and that report generation calls should ideally run sequentially (not in parallel, to respect the per-minute limit) or be spread with small delays:

```python
TOKEN_BUDGET_PER_CALL = 6000  # leave headroom under 7000 TPM

def build_report_context(report_type: str, layers: dict) -> str:
    base = layers["repo_summary"] + layers["signals"]  # ~800-1600 tokens, always included
    remaining_budget = TOKEN_BUDGET_PER_CALL - estimate_tokens(base) - PROMPT_OVERHEAD

    selector = FILE_SELECTORS[report_type]
    targeted = extract_files(selector, layers, max_tokens=remaining_budget)

    return format_context(base, targeted)
```

If a report type's targeted files would exceed the remaining budget even at `signatures` level, drop the lowest-priority file from the selection (not truncate it) — prioritize by the order files appear in the selector list.

### Sequencing for Rate Limits

```python
# In analyze_project RQ job:
for report_type in analysis.selected_reports:
    context = build_report_context(report_type, layers)
    result = call_grok_api(report_type, context)  # ~6000 tokens
    store_report(analysis_id, report_type, result)
    time.sleep(60)  # respect 7000 TPM — wait for the rate limit window to reset
    # OR: track token usage and only sleep if approaching the limit
```

For beta, with 3 default reports selected, this means analysis takes ~2-3 minutes (3 calls × ~60s spacing) — acceptable for the async "analyzing your codebase" UX you already built.

---

## UPDATED ENV VARS

```bash
# Replace/add
LLM_API_BASE=https://api.x.ai/v1
LLM_API_KEY=                          # Grok API key
LLM_MODEL_PRIMARY=qwen/qwen3-32b       # or openai/gpt-oss-120b
LLM_TPM_LIMIT=7000
```

Update the existing Claude API client wrapper to be **provider-agnostic** (OpenAI-compatible client pointed at `LLM_API_BASE`) — this keeps the door open to switch to Claude/OpenAI later for production without rewriting the pipeline, just by changing env vars.

---

## SUCCESS CRITERIA (Addendum)

- [ ] Report Catalog screen appears before first analysis, with defaults pre-checked
- [ ] Selecting fewer reports results in fewer Grok API calls during analysis (verify via logs)
- [ ] `/projects/[id]/reports` only shows cards for selected reports
- [ ] "+ Add report" flow generates only the newly added report without re-running full pipeline
- [ ] Static extraction (Layers 1+2) is generated once per snapshot and reused across all report calls
- [ ] No single report generation call exceeds ~6000 tokens of input context
- [ ] `signatures` extraction mode correctly strips function bodies while preserving signatures/imports for at least Python and JS/TS files
- [ ] Security report's `full_for_env_lines` extraction correctly surfaces env var usage lines with context
- [ ] Investor report generates with zero raw code in context (repo_summary + signals only)
- [ ] Total analysis time for 3 default reports stays under ~4 minutes
