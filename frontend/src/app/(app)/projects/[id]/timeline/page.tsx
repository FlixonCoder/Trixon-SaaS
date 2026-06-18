"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, Minus, GitCommit,
  Loader2, ChevronRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type TimelineEntry, type Project, type AnalysisStatus } from "@/lib/api";
import { TimelineChart } from "@/components/timeline-chart";
import { ProjectLayout } from "@/components/project-layout";

const VERDICT_CONFIG = {
  improved: {
    label: "Improved",
    icon: TrendingUp,
    color: "text-zinc-800",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
  },
  regressed: {
    label: "Regressed",
    icon: TrendingDown,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  mixed: {
    label: "Mixed",
    icon: Minus,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  no_change: {
    label: "No Change",
    icon: Minus,
    color: "text-zinc-500",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
  },
};

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null;
  const color = score >= 75 ? "var(--color-obsidian)" : score >= 50 ? "#71717a" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ash w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-paper-sunken rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-obsidian w-8 text-right">{score}</span>
    </div>
  );
}

function TimelineRow({
  entry,
  projectId,
  onNavigateDiff,
}: {
  entry: TimelineEntry;
  projectId: string;
  onNavigateDiff: (diffId: string) => void;
}) {
  const router = useRouter();
  const verdict = entry.verdict ? VERDICT_CONFIG[entry.verdict] : null;
  const VerdictIcon = verdict?.icon || Minus;

  return (
    <div
      className="bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:shadow-sm transition-shadow cursor-pointer group"
      onClick={() =>
        entry.diff_id ? onNavigateDiff(entry.diff_id) : router.push(`/projects/${projectId}`)
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-paper-sunken border border-paper-sunken flex items-center justify-center">
          <span className="text-sm font-bold text-obsidian">
            #{entry.snapshot_number ?? "?"}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {verdict && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${verdict.bg} ${verdict.border} ${verdict.color}`}>
                <VerdictIcon className="w-3 h-3" />
                {verdict.label}
              </span>
            )}

            {entry.health_score !== null && (
              <span className="text-sm font-bold text-obsidian">
                {entry.health_score}
                <span className="text-xs font-normal text-ash">/100</span>
              </span>
            )}

            {entry.score_deltas?.health !== undefined && entry.score_deltas.health !== 0 && (
              <span className={`text-xs font-semibold ${entry.score_deltas.health > 0 ? "text-zinc-900 font-bold" : "text-red-600"}`}>
                {entry.score_deltas.health > 0 ? "+" : ""}{entry.score_deltas.health}
              </span>
            )}

            <span className="text-xs text-ash/70 ml-auto flex-shrink-0">
              {new Date(entry.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </span>
          </div>

          {entry.commit_message && (
            <div className="flex items-start gap-1.5 mb-2">
              <GitCommit className="w-3.5 h-3.5 text-ash flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#5a5458] leading-snug line-clamp-1">
                {entry.commit_message}
              </span>
            </div>
          )}

          {entry.health_score !== null && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3">
              <ScoreBar score={entry.security_score} label="Security" />
              <ScoreBar score={entry.scalability_score} label="Scalability" />
              <ScoreBar score={entry.quality_score} label="Quality" />
              <ScoreBar score={entry.docs_score} label="Docs" />
            </div>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-ash/70 flex-shrink-0 mt-1 group-hover:text-zinc-800 transition-colors" />
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
        const res = await api.getProjectTimeline(session.access_token, projectId);
        setTimeline(res.timeline.reverse());
      } catch (e) {
        console.error("Failed to load timeline details:", e);
      } finally {
        setLoading(false);
        setProjectLoading(false);
      }
    })();
  }, [projectId]);

  const handleNavigateDiff = (diffId: string) => {
    router.push(`/projects/${projectId}/diffs/${diffId}`);
  };

  const orderedForChart = [...timeline].reverse();

  if (projectLoading || !project || !analysis) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-sunken">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ProjectLayout project={project} analysis={analysis} activeTab="timeline">
          <div className="mt-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-obsidian mb-1">Snapshot Timeline</h1>
              <p className="text-sm text-ash">
                Your codebase health over time — click any snapshot to see what changed
              </p>
            </div>

            {orderedForChart.length > 0 && (
              <div className="mb-5">
                <TimelineChart
                  points={orderedForChart}
                  onPointClick={handleNavigateDiff}
                />
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-16 text-center">
                <h3 className="text-lg font-semibold text-obsidian mb-2">No snapshots yet</h3>
                <p className="text-sm text-ash">
                  Run your first analysis to start tracking your codebase health over time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map(entry => (
                  <TimelineRow
                    key={entry.id}
                    entry={entry}
                    projectId={projectId}
                    onNavigateDiff={handleNavigateDiff}
                  />
                ))}
              </div>
            )}
          </div>
        </ProjectLayout>
      </main>
    </div>
  );
}
