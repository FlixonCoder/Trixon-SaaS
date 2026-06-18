"use client";

import { useState, useEffect } from "react";
import {
  X, Check, Loader2, Sparkles, BookOpen, BarChart3, Shield, Zap, FileText, Activity, Users, Lock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type CatalogItem } from "@/lib/api";

const REPORT_ICONS: Record<string, React.ComponentType<any>> = {
  executive_summary: FileText,
  architecture: BarChart3,
  tech_debt: Activity,
  security: Shield,
  scalability: Zap,
  onboarding: BookOpen,
  investor: FileText,
  team_readiness: Users,
};

const REPORT_COLORS: Record<string, string> = {
  executive_summary: "text-zinc-800 bg-zinc-100 border border-zinc-200/50",
  architecture: "text-purple-500 bg-purple-50",
  tech_debt: "text-amber-500 bg-amber-50",
  security: "text-red-500 bg-red-50",
  scalability: "text-blue-500 bg-blue-50",
  onboarding: "text-green-600 bg-green-50",
  investor: "text-indigo-500 bg-indigo-50",
  team_readiness: "text-pink-500 bg-pink-50",
};

interface ReportCatalogModalProps {
  projectId: string;
  selectedReports: string[];
  onClose: () => void;
  onReportsAdded: () => void;
}

export function ReportCatalogModal({
  projectId,
  selectedReports,
  onClose,
  onReportsAdded,
}: ReportCatalogModalProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [polling, setPolling] = useState(false);
  const [pollAnalysisId, setPollAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const res = await api.getReportCatalog(session.access_token);
        // Filter out reports that are already selected
        const remaining = res.catalog.filter(item => !selectedReports.includes(item.id));
        setCatalog(remaining);

        // Pre-check recommended/default items
        const defaults = new Set<string>();
        remaining.forEach(item => {
          if (item.is_recommended || item.is_default) {
            defaults.add(item.id);
          }
        });
        setCheckedIds(defaults);
      } catch (e: any) {
        setError(e.message || "Failed to load report catalog");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedReports]);

  // Poll analysis status if reports are being added
  useEffect(() => {
    if (!polling || !pollAnalysisId) return;

    let intervalId: any;
    const checkStatus = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const analysis = await api.getAnalysis(session.access_token, pollAnalysisId);
        if (analysis.status === "complete") {
          setPolling(false);
          onReportsAdded();
          onClose();
        } else if (analysis.status === "failed") {
          setPolling(false);
          setError("Report generation failed. Please try again.");
          setSubmitting(false);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    // Poll every 3 seconds
    intervalId = setInterval(checkStatus, 3000);
    return () => clearInterval(intervalId);
  }, [polling, pollAnalysisId, onReportsAdded, onClose]);

  const handleToggle = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (checkedIds.size === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const types = Array.from(checkedIds);
      const res = await api.addReports(session.access_token, projectId, types);
      
      setPollAnalysisId(res.analysis_id);
      setPolling(true);
    } catch (e: any) {
      setError(e.message || "Failed to queue reports");
      setSubmitting(false);
    }
  };

  const totalChecked = checkedIds.size;
  const totalTokens = Array.from(checkedIds).reduce((acc, id) => {
    const item = catalog.find(c => c.id === id);
    return acc + (item?.estimated_tokens || 1500);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-paper-raised rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col relative animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-paper-sunken flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-obsidian">Add Reports</h2>
            <p className="text-xs text-ash mt-1">
              Select other analysis types to generate for this snapshot.
            </p>
          </div>
          {!polling && (
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 hover:bg-paper-sunken rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-ash" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-850 text-zinc-800" />
              <p className="text-xs text-ash">Loading catalog...</p>
            </div>
          ) : polling ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
              <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center mb-4 relative">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-800 absolute" />
                <Sparkles className="w-5 h-5 text-zinc-700 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-obsidian mb-2">Generating Reports</h3>
              <p className="text-xs text-ash leading-relaxed mb-4">
                We are building the requested context layers and running LLM evaluations. This usually takes 1-2 minutes.
              </p>
              <div className="w-full bg-paper-sunken h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-800 rounded-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-zinc-900 via-zinc-500 to-zinc-900" style={{ width: "100%", backgroundSize: "200% 100%" }} />
              </div>
            </div>
          ) : catalog.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-ash">All available reports have already been generated for this snapshot!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalog.map(item => {
                const Icon = REPORT_ICONS[item.id] || FileText;
                const colorClass = REPORT_COLORS[item.id] || "text-obsidian bg-paper-sunken";
                const isChecked = checkedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    className={`border rounded-xl p-4 flex gap-3 cursor-pointer transition-all ${
                      isChecked
                        ? "border-zinc-800 bg-zinc-50 shadow-sm"
                        : "border-paper-sunken bg-paper-raised hover:border-[#837e80]"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <h4 className="text-sm font-semibold text-obsidian leading-tight truncate">
                          {item.title}
                        </h4>
                        {item.is_recommended && (
                          <span className="text-[9px] font-medium text-zinc-800 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ash leading-snug line-clamp-2 mb-2">
                        {item.description}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-ash">
                        <span>Best for: {item.best_for}</span>
                        <span>~{item.estimated_tokens.toLocaleString()} tokens</span>
                      </div>
                    </div>

                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isChecked ? "bg-zinc-900 border-zinc-900" : "border-[#c0baba]"
                    }`}>
                      {isChecked && <Check className="w-3 h-3 text-paper-raised" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!polling && catalog.length > 0 && (
          <div className="p-6 border-t border-paper-sunken flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0 bg-paper-sunken rounded-b-2xl">
            <div className="text-xs text-ash">
              {totalChecked > 0 ? (
                <span>
                  Checked {totalChecked} reports · Estimated token budget: <strong>~{totalTokens.toLocaleString()} tokens</strong>
                </span>
              ) : (
                <span>No reports selected</span>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || totalChecked === 0}
              className="px-6 py-2.5 bg-zinc-900 text-paper-raised text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Starting..." : `Add reports (${totalChecked})`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
