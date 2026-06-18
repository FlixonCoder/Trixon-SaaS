"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Zap, FileText, BookOpen, BarChart3, Activity, Lock, Users, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type Project, type AnalysisStatus, type CatalogItem } from "@/lib/api";
import { ReportCatalogModal } from "@/components/report-catalog-modal";
import { ProjectLayout } from "@/components/project-layout";

const FREE_REPORT_TYPES = new Set(["executive_summary", "security"]);

const REPORT_CONFIG = [
  {
    type: "executive_summary",
    label: "What You Built",
    description: "Plain English overview of your codebase",
    icon: FileText,
    gradient: "from-zinc-100/70 to-zinc-50/50",
    iconColor: "text-zinc-700",
  },
  {
    type: "architecture",
    label: "How It All Connects",
    description: "How your system's components connect",
    icon: BarChart3,
    gradient: "from-purple-50 to-purple-50/50",
    iconColor: "text-purple-500",
  },
  {
    type: "tech_debt",
    label: "What's Messy & Risky",
    description: "What's messy, risky, or unscalable",
    icon: Activity,
    gradient: "from-amber-50 to-amber-50/50",
    iconColor: "text-amber-500",
  },
  {
    type: "security",
    label: "Security Risk Scan",
    description: "Secrets, missing auth, exposed endpoints",
    icon: Shield,
    gradient: "from-red-50 to-red-50/50",
    iconColor: "text-red-500",
  },
  {
    type: "scalability",
    label: "Can It Handle Growth?",
    description: "What breaks first at 10x users",
    icon: Zap,
    gradient: "from-blue-50 to-blue-50/50",
    iconColor: "text-blue-500",
  },
  {
    type: "onboarding",
    label: "Dev Onboarding Guide",
    description: "What a new developer needs to know",
    icon: BookOpen,
    gradient: "from-green-50 to-green-50/50",
    iconColor: "text-green-600",
  },
  {
    type: "investor",
    label: "Investor Technical Summary",
    description: "Due-diligence 1-pager for fundraising",
    icon: FileText,
    gradient: "from-indigo-50 to-indigo-50/50",
    iconColor: "text-indigo-500",
  },
  {
    type: "team_readiness",
    label: "Team Readiness Report",
    description: "Who to hire, when, and what to look for",
    icon: Users,
    gradient: "from-pink-50 to-pink-50/50",
    iconColor: "text-pink-500",
  },
];

const DEFAULT_REPORTS = ["executive_summary", "architecture", "tech_debt"];

export default function ReportsListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [accessLevel, setAccessLevel] = useState<"basic" | "full">("basic");
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const proj = await api.getProject(session.access_token, projectId);
      setProject(proj);
      setAnalysis(proj.latest_analysis);

      try {
        const acc = await api.getAccessLevel(session.access_token, projectId);
        setAccessLevel(acc.access);
      } catch (e) {
        console.error("Access level fetch failed:", e);
      }

      try {
        const profile = await api.getProfile(session.access_token).catch(() => null);
        setPrimaryGoal(profile?.primary_goal || null);
      } catch (e) {
        console.error("Profile goal fetch failed:", e);
      }

      try {
        const catRes = await api.getReportCatalog(session.access_token);
        setCatalog(catRes.catalog || []);
      } catch (e) {
        console.error("Failed to fetch report catalog:", e);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId, router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
      </div>
    );
  }

  if (!project || !analysis) {
    return (
      <div className="min-h-screen bg-paper-sunken flex items-center justify-center p-4">
        <div className="text-center bg-paper-raised p-8 rounded-xl border border-paper-sunken max-w-sm">
          <p className="text-sm text-ash mb-4">No completed analysis run found.</p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-zinc-900 text-paper-raised text-xs font-semibold rounded-lg hover:bg-zinc-850 hover:bg-obsidian"
          >
            Go to Project
          </button>
        </div>
      </div>
    );
  }

  const selectedReportTypes = analysis.selected_reports || DEFAULT_REPORTS;

  const GOAL_PRIORITY: Record<string, string[]> = {
    prepare_investors: ["investor", "executive_summary", "security", "scalability"],
    prepare_hire: ["team_readiness", "onboarding", "architecture", "tech_debt"],
    enterprise_security: ["security", "architecture", "scalability", "tech_debt"],
    recover_agency: ["tech_debt", "architecture", "security", "onboarding"],
    general_audit: ["executive_summary", "security", "tech_debt", "architecture"],
  };

  let orderedReports = REPORT_CONFIG;
  if (primaryGoal && GOAL_PRIORITY[primaryGoal]) {
    const priority = GOAL_PRIORITY[primaryGoal];
    orderedReports = [...REPORT_CONFIG].sort((a, b) => {
      const aIdx = priority.indexOf(a.type);
      const bIdx = priority.indexOf(b.type);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });
  }

  const activeReports = orderedReports.filter(r => selectedReportTypes.includes(r.type));
  const hasMoreReports = catalog.length > 0
    ? catalog.some((c) => !selectedReportTypes.includes(c.id))
    : REPORT_CONFIG.some(r => !selectedReportTypes.includes(r.type));

  return (
    <div className="min-h-screen bg-paper-sunken">
      <main className="w-full mx-auto px-6 py-10">
        <ProjectLayout project={project} analysis={analysis} activeTab="reports">
          <div className="mt-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-obsidian">Your Reports</h1>
              <p className="text-sm text-ash mt-1">
                Analysis for {project.repo_name} · Snapshot #{analysis.snapshot_number || 1}
              </p>
            </div>

            {/* Reports Grid */}
            <div className="mb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeReports.map((report) => {
                  const Icon = report.icon;
                  const isLocked = false;

                  const matchedCatalogItem = catalog.find((c) => c.id === report.type);
                  const displayTitle = matchedCatalogItem ? matchedCatalogItem.title : report.label;
                  const displayDesc = matchedCatalogItem ? matchedCatalogItem.description : report.description;

                  return (
                    <Link
                      key={report.type}
                      href={`/projects/${projectId}/reports/${report.type}?analysis=${analysis.id}`}
                      className={`bg-gradient-to-br ${report.gradient} border border-paper-sunken rounded-2xl p-6 hover:shadow-md transition-all group block relative`}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-paper-raised rounded-xl flex items-center justify-center shadow-sm">
                          <Icon className={`w-6 h-6 ${report.iconColor}`} />
                        </div>
                        <h3 className="font-bold text-lg text-obsidian">{displayTitle}</h3>
                      </div>
                      <p className="text-sm text-ash leading-relaxed mb-6">{displayDesc}</p>
                      <div className="text-sm font-medium flex items-center gap-1 text-zinc-800 group-hover:text-zinc-950 group-hover:underline">
                        Read report <span className="text-lg">→</span>
                      </div>
                    </Link>
                  );
                })}

                {/* "+ Add report" card */}
                {hasMoreReports && (
                  <button
                    onClick={() => setShowCatalogModal(true)}
                    className="bg-paper-raised hover:bg-paper-sunken/50 border border-dashed border-[#c0baba] hover:border-zinc-400 rounded-2xl p-6 transition-all flex flex-col items-center justify-center min-h-[200px] text-center group gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-paper-raised transition-all">
                      <span className="text-xl font-bold">+</span>
                    </div>
                    <h3 className="font-semibold text-sm text-obsidian">Add report</h3>
                    <p className="text-xs text-ash max-w-[180px]">Generate additional insight categories</p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </ProjectLayout>

        {/* Modal display */}
        {showCatalogModal && (
          <ReportCatalogModal
            projectId={projectId}
            selectedReports={selectedReportTypes}
            onClose={() => setShowCatalogModal(false)}
            onReportsAdded={fetchData}
          />
        )}
      </main>
    </div>
  );
}
