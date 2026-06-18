# Trixon — Usage Analytics + Admin Dashboard

---

## CONTEXT & SCOPE

Add lightweight, self-hosted usage-event tracking (no third-party analytics SaaS — zero additional cost, consistent with free-tier hosting) to understand product usage: feature adoption, funnel drop-off, engagement. This is scoped to **behavioral/usage data only** — it does NOT collect additional code or repo content beyond what's already gathered for core analysis. Pair this with an admin-only dashboard to visualize it.

**Before this ships to real beta users:** this data collection needs to be disclosed in the privacy policy (see companion data-flow inventory document) and ideally surfaced via consent at signup. Flagging this again here since it's the actual launch-readiness condition, not just a nice-to-have.

---

## PART 1 — Event Tracking Infrastructure

### 1. Database

#### [NEW] Table: `usage_events`

```sql
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  project_id uuid REFERENCES projects(id),  -- nullable; not all events are project-scoped
  event_type text NOT NULL,
  event_properties jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created ON usage_events(created_at);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users view own events" ON public.usage_events
  FOR SELECT USING (user_id = auth.uid());

-- Admins can see all events (requires profiles.is_admin column added below)
CREATE POLICY "Admins view all events" ON public.usage_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

#### [MODIFY] `profiles` table — add admin flag

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
-- Manually set your own account: UPDATE profiles SET is_admin = true WHERE id = '<your-user-id>';
```

### 2. Event Tracking Helper

#### [NEW] `backend/services/analytics.py`

```python
def track_event(
    user_id: str,
    event_type: str,
    project_id: str | None = None,
    properties: dict | None = None,
) -> None:
    """
    Fire-and-forget event tracking. Failures here should NEVER break the
    actual feature being tracked — wrap in try/except and log, don't raise.
    """
    try:
        supabase.table("usage_events").insert({
            "user_id": user_id,
            "project_id": project_id,
            "event_type": event_type,
            "event_properties": properties or {},
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to track event '{event_type}' for user {user_id}: {e}")
```

### 3. Instrumentation Points

Add `track_event(...)` calls at these points — non-blocking, fire-and-forget, never affecting the actual feature's behavior or response time:

```python
EVENT_TYPES = {
    "signup_completed",        # after onboarding profile creation
    "repo_connected",          # after a project is created
    "analysis_triggered",      # include properties: {"trigger_source": "manual"|"webhook", "selected_reports": [...]}
    "analysis_completed",      # include properties: {"duration_seconds": ..., "reports_generated": N}
    "report_viewed",           # include properties: {"report_type": "..."}
    "report_added",            # via the "+Add report" flow
    "chat_message_sent",       # include properties: {"message_length": N} — NOT the message content itself
    "action_item_status_changed",  # include properties: {"status": "resolved"|"ignored"|"in_progress"}
    "webhook_enabled",
    "report_shared",
    "report_exported_pdf",
}
```

**Privacy note baked into the design:** do NOT log the actual content of chat messages, report text, or action item details in `event_properties` — only metadata about the event (lengths, types, counts, durations). This keeps the analytics layer itself from becoming a second copy of sensitive data.

Add the corresponding `track_event(...)` call in each relevant existing route/worker function (signup completion in the auth/onboarding flow, project creation endpoint, `trigger_analysis`, the end of `run_analysis_job`, report detail page view — likely needs a small `POST /api/v1/analytics/report-viewed` ping from the frontend since page views aren't naturally a backend event — chat message handler, action item PATCH endpoint, webhook enable endpoint, share/export endpoints).

---

## PART 2 — Admin API Routes

#### [NEW] `backend/api/admin_metrics.py`

All routes require `is_admin = true` on the requesting user — add a dependency:

```python
async def require_admin(user = Depends(get_current_user)):
    profile = supabase.table("profiles").select("is_admin").eq("id", user.id).single().execute().data
    if not profile or not profile.get("is_admin"):
        raise HTTPException(403, "Admin access required")
    return user
```

```
GET /api/v1/admin/metrics/overview
— Returns: total_users, total_projects, total_analyses, total_chat_messages,
  signups_last_7_days, signups_last_30_days, active_projects_last_7_days
  (a project counts as "active" if it has an analysis or chat event in that window)

GET /api/v1/admin/metrics/signups-timeseries?days=30
— Returns daily signup counts for the last N days, for a line chart

GET /api/v1/admin/metrics/feature-adoption
— Returns: % of users with webhook enabled, % who've sent at least one chat message,
  % who've shared a report, % who've exported a PDF, most-viewed report types
  (count of report_viewed events grouped by report_type)

GET /api/v1/admin/metrics/health-score-distribution
— Returns aggregate (anonymized — no project/user identifiers) distribution of
  health_score across all analyses, bucketed (0-25, 25-50, 50-75, 75-100) —
  useful product insight, explicitly aggregate/anonymous in this endpoint's output

GET /api/v1/admin/metrics/recent-activity?limit=50
— Returns the most recent usage_events across all users, for a live activity feed
  (include user email/name for admin's own debugging context — this endpoint is
  admin-only and not anonymized, unlike health-score-distribution)
```

All routes protected by `require_admin` dependency from above.

---

## PART 3 — Admin Dashboard UI

#### [NEW] `/admin` route (Next.js)

Protect at the page level: on load, check the current user's `is_admin` via a quick API call (or include it in the session/profile data already fetched on login); redirect to `/dashboard` with no error message shown (don't reveal that an admin page exists to non-admins) if `is_admin` is false.

**Layout — single-page dashboard, sections in order:**

1. **Overview cards** (4-6 stat cards): Total Users, Total Projects, Total Analyses Run, Total Chat Messages, Signups (Last 7 Days), Active Projects (Last 7 Days)

2. **Signups over time** — line chart (Recharts), last 30 days, daily granularity

3. **Feature adoption** — simple bar chart or list with percentages: webhook auto-tracking adoption, chat usage, sharing usage, PDF export usage

4. **Most-viewed report types** — bar chart showing which of the 7 report types get viewed most, to inform which reports are actually valuable vs. ignored

5. **Health score distribution** — bar chart showing the bucketed distribution across all analyzed projects (anonymized, aggregate only)

6. **Recent activity feed** — scrollable list of the most recent 50 events, showing user (name/email), event type, and a human-readable summary (e.g. "Jane connected a new repo," "John ran an analysis on Evolve-AI-Chatbot," "Priya shared a report") — built from `event_properties` and joined user/project names

Use the existing brand design tokens and `card-elevated` styling established in the v3.5 design system pass — this is an internal tool, so it doesn't need the same polish as the public marketing site, but should still look like part of the same product, not a bare unstyled page.

---

## SUCCESS CRITERIA

- [ ] `usage_events` table created with correct RLS — a regular user cannot query another user's events, and cannot access admin-aggregate endpoints
- [ ] Setting `is_admin = true` on your own account grants access to `/admin`; any other account is redirected away
- [ ] All instrumentation points fire correctly — verify by performing each tracked action (signup, connect repo, trigger analysis, view a report, send a chat message, change an action item's status, enable webhook, share a report, export a PDF) and confirming a corresponding row appears in `usage_events`
- [ ] Tracking failures never break the underlying feature — confirm by temporarily breaking the tracking call and verifying the actual feature (e.g. triggering analysis) still works fine
- [ ] No chat message content, report text, or action item descriptions appear anywhere in `event_properties` — only metadata (lengths, types, counts)
- [ ] `/admin` dashboard renders all 6 sections correctly with real data after some test usage
- [ ] Health score distribution endpoint returns genuinely aggregate/anonymized data — confirm no project_id or user_id leaks into that specific response
