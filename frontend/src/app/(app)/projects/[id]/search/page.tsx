"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  FileCode,
  FileText,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type Project, type AnalysisStatus } from "@/lib/api";
import { ProjectLayout } from "@/components/project-layout";

type SearchResult = {
  result_type: "code" | "report" | "action_item";
  title: string;
  snippet: string;
  line_number: number | null;
  relevance_score: number;
  report_type: string | null;
  item_id: string | null;
  severity: string | null;
  category: string | null;
  ai_prompt: string | null;
  status: string | null;
};

type FilterType = "all" | "code" | "reports" | "action_items";

const REPORT_LABELS: Record<string, string> = {
  executive_summary: "Executive Summary",
  architecture: "Architecture",
  tech_debt: "Tech Debt",
  security: "Security Risk Scan",
  scalability: "Can It Handle Growth?",
  onboarding: "Dev Onboarding Guide",
  investor: "Investor Technical Summary",
  team_readiness: "Team Readiness Report",
};

const SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-[#E53E3E]/10 text-[#E53E3E] border-[#E53E3E]/20" },
  high: { label: "High", cls: "bg-[#E53E3E]/10 text-[#E53E3E] border-[#E53E3E]/20" },
  medium: { label: "Medium", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20" },
  low: { label: "Low", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-[#039a85]/15 text-[#1e1b1b] rounded px-0.5 not-italic font-semibold">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function CodeResult({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) {
  const lines = result.snippet.split("\n");

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-sunken bg-paper-sunken/50">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-[#039a85] flex-shrink-0" />
          <span className="text-xs font-mono font-semibold text-[#1e1b1b] truncate">
            {result.title}
          </span>
        </div>
        {result.line_number && (
          <span className="text-xs text-ash flex-shrink-0 ml-2">
            Line {result.line_number}
          </span>
        )}
      </div>
      <div className="p-0 overflow-x-auto">
        <pre className="text-[11px] font-mono leading-relaxed p-3">
          {lines.map((line, idx) => {
            const lineNum = result.line_number
              ? result.line_number - 2 + idx
              : idx + 1;
            const isMatch =
              result.line_number !== null && lineNum === result.line_number;
            return (
              <div
                key={idx}
                className={`flex gap-3 px-1 rounded ${
                  isMatch ? "bg-[#039a85]/10" : ""
                }`}
              >
                <span className="text-ash/50 select-none w-6 text-right flex-shrink-0">
                  {lineNum > 0 ? lineNum : ""}
                </span>
                <span className={isMatch ? "text-[#1e1b1b]" : "text-ash"}>
                  {isMatch ? highlightMatch(line, query) : line}
                </span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function ReportResult({
  result,
  query,
  projectId,
}: {
  result: SearchResult;
  query: string;
  projectId: string;
}) {
  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1e1b1b]">{result.title}</p>
            <p className="text-[10px] text-ash">Report</p>
          </div>
        </div>
        {result.report_type && (
          <a
            href={`/projects/${projectId}/reports/${result.report_type}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#039a85] hover:text-[#02897a] transition-colors flex-shrink-0"
          >
            View
            <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>
      <p className="text-xs text-ash leading-relaxed border-t border-paper-sunken pt-3">
        {highlightMatch(result.snippet, query)}
      </p>
    </div>
  );
}

function ActionItemResult({
  result,
  query,
  token,
  onStatusUpdate,
}: {
  result: SearchResult;
  query: string;
  token: string;
  onStatusUpdate: (itemId: string, newStatus: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const sevConfig = result.severity ? SEVERITY_CONFIG[result.severity] : null;

  const handleCopyPrompt = async () => {
    if (!result.ai_prompt) return;
    await navigator.clipboard.writeText(result.ai_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResolve = async () => {
    if (!result.item_id) return;
    setUpdatingStatus(true);
    try {
      await api.updateActionItemStatus(token, result.item_id, "resolved");
      onStatusUpdate(result.item_id, "resolved");
    } catch {
      // handle error silently
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-[#1e1b1b] leading-snug">
            {highlightMatch(result.title, query)}
          </p>
        </div>
        {sevConfig && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sevConfig.cls}`}
          >
            {sevConfig.label}
          </span>
        )}
      </div>
      <p className="text-xs text-ash leading-relaxed mb-3 pl-5">
        {highlightMatch(result.snippet, query)}
      </p>
      <div className="flex items-center gap-2 pl-5 pt-2 border-t border-paper-sunken">
        {result.ai_prompt && (
          <button
            onClick={handleCopyPrompt}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ash border border-paper-sunken px-2.5 py-1 rounded-lg hover:bg-paper-sunken transition-colors"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#039a85]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied!" : "Copy AI Prompt"}
          </button>
        )}
        {result.status === "open" && (
          <button
            onClick={handleResolve}
            disabled={updatingStatus}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#039a85] border border-[#039a85]/20 bg-[#039a85]/5 px-2.5 py-1 rounded-lg hover:bg-[#039a85]/10 transition-colors disabled:opacity-60"
          >
            {updatingStatus ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load project
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);
      try {
        const proj = await api.getProject(session.access_token, projectId);
        setProject(proj);
        if (proj.latest_analysis) setAnalysis(proj.latest_analysis);
      } catch {
        router.push("/dashboard");
      }
    })();
    // Auto-focus search bar on mount
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const runSearch = useCallback(async (q: string, f: FilterType) => {
    if (!token || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const searchIn = f === "all"
        ? (["code", "reports", "action_items"] as const)
        : ([f] as const);
      const res = await api.searchProject(token, projectId, q, [...searchIn]);
      setResults(res.results);
      setTotal(res.total);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, filter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filter, runSearch]);

  const handleStatusUpdate = (itemId: string, newStatus: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.item_id === itemId ? { ...r, status: newStatus } : r
      )
    );
  };

  const filteredResults =
    filter === "all"
      ? results
      : results.filter((r) => {
          if (filter === "code") return r.result_type === "code";
          if (filter === "reports") return r.result_type === "report";
          if (filter === "action_items") return r.result_type === "action_item";
          return true;
        });

  const countByType = {
    code: results.filter((r) => r.result_type === "code").length,
    reports: results.filter((r) => r.result_type === "report").length,
    action_items: results.filter((r) => r.result_type === "action_item").length,
  };

  if (!project || !analysis) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-ash" />
      </div>
    );
  }

  return (
    <ProjectLayout project={project} analysis={analysis} activeTab="search">
      <div className="space-y-5 mt-6">

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ash">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, reports, and action items…"
            className="w-full bg-paper-raised border border-paper-sunken rounded-xl pl-11 pr-10 py-3.5 text-sm text-obsidian placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-[#039a85]/30 focus:border-[#039a85]/50 transition-all shadow-sm"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ash hover:text-obsidian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: "all", label: "All", count: total },
              { key: "code", label: "Code", count: countByType.code },
              { key: "reports", label: "Reports", count: countByType.reports },
              { key: "action_items", label: "Action Items", count: countByType.action_items },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                filter === key
                  ? "bg-obsidian text-paper-raised border-obsidian"
                  : "bg-paper-raised text-ash border-paper-sunken hover:text-obsidian hover:border-zinc-400"
              }`}
            >
              {label}
              {searched && count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    filter === key
                      ? "bg-white/20 text-white"
                      : "bg-paper-sunken text-ash"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Results */}
        {!searched && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-paper-raised border border-paper-sunken rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-5 h-5 text-ash" />
            </div>
            <p className="text-sm font-semibold text-obsidian mb-1">Search your codebase</p>
            <p className="text-xs text-ash max-w-xs mx-auto leading-relaxed">
              Search across key files, generated reports, and action items. Try searching for a function name, technology, or issue.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {["stripe", "authentication", "database", "security"].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-xs font-mono bg-paper-raised border border-paper-sunken text-ash px-2.5 py-1 rounded-lg hover:text-obsidian hover:border-zinc-400 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {searched && filteredResults.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-paper-raised border border-paper-sunken rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-5 h-5 text-ash" />
            </div>
            <p className="text-sm font-semibold text-obsidian mb-1">No results found</p>
            <p className="text-xs text-ash">
              Try a different search term or broaden your filter.
            </p>
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ash">
                {total > filteredResults.length
                  ? `Showing top ${filteredResults.length} of ${total} results`
                  : `${filteredResults.length} result${filteredResults.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="space-y-3">
              {filteredResults.map((result, idx) => (
                <div key={idx}>
                  {result.result_type === "code" && (
                    <CodeResult result={result} query={query} />
                  )}
                  {result.result_type === "report" && (
                    <ReportResult result={result} query={query} projectId={projectId} />
                  )}
                  {result.result_type === "action_item" && token && (
                    <ActionItemResult
                      result={result}
                      query={query}
                      token={token}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProjectLayout>
  );
}
