# Trixon — Antigravity Changes Prompt v3.0
### Strategic Pivot: From One-Time Audit → Continuous Codebase Intelligence Platform

---

## CONTEXT & OBJECTIVE

You are modifying the existing Trixon codebase (built from v1.0, with v2.0's audit-purchase model now **superseded** — do not implement v2.0's Stripe one-time-payment flow if not already built; if it is partially built, we are evolving it into a subscription model instead).

**The core insight driving this pivot:** A one-time "here's what's wrong with your code" report is a commodity — any AI coding tool can produce one. What no AI coding tool does is **remember**. Trixon's new identity:

> Trixon is the technical memory and conscience of your codebase. Every time you ship, Trixon tells you what changed, what got better, what got worse, and exactly what to do next — with a ready-to-paste prompt for your AI coding tool of choice.

**The product is now three things working together:**
1. **Continuous Analysis** — not a one-time report, but a living history. Every commit (or on-demand re-analysis) produces a new snapshot that's compared against the last one.
2. **Conversational Memory** — a persistent chat per project where the founder can ask questions, and Trixon remembers everything from every past analysis, every past conversation, every decision made.
3. **Action Engine** — every finding is ranked, scoped, and converted into a ready-to-use prompt the founder can paste directly into Cursor, Claude Code, Antigravity, Codex, etc. Trixon doesn't compete with these tools — it directs them.

---

## NEW CORE CONCEPT: ANALYSIS SNAPSHOTS & DIFFS

### What changes conceptually
Currently, `analyses` represents one-off runs. Now, every analysis is a **snapshot in a timeline** tied to a specific commit SHA. The product's primary value is the **diff between snapshots**.

### New flow
1. Founder connects repo (existing flow — unchanged)
2. First analysis runs (existing pipeline — unchanged) → this becomes **Snapshot #1 (baseline)**
3. Founder can:
   - Manually trigger "Re-analyze" (existing button — now means "create new snapshot")
   - **NEW:** Connect a webhook (GitHub/GitLab) so every push to the default branch automatically queues a new snapshot
4. When Snapshot #2+ completes, Trixon runs a **Diff Engine** that compares it against the previous snapshot and generates a **Changelog Report**:
   - What improved (scores that went up, issues resolved)
   - What got worse (new issues, score drops, new dependencies, new third-party services)
   - What's new (new files, new endpoints, new env vars)
   - Net verdict: "This commit moved you forward" / "This commit introduced new risk" / "Mixed — see details"
5. The founder gets notified (email or in-app) with a one-line summary: *"Your last commit fixed 2 security issues but added 1 new tech debt item. [View changelog →]"*

---

## DATABASE CHANGES

### Modify: `analyses` table
```sql
ALTER TABLE analyses
  ADD COLUMN commit_sha text,
  ADD COLUMN commit_message text,
  ADD COLUMN commit_author text,
  ADD COLUMN snapshot_number integer,           -- 1, 2, 3... per project, auto-incremented
  ADD COLUMN previous_analysis_id uuid references analyses(id),
  ADD COLUMN trigger_source text default 'manual';  -- 'manual' | 'webhook' | 'scheduled'
```

### New table: `analysis_diffs`
```sql
analysis_diffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  from_analysis_id uuid references analyses(id),
  to_analysis_id uuid references analyses(id),
  score_deltas jsonb,
  -- { "health": +5, "security": -10, "scalability": 0, "quality": +2, "docs": 0 }
  resolved_findings jsonb,   -- findings present in `from` but not in `to`
  new_findings jsonb,        -- findings present in `to` but not in `from`
  unchanged_findings jsonb,  -- still present in both — "you've known about this for X snapshots"
  verdict text,              -- 'improved' | 'regressed' | 'mixed' | 'no_change'
  summary_markdown text,     -- AI-generated 2-3 sentence changelog summary
  created_at timestamptz default now()
)
```

### New table: `action_items`
```sql
-- Every finding becomes a trackable, actionable item
action_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  analysis_id uuid references analyses(id),       -- snapshot where first detected
  category text,             -- 'security' | 'tech_debt' | 'scalability' | 'quality' | 'docs'
  severity text,             -- 'critical' | 'high' | 'medium' | 'low'
  title text,                -- "Hardcoded Stripe key in payment_service.py"
  description text,          -- plain-English explanation
  effort_level text,         -- 'quick-win' | 'moderate' | 'complex' | 'architectural'
  status text default 'open', -- 'open' | 'resolved' | 'ignored' | 'in_progress'
  ai_prompt text,            -- ready-to-paste prompt for Cursor/Claude/Codex/etc.
  file_paths jsonb,          -- relevant file paths from the codebase
  resolved_in_analysis_id uuid references analyses(id), -- which snapshot fixed it
  first_detected_at timestamptz default now(),
  resolved_at timestamptz,
  created_at timestamptz default now()
)
```

### New table: `project_chats` (Conversational Memory)
```sql
project_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  user_id uuid references profiles(id),
  role text,                 -- 'user' | 'assistant'
  content text,
  referenced_analysis_id uuid references analyses(id), -- which snapshot context this msg used
  referenced_action_items jsonb,  -- array of action_item ids mentioned
  created_at timestamptz default now()
)
```

### New table: `webhook_connections`
```sql
webhook_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  platform text,             -- 'github' | 'gitlab'
  webhook_id text,           -- ID returned by GitHub/GitLab when webhook created
  webhook_secret text,       -- for signature verification
  is_active boolean default true,
  created_at timestamptz default now()
)
```

---

## BACKEND CHANGES (FastAPI)

### New Environment Variables
```bash
# Webhook signing
GITHUB_WEBHOOK_SECRET=
GITLAB_WEBHOOK_SECRET=

# Chat
ANTHROPIC_API_KEY=  # already exists — chat uses same key
```

### New API Routes

```
# Webhooks
POST   /api/v1/projects/{id}/webhook/enable
       — Creates a GitHub/GitLab push webhook for the repo's default branch.
         Stores in webhook_connections. Returns { webhook_id, status }.

POST   /api/v1/projects/{id}/webhook/disable
       — Removes the webhook from GitHub/GitLab and deactivates the record.

POST   /api/v1/webhooks/github
       — Receives GitHub push events. Verifies signature using GITHUB_WEBHOOK_SECRET.
         On push to default branch: queue analyze_project job with commit_sha, commit_message, commit_author.

POST   /api/v1/webhooks/gitlab
       — Same for GitLab.

# Diffs & Timeline
GET    /api/v1/projects/{id}/timeline
       — Returns all analyses for the project, ordered by snapshot_number, with summary scores per snapshot (for a trend chart).

GET    /api/v1/analyses/{id}/diff
       — Returns the analysis_diff comparing this analysis to its previous_analysis_id.

GET    /api/v1/projects/{id}/diffs/{diff_id}
       — Returns full diff detail (resolved/new/unchanged findings + changelog summary).

# Action Items
GET    /api/v1/projects/{id}/action-items
       — Returns all action_items for the project, filterable by ?status=open&severity=critical&category=security.
         Default sort: severity desc, then effort_level asc (quick wins first).

PATCH  /api/v1/action-items/{id}
       — Update status: { "status": "resolved" | "ignored" | "in_progress" }.
         Manual override — but normally status updates automatically via diff engine when a finding disappears.

GET    /api/v1/action-items/{id}/prompt
       — Returns the ai_prompt for this item, formatted and ready to copy.

# Conversational Memory (Chat)
GET    /api/v1/projects/{id}/chat
       — Returns chat history for this project (paginated, most recent first).

POST   /api/v1/projects/{id}/chat
       — Body: { message: string }.
         Builds context from: latest analysis snapshot, relevant action_items,
         last N chat messages, and project metadata.
         Calls Claude API, streams response back (SSE).
         Stores both user message and assistant response in project_chats.
```

### Diff Engine Logic (runs after every snapshot completes)

```python
def compute_diff(project_id: str, new_analysis_id: str, previous_analysis_id: str | None):
    """
    Runs as the final step of analyze_project, after the new snapshot's
    action_items have been extracted from the 7/8 reports.
    """
    if previous_analysis_id is None:
        # First snapshot — no diff, just baseline
        return None

    new_items = get_action_items(analysis_id=new_analysis_id)
    prev_items = get_action_items(analysis_id=previous_analysis_id, include_resolved=False)

    # Match items by title similarity / file_path overlap (use simple heuristic
    # or a single Claude call to match "is this the same issue as before?")
    resolved = [item for item in prev_items if not matches_any(item, new_items)]
    new_findings = [item for item in new_items if not matches_any(item, prev_items)]
    unchanged = [item for item in new_items if matches_any(item, prev_items)]

    # Mark resolved items in DB
    for item in resolved:
        update_action_item(item.id, status='resolved', resolved_in_analysis_id=new_analysis_id)

    # Compute score deltas
    score_deltas = compute_score_deltas(new_analysis_id, previous_analysis_id)

    # Determine verdict
    verdict = determine_verdict(score_deltas, resolved, new_findings)
    # 'improved' if net positive, 'regressed' if net negative, 'mixed' if both, 'no_change' if neither

    # Generate changelog summary via Claude (1 call)
    summary_markdown = generate_changelog_summary(
        resolved=resolved, new_findings=new_findings,
        score_deltas=score_deltas, commit_message=get_commit_message(new_analysis_id)
    )

    return create_analysis_diff(...)
```

### Action Item Extraction (modify existing report generation)

For each of the existing report Claude calls (Tech Debt, Security, Scalability), **add a structured extraction step**: after generating the human-readable Markdown report, make a follow-up Claude call (or use tool-calling/structured output) to extract individual findings as `action_items` with this shape:

```json
{
  "title": "Hardcoded Stripe secret key in payment_service.py",
  "category": "security",
  "severity": "critical",
  "description": "Your Stripe secret key is written directly in the code instead of an environment variable. Anyone with access to this code can see it and use it.",
  "effort_level": "quick-win",
  "file_paths": ["backend/services/payment_service.py"],
  "ai_prompt": "In `backend/services/payment_service.py`, find the hardcoded Stripe secret key (starts with `sk_`). Move it to an environment variable called `STRIPE_SECRET_KEY`, load it using `os.environ.get('STRIPE_SECRET_KEY')`, and add `STRIPE_SECRET_KEY=` to the `.env.example` file. Do not commit the actual key value anywhere."
}
```

**The `ai_prompt` field is the product's signature feature.** Each prompt must be:
- Self-contained (an AI coding tool can act on it without additional context)
- Specific to file paths found in the actual codebase
- Scoped to one fix (not "improve security" — but "do this one specific thing")

### Conversational Memory — Context Building

```python
def build_chat_context(project_id: str, message: str) -> str:
    """
    Assembles context for each chat message:
    1. Project metadata (name, repo, last analyzed date, current health score)
    2. Latest analysis snapshot summary (executive summary + scores)
    3. Open action_items (top 10 by severity)
    4. Last analysis_diff summary (what changed most recently)
    5. Last 10 chat messages (rolling window)

    System prompt frames Claude as "Trixon" — a technical co-founder who has
    been watching this codebase evolve and remembers every conversation.
    """
```

System prompt for chat should include an instruction like:
> You are Trixon, an AI technical advisor who has full memory of this founder's codebase history. Reference specific past findings, snapshots, and conversations naturally — e.g. "Last time we talked about your auth setup, you mentioned you'd fix it before launch — looks like that's still open." Be direct, warm, and always end with a concrete next step.

---

## FRONTEND CHANGES (Next.js)

### New Route: `/projects/[id]/timeline`
- Horizontal timeline / trend chart (Recharts line chart) showing health score over snapshots
- Each point on the timeline is clickable → opens that snapshot's diff
- List view below chart: each snapshot as a row showing commit message, date, verdict badge (improved/regressed/mixed), score delta

### New Route: `/projects/[id]/diffs/[diffId]`
- Changelog-style page:
  - Header: "Snapshot #N vs Snapshot #N-1" + commit info
  - Verdict badge (large, color-coded: turquoise=improved, red=regressed, amber=mixed)
  - AI-generated changelog summary (2-3 sentences)
  - Three columns: ✅ Resolved | 🆕 New Issues | ⏳ Still Open
  - Each item links to its action_items detail

### New Route: `/projects/[id]/action-items`
**This is the new primary "what do I do next" hub.**
- Filterable list: by status, severity, category
- Default view: open items, sorted by severity (critical first) then effort (quick-wins first)
- Each item is a card:
  - Severity badge + category icon
  - Title + plain-English description
  - "First detected: Snapshot #3 (4 days ago)" — shows age/persistence
  - Effort badge (quick-win / moderate / complex / architectural)
  - **"Copy AI Prompt" button** — copies `ai_prompt` to clipboard with toast: "Paste this into Cursor, Claude Code, or your AI coding tool"
  - "Mark as resolved" / "Ignore" actions
- Empty state when all resolved: celebratory — "Nothing open right now. Trixon will flag anything new on your next commit."

### New Component: `ProjectChat` (persistent sidebar or `/projects/[id]/chat`)
- Chat UI similar to Claude/ChatGPT — message list + input box
- Streaming responses (SSE)
- Each assistant message can render inline references to action items (clickable chips that link to `/projects/[id]/action-items#item-id`)
- Suggested starter prompts on empty state:
  - "What should I focus on this week?"
  - "Explain my biggest security risk like I'm new to this"
  - "What changed since my last commit?"

### Modify: `/projects/[id]` (Project Dashboard)
- Add **"Live since [date]"** indicator if webhook is connected, or **"Connect auto-tracking →"** CTA if not
- Add trend sparklines next to each score ring (mini line chart showing last 5 snapshots)
- Add "Latest changelog" card: shows most recent diff summary with link to full diff
- Add "X open action items (Y quick wins)" summary card → links to action items page

### New: Webhook Setup Flow
- In project settings or dashboard: toggle "Auto-analyze on every push"
- On enable: calls `/webhook/enable`, shows confirmation: "Trixon will now analyze every push to `main`. You'll get a changelog after each one."
- Show webhook status (active/inactive) with last-triggered timestamp

---

## NOTIFICATION SYSTEM (New)

After each automated (webhook-triggered) snapshot completes:
- Send email via Resend:
  - Subject: `[Trixon] New changelog for {repo_name} — {verdict}`
  - Body: changelog summary, score deltas, link to full diff
  - If verdict is 'regressed': slightly more urgent tone — "Your last commit introduced new risk. [See what changed →]"
  - If verdict is 'improved': encouraging — "Nice work — you resolved {N} issues. [See the full picture →]"

---

## WHAT TO KEEP FROM v1.0 / v2.0

**Keep as-is:**
- All 7 (or 8, if Team Readiness was built) existing report types and Claude prompts
- The analysis pipeline (RQ + Railway + Redis)
- GitHub/GitLab OAuth and token handling
- Dashboard score rings, language donut, third-party icons
- Share link system for individual reports
- Design tokens and brand palette
- ELI5 toggle
- AES-256 token encryption, RLS policies

**Carry over from v2.0 (still useful in new model):**
- "Share with Trixon" button concept — repurpose as **"Get expert help with this →"** on any action_item, especially `architectural` effort-level items. This is the BOT-consulting bridge: quick-wins are "do it yourself with this AI prompt," architectural items are "this might need a real conversation with Trixon."
- The `/engage` page concept (BOT consulting) — keep as a separate page, linked from architectural-complexity action items, not pushed everywhere.

**Deprecate from v2.0:**
- $497 one-time Stripe Checkout flow — do not build, or if built, leave dormant/unrouted
- Free tier report-locking (executive_summary + security only) — superseded by new pricing below

---

## SUCCESS CRITERIA

- [ ] Connecting a repo and analyzing produces Snapshot #1 with `snapshot_number = 1`, `previous_analysis_id = null`
- [ ] Manual re-analysis produces Snapshot #2, triggers diff engine, creates `analysis_diffs` record
- [ ] Diff correctly identifies at least: score deltas, resolved findings (if any), new findings (if any)
- [ ] Webhook setup successfully registers a GitHub push webhook and receives test events
- [ ] A push to the connected repo triggers a new snapshot automatically within 5 minutes
- [ ] Action items are extracted from reports with valid, file-path-specific `ai_prompt` fields
- [ ] `/projects/[id]/action-items` shows open items sorted by severity then effort, with working "Copy AI Prompt" buttons
- [ ] `/projects/[id]/timeline` shows a trend chart across all snapshots
- [ ] `/projects/[id]/diffs/[diffId]` renders resolved/new/unchanged findings correctly
- [ ] Chat interface at `/projects/[id]/chat` maintains conversation history and references real action items/scores from the latest snapshot
- [ ] Chat responses stream (SSE) and reference specific codebase findings, not generic advice
- [ ] Email notification sent after webhook-triggered snapshot, with correct verdict framing
