"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, FileText, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type CatalogItem } from "@/lib/api";

export function ReportSelector({ projectId, buttonText = "Run Analysis" }: { projectId: string, buttonText?: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await api.getReportCatalog(session.access_token);
        setCatalog(res.catalog);
        const defaults = new Set<string>();
        res.catalog.forEach(item => {
          if (item.is_recommended || item.is_default) defaults.add(item.id);
        });
        setCheckedIds(defaults);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartAnalysis = async () => {
    if (checkedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await api.triggerAnalysisWithSelectedReports(session.access_token, projectId, Array.from(checkedIds));
      router.refresh();
      router.push(`/projects/${projectId}?analyzing=true`);
    } catch (e: any) {
      setError(e.message || "Failed to start analysis");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-paper-raised rounded-2xl border border-paper-sunken mt-6 max-w-2xl mx-auto">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-800" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-paper-raised p-6 rounded-2xl border border-paper-sunken shadow-sm mt-6 text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-zinc-700" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-obsidian">What do you want Trixon to look at?</h3>
          <p className="text-xs text-ash mt-0.5">Pick what's useful right now. You can always add others later.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[40vh] overflow-y-auto pr-2">
        {catalog.map(item => {
          const isChecked = checkedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={`border rounded-xl p-3 flex gap-3 cursor-pointer transition-all ${
                isChecked ? "border-zinc-800 bg-zinc-50" : "border-paper-sunken bg-paper-raised hover:border-[#837e80]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <h4 className="text-sm font-semibold text-obsidian truncate">{item.title}</h4>
                  {item.is_recommended && (
                    <span className="text-[9px] font-medium text-zinc-800 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                      For you
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ash line-clamp-2">{item.description}</p>
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

      {error && <div className="text-sm text-red-500 mb-4">{error}</div>}

      <button
        onClick={handleStartAnalysis}
        disabled={submitting || checkedIds.size === 0}
        className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? "Starting..." : `${buttonText} (${checkedIds.size} reports)`}
      </button>
    </div>
  );
}
