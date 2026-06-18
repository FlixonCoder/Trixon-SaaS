import { redirect } from "next/navigation";
import Link from "next/link";
import { RefreshCw, AlertTriangle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { AnalysisProgress } from "@/components/analysis-progress";
import { ProjectDashboard } from "@/components/project-dashboard";
import { ReportSelector } from "@/components/report-selector";
import { PostAnalysisInterstitial } from "@/components/post-analysis-interstitial";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ analyzing?: string; view?: string }>;
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  let project;
  try {
    project = await api.getProject(session.access_token, id);
  } catch {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      project = await api.getProject(session.access_token, id);
    } catch {
      return (
        <div className="min-h-screen bg-paper-sunken flex items-center justify-center px-4">
          <div className="text-center p-8 bg-paper-raised rounded-xl shadow-sm border border-paper-sunken max-w-md w-full">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-obsidian mb-2">Project Loading…</h2>
            <p className="text-ash text-sm mb-6 leading-relaxed">
              Your project was created but we&apos;re having trouble fetching it. This usually resolves in a few seconds.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`/projects/${id}${sp.analyzing === "true" ? "?analyzing=true" : ""}`}
                className="px-4 py-2.5 bg-obsidian text-paper-raised rounded-lg text-sm font-medium hover:bg-[#27272a] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </a>
              <a
                href="/dashboard"
                className="px-4 py-2.5 border border-paper-sunken text-obsidian rounded-lg text-sm font-medium hover:bg-[#f6f4f4] transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
  }

  let accessLevel = "basic";
  try {
    const { access } = await api.getAccessLevel(session.access_token, id);
    accessLevel = access;
  } catch (e) {
    console.error("Failed to check access level:", e);
  }

  const analysis = project.latest_analysis;
  const isRunning = analysis?.status === "queued" || analysis?.status === "running";
  const isComplete = analysis?.status === "complete";
  const isFailed = analysis?.status === "failed";
  const showProgress = isRunning || sp.analyzing === "true";
  const showInterstitial = isComplete && sp.view === "results";

  return (
    <div className="w-full flex-1 flex flex-col">
      {showProgress && analysis ? (
        <div className="flex-1 flex items-center justify-center h-full">
          <AnalysisProgress
            analysisId={analysis.id}
            projectId={project.id}
          />
        </div>
      ) : showInterstitial && analysis ? (
        <div className="flex-1">
          <PostAnalysisInterstitial
            healthScore={analysis.health_score ?? 50}
            projectId={project.id}
            analysisId={analysis.id}
            keyFindings={analysis.key_findings ?? []}
          />
        </div>
      ) : isComplete && analysis ? (
        <ProjectDashboard project={project} analysis={analysis} hasFullAccess={accessLevel === "full"} />
      ) : isFailed ? (
        /* Failed analysis state */
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center mx-auto w-full max-w-2xl">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-obsidian mb-2 font-display">Analysis Failed</h2>
            <p className="text-ash text-sm mb-2 leading-relaxed">
              Something went wrong while analysing your repository. This can happen when the AI provider is temporarily unavailable.
            </p>
            {analysis.error_message && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 text-left max-w-lg mx-auto">
                <p className="text-xs text-red-600 font-mono leading-relaxed">{analysis.error_message}</p>
              </div>
            )}
            
            <ReportSelector projectId={id} buttonText="Retry Analysis" />

            <div className="mt-6 flex justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 border border-paper-sunken text-obsidian px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-paper-sunken transition-colors font-display"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* No analysis yet */
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center mx-auto w-full max-w-2xl">
            <div className="w-16 h-16 bg-paper-sunken rounded-2xl flex items-center justify-center mx-auto mb-5 border border-paper-sunken">
              <RefreshCw className="w-8 h-8 text-ash" />
            </div>
            <h2 className="text-xl font-bold text-obsidian mb-2 font-display">No analysis yet</h2>
            <p className="text-ash text-sm leading-relaxed max-w-md mx-auto mb-2">
              Trigger your first analysis to get plain-English insights about your codebase.
            </p>
            
            <ReportSelector projectId={id} />
          </div>
        </div>
      )}
    </div>
  );
}

