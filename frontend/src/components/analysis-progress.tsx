"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { api, type AnalysisStatus } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface AnalysisProgressProps {
  analysisId: string;
  projectId: string;
}

const STAGES = [
  { label: "Reading your codebase…", minPct: 10 },
  { label: "Mapping the architecture…", minPct: 25 },
  { label: "Analysing dependencies…", minPct: 40 },
  { label: "Checking for security risks…", minPct: 55 },
  { label: "Writing your reports…", minPct: 70 },
  { label: "Finalising results…", minPct: 90 },
];

function getStageLabel(pct: number): string {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (pct >= STAGES[i].minPct) return STAGES[i].label;
  }
  return "Preparing…";
}

export function AnalysisProgress({ analysisId, projectId }: AnalysisProgressProps) {
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [progress, setProgress] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const runningTickRef = useRef(0);
  const queuedTickRef = useRef(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const result = await api.getAnalysis(session.access_token, analysisId);
        setAnalysis(result);

        if (result.status === "queued") {
          // Still waiting for worker — keep progress very low
          queuedTickRef.current += 1;
          setIsQueued(true);
          setProgress(Math.min(2 + queuedTickRef.current, 8)); // max 8% while queued
        } else if (result.status === "running") {
          // Actually processing — now advance progress meaningfully
          setIsQueued(false);
          runningTickRef.current += 1;
          const naturalPct = Math.min(10 + runningTickRef.current * 4, 92);
          setProgress(naturalPct);
        } else if (result.status === "complete") {
          setIsQueued(false);
          setProgress(100);
          clearInterval(intervalRef.current!);
          setTimeout(() => router.push(`/projects/${projectId}`), 1200);
        } else if (result.status === "failed") {
          clearInterval(intervalRef.current!);
          setError(result.error_message || "Analysis failed. Please try again.");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll(); // Run immediately
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current!);
  }, [analysisId, projectId]);

  if (error) {
    return (
      <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-10 text-center max-w-lg mx-auto">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-obsidian mb-2">Analysis Failed</h2>
        <p className="text-sm text-ash mb-6">{error}</p>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="inline-flex items-center gap-2 bg-zinc-900 text-paper-raised px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          Back to Project
        </button>
      </div>
    );
  }

  if (analysis?.status === "complete") {
    return (
      <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-10 text-center max-w-lg mx-auto">
        <CheckCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-obsidian mb-2">Analysis Complete!</h2>
        <p className="text-sm text-ash">Taking you to your dashboard…</p>
      </div>
    );
  }

  const stageLabel = isQueued ? "Waiting in queue…" : getStageLabel(progress);
  const showQueueWarning = isQueued && queuedTickRef.current > 40; // ~2 min

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        {isQueued ? (
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        ) : (
          <Loader2 className="w-10 h-10 text-zinc-800 animate-spin mx-auto mb-4" />
        )}
        <h2 className="text-xl font-semibold text-obsidian mb-1">
          {isQueued ? "Queued for analysis" : "Analysing your codebase"}
        </h2>
        <p className="text-sm text-ash">
          {isQueued
            ? "Another analysis is in progress. Yours will start automatically."
            : "This takes 2–3 minutes. You can leave this page and come back."}
        </p>
        {showQueueWarning && (
          <p className="text-xs text-amber-500 mt-2">
            Taking longer than usual. The worker may be busy with a large repo.
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-ash mb-2">
          <span>{stageLabel}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-paper-sunken rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isQueued ? "bg-[#F59E0B]" : "bg-zinc-800"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage checklist — only show when running */}
      {!isQueued && (
        <div className="space-y-2 mt-6">
          {STAGES.map((stage) => {
            const done = progress > stage.minPct + 15;
            const active = progress >= stage.minPct && !done;
            return (
              <div
                key={stage.label}
                className={`flex items-center gap-2.5 text-sm transition-opacity ${
                  progress < stage.minPct ? "opacity-30" : "opacity-100"
                }`}
              >
                {done ? (
                  <CheckCircle className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 text-zinc-800 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-paper-sunken flex-shrink-0" />
                )}
                <span className={done ? "text-zinc-800 font-medium" : "text-ash"}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

