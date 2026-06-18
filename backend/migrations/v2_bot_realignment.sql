-- =============================================================
-- Trixon v2.0 — Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

-- 0. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    company_name TEXT,
    role TEXT,
    primary_goal TEXT,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
    ) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 1. New table: audit_purchases (Stripe one-time payments)
CREATE TABLE IF NOT EXISTS public.audit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  stripe_session_id text,
  amount_cents integer DEFAULT 49700,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'refunded')),
  purchased_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 2. New table: trixon_share_sessions
CREATE TABLE IF NOT EXISTS public.trixon_share_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  founder_message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'contacted')),
  created_at timestamptz DEFAULT now()
);

-- 3. Add purchase_id to analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.audit_purchases(id);

-- 4. Add key_findings to analyses (populated during executive_summary generation)
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS key_findings jsonb;

-- 5. Add effort_estimates to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS effort_estimates jsonb;

-- 5. Enable RLS on new tables
ALTER TABLE audit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE trixon_share_sessions ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for audit_purchases
CREATE POLICY "Users can view their own purchases"
  ON audit_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all purchases"
  ON audit_purchases FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. RLS policies for trixon_share_sessions
CREATE POLICY "Users can view their own share sessions"
  ON trixon_share_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create share sessions"
  ON trixon_share_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all share sessions"
  ON trixon_share_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_purchases_user_project
  ON audit_purchases(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_audit_purchases_status
  ON audit_purchases(status);

CREATE INDEX IF NOT EXISTS idx_trixon_share_sessions_user
  ON trixon_share_sessions(user_id);
