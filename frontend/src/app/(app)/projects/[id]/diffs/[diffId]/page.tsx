"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle, Clock, Loader2, GitCommit
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type AnalysisDiff, type SlimFinding } from "@/lib/api";

const VERDICT_CONFIG = {
  improved: { label: "Improved", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  regressed: { label: "Regressed", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  mixed: { label: "Mixed", icon: Minus, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  no_change: { label: "No Change", icon: Minus, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-600",
};

function FindingPill({ finding }: { finding: SlimFinding }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#F6F4F4] last:border-0">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.medium}`}>
        {finding.severity.toUpperCase()}
      </span>
      <span className="text-sm text-obsidian leading-snug flex-1">{finding.title}</span>
      <span className="text-[10px] text-ash/70">{finding.category}</span>
    </div>
  );
}

function FindingsColumn({
  title, icon: Icon, color, findings, emptyMsg
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  findings: SlimFinding[];
  emptyMsg: string;
}) {
  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5 flex flex-col">
      <div className={`flex items-center gap-2 mb-4 pb-3 border-b border-paper-sunken`}>
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-sm font-semibold text-obsidian">{title}</h3>
        <span className="ml-auto text-xs font-semibold bg-paper-sunken px-2 py-0.5 rounded-full text-ash">
          {findings.length}
        </span>
      </div>
      {findings.length === 0 ? (
        <p className="text-xs text-ash/70 italic">{emptyMsg}</p>
      ) : (
        <div className="space-y-0">
          {findings.map(f => <FindingPill key={f.id} finding={f} />)}
        </div>
      )}
    </div>
  );
}

export default function DiffDetailPage() {
  const { id: projectId, diffId } = useParams<{ id: string; diffId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [diff, setDiff] = useState<AnalysisDiff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const data = await api.getDiffDetail(session.access_token, projectId, diffId);
        setDiff(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, diffId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-obsidian" />
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <div className="text-center">
          <p className="text-obsidian font-semibold mb-2">Diff not found</p>
          <button onClick={() => router.back()} className="text-sm text-obsidian">Go back</button>
        </div>
      </div>
    );
  }

  const verdict = diff.verdict ? VERDICT_CONFIG[diff.verdict] : null;
  const VerdictIcon = verdict?.icon || Minus;
  const netHealth = diff.score_deltas?.health ?? 0;

  return (
    <div className="min-h-screen bg-paper-sunken">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(`/projects/${projectId}/timeline`)}
            className="flex items-center gap-1.5 text-sm text-ash hover:text-obsidian transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Timeline
          </button>
        </div>

        {/* Header card */}
        <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {verdict && (
                  <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border ${verdict.bg} ${verdict.border} ${verdict.color}`}>
                    <VerdictIcon className="w-4 h-4" />
                    {verdict.label}
                  </span>
                )}
                <span className={`text-lg font-bold ${netHealth > 0 ? "text-emerald-600" : netHealth < 0 ? "text-red-600" : "text-ash"}`}>
                  {netHealth > 0 ? "+" : ""}{netHealth} pts
                </span>
              </div>
              <p className="text-xs text-ash/70">
                {new Date(diff.created_at).toLocaleDateString("en-GB", {
                  weekday: "short", day: "numeric", month: "long", year: "numeric"
                })}
              </p>
            </div>

            {/* Score deltas */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(diff.score_deltas).map(([key, delta]) => {
                if (delta === 0) return null;
                return (
                  <div key={key} className={`text-center px-3 py-2 rounded-lg border ${delta > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                    <div className={`text-sm font-bold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </div>
                    <div className="text-[10px] text-ash capitalize">{key}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Summary */}
          {diff.summary_markdown && (
            <div className="mt-4 pt-4 border-t border-[#F6F4F4]">
              <p className="text-sm text-[#5a5458] leading-relaxed">{diff.summary_markdown}</p>
            </div>
          )}
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FindingsColumn
            title="Resolved"
            icon={CheckCircle2}
            color="text-emerald-600"
            findings={diff.resolved_findings}
            emptyMsg="Nothing resolved in this snapshot."
          />
          <FindingsColumn
            title="New Issues"
            icon={AlertTriangle}
            color="text-red-500"
            findings={diff.new_findings}
            emptyMsg="No new issues introduced."
          />
          <FindingsColumn
            title="Still Open"
            icon={Clock}
            color="text-amber-500"
            findings={diff.unchanged_findings}
            emptyMsg="No ongoing issues tracked."
          />
        </div>

        {/* View action items */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push(`/projects/${projectId}/action-items`)}
            className="text-sm font-medium text-obsidian hover:text-[#27272a] transition-colors"
          >
            View all action items →
          </button>
        </div>
      </div>
    </div>
  );
}
