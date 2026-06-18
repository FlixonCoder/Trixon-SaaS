import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Activity, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api, type AnalysisStatus } from "@/lib/api";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <CheckCircle className="w-5 h-5 text-obsidian" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Activity className="w-5 h-5 text-amber-500 animate-pulse" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-amber-500/10 text-amber-500" },
    running: { label: "Analysing", cls: "bg-obsidian/10 text-obsidian" },
    complete: { label: "Complete", cls: "bg-obsidian/10 text-obsidian" },
    failed: { label: "Failed", cls: "bg-red-500/10 text-red-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-paper-sunken text-ash" };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default async function ProjectHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  let project;
  let analyses: AnalysisStatus[] = [];
  try {
    project = await api.getProject(session.access_token, id);
    analyses = await api.listProjectAnalyses(session.access_token, id);
  } catch (err) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-paper-sunken">
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-sm text-ash hover:text-obsidian transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-obsidian">Analysis History</h1>
          <p className="text-sm text-ash mt-1">
            Past runs for {project.repo_name}
          </p>
        </div>

        <div className="bg-paper-raised border border-paper-sunken rounded-2xl overflow-hidden shadow-sm">
          {analyses.length === 0 ? (
            <div className="p-12 text-center text-ash">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No analyses found for this project.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F6F4F4]">
              {analyses.map((analysis) => (
                <div key={analysis.id} className="p-6 hover:bg-paper-sunken/50 transition-colors flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5">
                      <StatusIcon status={analysis.status} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-sm text-obsidian">
                          {new Date(analysis.created_at).toLocaleString()}
                        </span>
                        <StatusBadge status={analysis.status} />
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-ash">
                        {analysis.health_score !== null && (
                          <span>Health: <strong className={
                            analysis.health_score >= 80 ? "text-obsidian" : 
                            analysis.health_score >= 60 ? "text-amber-500" : "text-red-500"
                          }>{analysis.health_score}</strong></span>
                        )}
                        {analysis.stats && (
                          <span>Files: {analysis.stats.total_files}</span>
                        )}
                        <span className="font-mono text-[10px] bg-paper-sunken px-1.5 py-0.5 rounded border border-paper-sunken">
                          {analysis.id.slice(0, 8)}
                        </span>
                      </div>
                      
                      {analysis.error_message && (
                        <p className="mt-2 text-xs text-red-500 max-w-xl">
                          {analysis.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {analysis.status === "complete" && (
                    <Link 
                      href={`/projects/${id}/reports?analysis=${analysis.id}`}
                      className="px-4 py-2 border border-paper-sunken rounded-lg text-sm font-medium text-obsidian hover:bg-paper-sunken transition-colors"
                    >
                      View Reports
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
