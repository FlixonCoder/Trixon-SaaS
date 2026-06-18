import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderGit2,
  Plus,
  GitBranch,
  Shield,
  Zap,
  Clock,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api, type Project } from "@/lib/api";

function getStatusBadge(status: string | undefined) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-amber-500/10 text-amber-500" },
    running: { label: "Analysing…", cls: "bg-obsidian/10 text-obsidian" },
    complete: { label: "Ready", cls: "bg-obsidian/10 text-obsidian" },
    failed: { label: "Failed", cls: "bg-red-500/10 text-red-500" },
  };
  const s = map[status] ?? { label: status, cls: "bg-paper-sunken text-ash" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 80 ? "text-obsidian" : score >= 60 ? "text-amber-500" : "text-red-500";
  return (
    <span className={`text-sm font-bold font-mono ${color}`}>{score}</span>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  let plan = "free";
  try {
    const profile = await api.getProfile(session.access_token);
    plan = profile.plan;
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
  
  const isFreeTier = process.env.NEXT_PUBLIC_BETA_MODE === "true" ? false : (plan === "free" || !plan);

  let projects: Project[] = [];
  try {
    projects = await api.listProjects(session.access_token);
  } catch (err) {
    // Backend may be offline; show empty state gracefully
    console.error("Failed to load projects:", err);
  }

  const hasProjects = projects.length > 0;
  const canAddMore = !isFreeTier || projects.length < 2;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-obsidian font-display">Dashboard</h1>
          <p className="text-ash mt-1 text-sm">
            {hasProjects
              ? `${projects.length} connected ${projects.length === 1 ? "repository" : "repositories"}`
              : "Connect your first repository to get started"}
          </p>
        </div>
        {hasProjects && (
          canAddMore ? (
            <Link
              href="/onboarding?step=2"
              className="inline-flex items-center gap-2 bg-obsidian text-paper-raised px-4 py-2 rounded-lg text-sm font-medium hover:bg-obsidian-raised transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Repository
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-obsidian text-paper-raised px-4 py-2 rounded-lg text-sm font-medium hover:bg-obsidian-raised transition-colors"
            >
              <Zap className="w-4 h-4" />
              Upgrade to add more
            </Link>
          )
        )}
      </div>

      {!hasProjects ? (
        /* Empty State */
        <div className="bg-paper-raised border border-paper-sunken border-dashed rounded-2xl p-12 text-center max-w-2xl mx-auto mt-12 card-elevated">
          <div className="w-16 h-16 bg-paper-sunken rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderGit2 className="w-8 h-8 text-obsidian" />
          </div>
          <h2 className="text-xl font-semibold text-obsidian mb-2 font-display">
            Start tracking your codebase
          </h2>
          <p className="text-ash mb-8 max-w-sm mx-auto text-sm">
            Connect your repo once. Every commit gets analyzed, scored, and turned into a clear next step.
          </p>
          <Link
            href="/onboarding?step=2"
            className="inline-flex items-center gap-2 bg-obsidian text-paper-raised px-6 py-3 rounded-lg font-medium hover:bg-obsidian-raised transition-all hover:shadow-lg hover:shadow-obsidian/20"
          >
            <Plus className="w-5 h-5" />
            Connect Repository
          </Link>
        </div>
      ) : (
        /* Project Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const analysis = project.latest_analysis;
            const isRunning =
              analysis?.status === "running" || analysis?.status === "queued";
            const isComplete = analysis?.status === "complete";

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:border-obsidian/30 transition-all group block card-elevated"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-paper-sunken flex items-center justify-center group-hover:bg-obsidian/10 transition-colors">
                      <FolderGit2 className="w-4.5 h-4.5 text-ash group-hover:text-obsidian" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-obsidian text-sm leading-tight">
                        {project.repo_name.split("/").pop()}
                      </h3>
                      <p className="text-xs text-ash font-mono">{project.repo_name}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-paper-sunken group-hover:text-obsidian transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Status */}
                <div className="flex items-center justify-between mb-4">
                  {getStatusBadge(analysis?.status)}
                  {isComplete && analysis && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-ash">Score:</span>
                      <ScorePill score={analysis.health_score} />
                      <span className="text-xs text-ash">/100</span>
                    </div>
                  )}
                </div>

                {/* Progress bar if running */}
                {isRunning && (
                  <div className="h-1.5 bg-paper-sunken rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-obsidian rounded-full animate-pulse w-3/5" />
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 pt-3 border-t border-paper-sunken">
                  <div className="flex items-center gap-1 text-xs text-ash">
                    <GitBranch className="w-3 h-3" />
                    <span className="font-mono">{project.default_branch}</span>
                  </div>
                  {isComplete && analysis?.stats && (
                    <>
                      <div className="flex items-center gap-1 text-xs text-ash">
                        <Shield className="w-3 h-3" />
                        <span className="font-mono">{analysis.security_score ?? "–"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-ash">
                        <Zap className="w-3 h-3" />
                        <span className="font-mono">{analysis.scalability_score ?? "–"}</span>
                      </div>
                    </>
                  )}
                  {project.last_synced_at && (
                    <div className="flex items-center gap-1 text-xs text-ash ml-auto">
                      <Clock className="w-3 h-3" />
                      <span suppressHydrationWarning>
                        {new Date(project.last_synced_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Add new repo card */}
          {canAddMore ? (
            <Link
              href="/onboarding?step=2"
              className="bg-paper-raised border border-paper-sunken border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-obsidian/50 hover:bg-obsidian/5 transition-all group min-h-[160px] card-elevated"
            >
              <div className="w-9 h-9 rounded-lg bg-paper-sunken flex items-center justify-center group-hover:bg-obsidian/10 transition-colors">
                <Plus className="w-4.5 h-4.5 text-ash group-hover:text-obsidian" />
              </div>
              <span className="text-sm text-ash group-hover:text-obsidian transition-colors font-medium">
                Add Repository
              </span>
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="bg-paper border border-paper-sunken rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-obsidian/50 hover:bg-paper-sunken transition-all group min-h-[160px] card-elevated"
            >
              <div className="w-9 h-9 rounded-lg bg-paper-raised flex items-center justify-center group-hover:bg-obsidian transition-colors shadow-sm">
                <Zap className="w-4.5 h-4.5 text-obsidian group-hover:text-paper-raised" />
              </div>
              <span className="text-sm text-obsidian font-medium text-center leading-tight">
                Repo limit reached<br/>
                <span className="text-xs text-ash font-normal group-hover:underline">Upgrade to Pro</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
