-- ==============================================================
-- Trixon — Initial Database Schema
-- ==============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- This creates all tables, enables RLS, and sets up policies.
-- ==============================================================

-- -----------------------------------------------
-- 1. PROFILES (extends Supabase auth.users)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    company_name TEXT,
    role TEXT CHECK (role IN ('founder', 'investor', 'agency')),
    primary_goal TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view and update only their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- -----------------------------------------------
-- 2. VCS CONNECTIONS (GitHub/GitLab OAuth tokens)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.vcs_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('github', 'gitlab')),
    platform_user_id TEXT,
    platform_username TEXT,
    access_token TEXT NOT NULL,  -- encrypted at application level (AES-256)
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.vcs_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own VCS connections"
    ON public.vcs_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own VCS connections"
    ON public.vcs_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own VCS connections"
    ON public.vcs_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own VCS connections"
    ON public.vcs_connections FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------
-- 3. PROJECTS (connected repositories)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    vcs_connection_id UUID REFERENCES public.vcs_connections(id) ON DELETE SET NULL,
    repo_id TEXT,
    repo_name TEXT NOT NULL,
    repo_url TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('github', 'gitlab')),
    default_branch TEXT DEFAULT 'main',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------
-- 4. ANALYSES (analysis runs per project)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
    security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
    scalability_score INTEGER CHECK (scalability_score >= 0 AND scalability_score <= 100),
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    docs_score INTEGER CHECK (docs_score >= 0 AND docs_score <= 100),
    language_breakdown JSONB DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    third_party_services JSONB DEFAULT '[]'::jsonb,
    stats JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Users can access analyses for their own projects
CREATE POLICY "Users can view own analyses"
    ON public.analyses FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert analyses for own projects"
    ON public.analyses FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own analyses"
    ON public.analyses FOR UPDATE
    USING (
        project_id IN (
            SELECT id FROM public.projects WHERE user_id = auth.uid()
        )
    );

-- -----------------------------------------------
-- 5. REPORTS (AI-generated outputs per analysis)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL CHECK (
        report_type IN (
            'executive_summary',
            'architecture',
            'tech_debt',
            'security',
            'scalability',
            'onboarding',
            'investor'
        )
    ),
    content_markdown TEXT,
    content_json JSONB,
    share_token TEXT UNIQUE,
    share_password_hash TEXT,
    share_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports for their own analyses
CREATE POLICY "Users can view own reports"
    ON public.reports FOR SELECT
    USING (
        analysis_id IN (
            SELECT a.id FROM public.analyses a
            JOIN public.projects p ON a.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reports for own analyses"
    ON public.reports FOR INSERT
    WITH CHECK (
        analysis_id IN (
            SELECT a.id FROM public.analyses a
            JOIN public.projects p ON a.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own reports"
    ON public.reports FOR UPDATE
    USING (
        analysis_id IN (
            SELECT a.id FROM public.analyses a
            JOIN public.projects p ON a.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- Public share access — anyone with a valid share token can read
CREATE POLICY "Public share access"
    ON public.reports FOR SELECT
    USING (share_enabled = true AND share_token IS NOT NULL);

-- -----------------------------------------------
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- -----------------------------------------------
-- This trigger automatically creates a profile row
-- whenever a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------
-- 7. STORAGE BUCKET FOR REPORTS
-- -----------------------------------------------
-- Creates a storage bucket for report markdown/JSON files.
-- Note: This uses Supabase storage API — run via Dashboard
-- if this SQL doesn't work in the SQL Editor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can access files in their own folder
CREATE POLICY "Users can access own report files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can upload own report files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'reports'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- -----------------------------------------------
-- 8. INDEXES FOR PERFORMANCE
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vcs_connections_user_id ON public.vcs_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON public.analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON public.analyses(status);
CREATE INDEX IF NOT EXISTS idx_reports_analysis_id ON public.reports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_reports_share_token ON public.reports(share_token) WHERE share_token IS NOT NULL;
