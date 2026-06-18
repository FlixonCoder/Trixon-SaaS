CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  project_id uuid REFERENCES projects(id),  -- nullable; not all events are project-scoped
  event_type text NOT NULL,
  event_properties jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users view own events" ON public.usage_events
  FOR SELECT USING (user_id = auth.uid());

-- Add admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Admins can see all events
CREATE POLICY "Admins view all events" ON public.usage_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Helper to set your own account to admin (replace <your-user-id> manually)
-- UPDATE profiles SET is_admin = true WHERE id = '<your-user-id>';
