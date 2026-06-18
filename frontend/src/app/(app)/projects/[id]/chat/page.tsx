"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type Project, type AnalysisStatus } from "@/lib/api";
import { ProjectChat } from "@/components/project-chat";
import { ProjectLayout } from "@/components/project-layout";

export default function ChatPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const proj = await api.getProject(session.access_token, projectId);
        setProject(proj);
        if (proj.latest_analysis) {
          setAnalysis(proj.latest_analysis);
        }
      } catch (e) {
        console.error("Failed to load project details for chat page:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading || !project || !analysis) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-sunken">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ProjectLayout project={project} analysis={analysis} activeTab="chat">
          <div className="mt-6 flex flex-col h-[650px] overflow-hidden">
            <ProjectChat
              projectId={projectId}
              selectedReports={analysis.selected_reports}
            />
          </div>
        </ProjectLayout>
      </main>
    </div>
  );
}
