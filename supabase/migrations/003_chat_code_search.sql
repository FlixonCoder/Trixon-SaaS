CREATE TABLE IF NOT EXISTS public.code_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  key_files jsonb NOT NULL,  -- { "path/to/file": "content...", ... }
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.code_snapshots ENABLE ROW LEVEL SECURITY;
-- RLS policy: users can only read snapshots for analyses belonging to their own projects
CREATE POLICY "Users can view their own code snapshots" ON public.code_snapshots
  FOR SELECT USING (
    analysis_id IN (
      SELECT a.id FROM analyses a
      JOIN projects p ON p.id = a.project_id
      WHERE p.user_id = auth.uid()
    )
  );
