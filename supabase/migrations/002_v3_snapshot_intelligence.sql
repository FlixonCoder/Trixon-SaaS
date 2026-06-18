-- ==============================================================
-- Trixon — v3.0 + v3.1 Migration
-- Run this in your Supabase SQL Editor AFTER the initial schema.
-- ==============================================================

-- -----------------------------------------------
-- 1. Extend analyses table (v3.0 + v3.1)
-- -----------------------------------------------

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS commit_sha        TEXT,
  ADD COLUMN IF NOT EXISTS commit_message    TEXT,
  ADD COLUMN IF NOT EXISTS commit_author     TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_number   INTEGER,   -- 1, 2, 3... per project
  ADD COLUMN IF NOT EXISTS previous_analysis_id UUID REFERENCES public.analyses(id),
  ADD COLUMN IF NOT EXISTS trigger_source    TEXT DEFAULT 'manual',  -- 'manual' | 'webhook' | 'scheduled'
  ADD COLUMN IF NOT EXISTS selected_reports  TEXT[];                 -- v3.1: e.g. ['executive_summary','tech_debt']

-- -----------------------------------------------
-- 2. analysis_diffs table (v3.0)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.analysis_diffs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    from_analysis_id    UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    to_analysis_id      UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
    score_deltas        JSONB,
    -- { "health": +5, "security": -10, "scalability": 0, "quality": +2, "docs": 0 }
    resolved_findings   JSONB,    -- findings present in from but not in to
    new_findings        JSONB,    -- findings present in to but not in from
    unchanged_findings  JSONB,    -- still present in both
    verdict             TEXT,     -- 'improved' | 'regressed' | 'mixed' | 'no_change'
    summary_markdown    TEXT,     -- AI-generated 2-3 sentence changelog summary
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- 3. action_items table (v3.0)
-- Every finding becomes a trackable, actionable item
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.action_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id                  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    analysis_id                 UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    category                    TEXT NOT NULL,   -- 'security' | 'tech_debt' | 'scalability' | 'quality' | 'docs'
    severity                    TEXT NOT NULL,   -- 'critical' | 'high' | 'medium' | 'low'
    title                       TEXT NOT NULL,
    description                 TEXT,
    effort_level                TEXT,            -- 'quick-win' | 'moderate' | 'complex' | 'architectural'
    status                      TEXT NOT NULL DEFAULT 'open',
    -- 'open' | 'resolved' | 'ignored' | 'in_progress'
    ai_prompt                   TEXT,            -- ready-to-paste prompt for Cursor/Claude/Codex
    file_paths                  JSONB,           -- array of relevant file paths
    resolved_in_analysis_id     UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    first_detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- 4. project_chats table (v3.0 — Conversational Memory)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_chats (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role                    TEXT NOT NULL,   -- 'user' | 'assistant'
    content                 TEXT NOT NULL,
    referenced_analysis_id  UUID REFERENCES public.analyses(id) ON DELETE SET NULL,
    referenced_action_items JSONB,           -- array of action_item ids mentioned
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- 5. webhook_connections table (v3.0)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.webhook_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,           -- 'github' | 'gitlab'
    webhook_id      TEXT,                    -- ID returned by GitHub/GitLab
    webhook_secret  TEXT NOT NULL,           -- HMAC-SHA256 signing secret (stored encrypted in prod)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one active webhook per project
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_webhook_per_project
    ON public.webhook_connections (project_id)
    WHERE is_active = TRUE;

-- -----------------------------------------------
-- 6. report_catalog table (v3.1 — seed data)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_catalog (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL,
    best_for         TEXT NOT NULL,
    estimated_tokens INTEGER NOT NULL DEFAULT 1500,
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    display_order    INTEGER NOT NULL DEFAULT 99
);

-- Seed the catalog (idempotent)
INSERT INTO public.report_catalog (id, title, description, best_for, estimated_tokens, is_default, display_order)
VALUES
    ('executive_summary', 'What You Built',           'A plain-English overview of your whole system',                          'Everyone',                              1200, TRUE,  1),
    ('architecture',      'How It All Connects',       'How your frontend, backend, and database talk to each other',            'Hiring devs, understanding your system', 1500, TRUE,  2),
    ('tech_debt',         'What''s Messy & Risky',     'Issues ranked by severity, with fixes you can paste into your AI tool',  'Everyone',                              1800, TRUE,  3),
    ('security',          'Security Risk Scan',         'Hardcoded secrets, exposed endpoints, missing auth',                     'Pre-launch, enterprise questions',       1500, FALSE, 4),
    ('scalability',       'Can It Handle Growth?',      'What breaks first if you 10x your users',                               'Pre-launch, scaling up',                1500, FALSE, 5),
    ('onboarding',        'Dev Onboarding Guide',       'What a new hire needs to know on day 1',                                'Hiring devs',                            1500, FALSE, 6),
    ('investor',          'Investor Technical Summary', 'A 1-pager framing your codebase for due diligence',                     'Raising a round',                        1200, FALSE, 7)
ON CONFLICT (id) DO UPDATE SET
    title            = EXCLUDED.title,
    description      = EXCLUDED.description,
    best_for         = EXCLUDED.best_for,
    estimated_tokens = EXCLUDED.estimated_tokens,
    is_default       = EXCLUDED.is_default,
    display_order    = EXCLUDED.display_order;

-- -----------------------------------------------
-- 7. Row Level Security (RLS)
-- -----------------------------------------------

ALTER TABLE public.analysis_diffs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_connections ENABLE ROW LEVEL SECURITY;
-- report_catalog is public read-only — no RLS needed

-- analysis_diffs: accessible via project ownership
CREATE POLICY "Users can view diffs for their projects"
    ON public.analysis_diffs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = analysis_diffs.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage diffs"
    ON public.analysis_diffs FOR ALL
    USING (auth.role() = 'service_role');

-- action_items
CREATE POLICY "Users can view action items for their projects"
    ON public.action_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = action_items.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update action item status"
    ON public.action_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = action_items.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage action items"
    ON public.action_items FOR ALL
    USING (auth.role() = 'service_role');

-- project_chats
CREATE POLICY "Users can manage their own chats"
    ON public.project_chats FOR ALL
    USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_chats.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage chats"
    ON public.project_chats FOR ALL
    USING (auth.role() = 'service_role');

-- webhook_connections
CREATE POLICY "Users can manage webhooks for their projects"
    ON public.webhook_connections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = webhook_connections.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- -----------------------------------------------
-- 8. Indexes for performance
-- -----------------------------------------------

CREATE INDEX IF NOT EXISTS idx_action_items_project_status
    ON public.action_items (project_id, status);

CREATE INDEX IF NOT EXISTS idx_action_items_analysis
    ON public.action_items (analysis_id);

CREATE INDEX IF NOT EXISTS idx_project_chats_project
    ON public.project_chats (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_snapshot_number
    ON public.analyses (project_id, snapshot_number);

CREATE INDEX IF NOT EXISTS idx_analysis_diffs_project
    ON public.analysis_diffs (project_id, created_at DESC);

-- -----------------------------------------------
-- 9. Reload PostgREST schema cache
-- -----------------------------------------------
NOTIFY pgrst, 'reload schema';
