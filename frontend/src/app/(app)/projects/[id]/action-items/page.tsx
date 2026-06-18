"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Shield, Wrench, Zap, CheckCircle2, Circle, Clock,
  Copy, Check, ChevronDown, AlertTriangle, Flame,
  Loader2, Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type ActionItem, type Project, type AnalysisStatus } from "@/lib/api";
import { ActionItemCard } from "@/components/action-item-card";
import { ProjectLayout } from "@/components/project-layout";

type StatusTab = "open" | "in_progress" | "resolved" | "ignored";
type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type CategoryFilter = "all" | "security" | "tech_debt" | "scalability";

export default function ActionItemsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("open");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

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
      } catch (e) {
        console.error("Failed to load project details for action items:", e);
      } finally {
        setProjectLoading(false);
      }
    })();
  }, [projectId]);

  const fetchItems = useCallback(async (status: StatusTab) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    try {
      const res = await api.getActionItems(session.access_token, projectId, {
        status,
        severity: severity !== "all" ? severity : undefined,
        category: category !== "all" ? category : undefined,
      });
      setItems(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId, severity, category]);

  useEffect(() => {
    if (project) {
      fetchItems(activeTab);
    }
  }, [activeTab, fetchItems, project]);

  const handleStatusChange = async (itemId: string, status: ActionItem["status"]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await api.updateActionItemStatus(session.access_token, itemId, status);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const criticalCount = items.filter(i => i.severity === "critical" || i.severity === "high").length;
  const quickWins = items.filter(i => i.effort_level === "quick-win").length;

  const STATUS_TABS: { id: StatusTab; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "in_progress", label: "In Progress" },
    { id: "resolved", label: "Resolved" },
    { id: "ignored", label: "Ignored" },
  ];

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
        <ProjectLayout project={project} analysis={analysis} activeTab="action-items">
          <div className="mt-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-obsidian mb-1">Action Items</h1>
                <p className="text-sm text-ash">
                  Trackable findings from your codebase analysis — sorted by priority
                </p>
              </div>
              {activeTab === "open" && items.length > 0 && (
                <div className="flex gap-3 text-sm text-right">
                  {criticalCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium">
                      <Flame className="w-3.5 h-3.5" />
                      {criticalCount} critical/high
                    </div>
                  )}
                  {quickWins > 0 && (
                    <div className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      {quickWins} quick wins
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter bar */}
            <div className="bg-paper-raised border border-paper-sunken rounded-xl p-3 mb-5 flex flex-wrap items-center gap-3">
              {/* Status Tabs */}
              <div className="flex bg-paper-sunken rounded-lg p-0.5 gap-0.5">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-paper-raised text-obsidian shadow-sm"
                        : "text-ash hover:text-obsidian"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-paper-sunken" />

              {/* Severity filter */}
              <div className="relative">
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as SeverityFilter)}
                  className="appearance-none bg-paper-sunken border border-paper-sunken text-sm rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-zinc-800 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ash pointer-events-none" />
              </div>

              {/* Category filter */}
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as CategoryFilter)}
                  className="appearance-none bg-paper-sunken border border-paper-sunken text-sm rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-zinc-800 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="security">Security</option>
                  <option value="tech_debt">Tech Debt</option>
                  <option value="scalability">Scalability</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ash pointer-events-none" />
              </div>
            </div>

            {/* Items list */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
              </div>
            ) : items.length === 0 ? (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-16 text-center">
                <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-lg font-semibold text-obsidian mb-2">
                  {activeTab === "open" ? "All clear! 🎉" : `No ${activeTab} items`}
                </h3>
                <p className="text-sm text-ash">
                  {activeTab === "open"
                    ? "No open action items matching your filters. Run a new analysis to check for new findings."
                    : `No action items in the ${activeTab} state right now.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
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
