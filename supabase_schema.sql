-- ==============================================================
-- Trixon Supabase Schema (Phase 3/4)
-- Run this in your Supabase SQL Editor
-- ==============================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vcs_connection_id UUID NOT NULL REFERENCES public.vcs_connections(id) ON DELETE CASCADE,
    repo_id TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    platform TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a user can only connect a specific repo once per platform
ALTER TABLE public.projects 
ADD CONSTRAINT unique_user_repo UNIQUE (user_id, platform, repo_id);

-- 2. Analyses Table
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, running, complete, failed
    health_score INTEGER,
    security_score INTEGER,
    scalability_score INTEGER,
    quality_score INTEGER,
    docs_score INTEGER,
    language_breakdown JSONB,
    dependencies JSONB,
    third_party_services JSONB,
    stats JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL, -- executive_summary, architecture, etc.
    content_markdown TEXT,
    content_json JSONB,
    share_token TEXT,
    share_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one report type per analysis run
ALTER TABLE public.reports
ADD CONSTRAINT unique_analysis_report UNIQUE (analysis_id, report_type);

-- ==============================================================
-- Row Level Security (RLS) Policies
-- ==============================================================

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see and modify their own projects
CREATE POLICY "Users can manage own projects"
    ON public.projects
    FOR ALL
    USING (auth.uid() = user_id);

-- Analyses: Users can only see analyses for their own projects
CREATE POLICY "Users can manage analyses of their projects"
    ON public.analyses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = analyses.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Reports: Users can only see reports for their analyses
CREATE POLICY "Users can manage reports of their analyses"
    ON public.reports
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = reports.analysis_id
            AND projects.user_id = auth.uid()
        )
    );

-- Reload the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
