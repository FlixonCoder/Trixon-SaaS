"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
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

// How long before we show the "taking too long" warning (ms)
const STALE_WARNING_MS = 20 * 60 * 1000; // 20 minutes

export function AnalysisProgress({ analysisId, projectId }: AnalysisProgressProps) {
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [progress, setProgress] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const runningTickRef = useRef(0);
  const queuedTickRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const [retrying, setRetrying] = useState(false);

  const handleStartFresh = async () => {
    setRetrying(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const currentReports = analysis?.selected_reports || ["executive_summary", "architecture", "tech_debt"];
      await api.triggerAnalysisWithSelectedReports(session.access_token, projectId, currentReports);
      window.location.reload();
    } catch (e) {
      console.error("Failed to trigger fresh analysis:", e);
      setError("Failed to trigger a new analysis run. Please try again.");
      setIsStale(false);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const result = await api.getAnalysis(session.access_token, analysisId);
        setAnalysis(result);

        if (result.status === "queued") {
          queuedTickRef.current += 1;
          setIsQueued(true);
          setProgress(Math.min(2 + queuedTickRef.current, 8));

        } else if (result.status === "running") {
          setIsQueued(false);

          // Track when it actually started running
          if (startedAtRef.current === null) {
            // Use the server's started_at if available, otherwise use now
            startedAtRef.current = result.started_at
              ? new Date(result.started_at).getTime()
              : Date.now();
          }

          // Check for stale (>20 min running)
          const elapsedMs = Date.now() - (startedAtRef.current ?? Date.now());
          if (elapsedMs > STALE_WARNING_MS) {
            setIsStale(true);
            clearInterval(intervalRef.current!);
            return;
          }

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

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current!);
  }, [analysisId, projectId]);

  // ── Stale warning state ──────────────────────────────────────────
  if (isStale) {
    return (
      <div className="bg-white border border-amber-200 shadow-lg rounded-2xl p-10 text-center max-w-lg mx-auto animate-in fade-in duration-300">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-amber-100">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-obsidian mb-2">This is taking longer than expected</h2>
        <p className="text-sm text-ash mb-2 leading-relaxed max-w-sm mx-auto">
          Your analysis has been running for over 20 minutes. The server may have been interrupted (Render free tier sleeps between requests).
        </p>
        <p className="text-xs text-ash/70 mb-6">
          Your next trigger will automatically clean up this stuck run and start fresh.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleStartFresh}
            disabled={retrying}
            className="px-5 py-2.5 bg-signal text-white rounded-lg text-sm font-medium hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Start Fresh Analysis
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-[#1e1b1b] text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Failed state ─────────────────────────────────────────────────
  if (error) {
    const isTimeout = error.includes("timed out") || error.includes("interrupted");
    return (
      <div className="bg-white border border-red-100 shadow-lg rounded-2xl p-10 text-center max-w-lg mx-auto animate-in fade-in duration-300">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
          <XCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-obsidian mb-2">
          {isTimeout ? "Analysis Interrupted" : "Analysis Failed"}
        </h2>
        <p className="text-sm text-ash mb-4 leading-relaxed max-w-sm mx-auto">
          {isTimeout
            ? "The server was interrupted mid-analysis (Render free tier spins down between requests). Your next analysis will start fresh automatically."
            : error}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleStartFresh}
            disabled={retrying}
            className="px-5 py-2.5 bg-signal text-white rounded-lg text-sm font-medium hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Start Fresh Analysis
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-[#1e1b1b] text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Complete state ───────────────────────────────────────────────
  if (analysis?.status === "complete") {
    return (
      <div className="bg-white border border-paper-sunken shadow-lg rounded-2xl p-10 text-center max-w-lg mx-auto">
        <CheckCircle className="w-12 h-12 text-[#039a85] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-obsidian mb-2">Analysis Complete!</h2>
        <p className="text-sm text-ash">Taking you to your dashboard…</p>
      </div>
    );
  }

  // ── Running / Queued state ───────────────────────────────────────
  const stageLabel = isQueued ? "Waiting in queue…" : getStageLabel(progress);
  const showQueueWarning = isQueued && queuedTickRef.current > 40; // ~2 min

  return (
    <div className="bg-white border border-paper-sunken shadow-xl rounded-2xl p-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        {isQueued ? (
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        ) : (
          <Loader2 className="w-10 h-10 text-zinc-800 animate-spin mx-auto mb-4" />
        )}
        <h2 className="text-xl font-bold text-obsidian mb-1">
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
              isQueued ? "bg-[#F59E0B]" : "bg-[#1e1b1b]"
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
                  <CheckCircle className="w-4 h-4 text-[#039a85] flex-shrink-0" />
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
