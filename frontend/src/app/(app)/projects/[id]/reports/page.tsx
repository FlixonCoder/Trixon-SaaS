"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Zap, FileText, BookOpen, BarChart3, Activity, Users, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type Project, type AnalysisStatus, type CatalogItem } from "@/lib/api";
import { ReportCatalogModal } from "@/components/report-catalog-modal";
import { ProjectLayout } from "@/components/project-layout";

const REPORT_CONFIG = [
  {
    type: "executive_summary",
    label: "What You Built",
    description: "Plain English overview of your codebase",
    icon: FileText,
    theme: {
      iconBg: "bg-zinc-100/80 text-zinc-700 border-zinc-205",
      hoverBorder: "group-hover:border-zinc-300",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(39,39,42,0.06)]",
      hoverBg: "group-hover:bg-zinc-50/20",
    }
  },
  {
    type: "architecture",
    label: "How It All Connects",
    description: "How your system's components connect",
    icon: BarChart3,
    theme: {
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
      hoverBorder: "group-hover:border-purple-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(147,51,234,0.08)]",
      hoverBg: "group-hover:bg-purple-50/25",
    }
  },
  {
    type: "tech_debt",
    label: "What's Messy & Risky",
    description: "What's messy, risky, or unscalable",
    icon: Activity,
    theme: {
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      hoverBorder: "group-hover:border-amber-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(245,158,11,0.08)]",
      hoverBg: "group-hover:bg-amber-50/25",
    }
  },
  {
    type: "security",
    label: "Security Risk Scan",
    description: "Secrets, missing auth, exposed endpoints",
    icon: Shield,
    theme: {
      iconBg: "bg-red-50 text-red-650 border-red-100",
      hoverBorder: "group-hover:border-red-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(239,68,68,0.08)]",
      hoverBg: "group-hover:bg-red-50/25",
    }
  },
  {
    type: "scalability",
    label: "Can It Handle Growth?",
    description: "What breaks first at 10x users",
    icon: Zap,
    theme: {
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      hoverBorder: "group-hover:border-blue-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)]",
      hoverBg: "group-hover:bg-blue-50/25",
    }
  },
  {
    type: "onboarding",
    label: "Dev Onboarding Guide",
    description: "What a new developer needs to know",
    icon: BookOpen,
    theme: {
      iconBg: "bg-green-50 text-green-700 border-green-100",
      hoverBorder: "group-hover:border-green-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(34,197,94,0.08)]",
      hoverBg: "group-hover:bg-green-50/25",
    }
  },
  {
    type: "investor",
    label: "Investor Technical Summary",
    description: "Due-diligence 1-pager for fundraising",
    icon: FileText,
    theme: {
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
      hoverBorder: "group-hover:border-indigo-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)]",
      hoverBg: "group-hover:bg-indigo-50/25",
    }
  },
  {
    type: "team_readiness",
    label: "Team Readiness Report",
    description: "Who to hire, when, and what to look for",
    icon: Users,
    theme: {
      iconBg: "bg-pink-50 text-pink-600 border-pink-100",
      hoverBorder: "group-hover:border-pink-300/85",
      hoverShadow: "group-hover:shadow-[0_8px_30px_rgba(236,72,153,0.08)]",
      hoverBg: "group-hover:bg-pink-50/25",
    }
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
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
      </div>
    );
  }

  if (!project || !analysis) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl border border-paper-sunken max-w-sm shadow-md">
          <p className="text-sm text-ash mb-4">No completed analysis run found.</p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-obsidian text-white text-xs font-semibold rounded-lg hover:bg-obsidian-raised transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-paper">
      <main className="w-full mx-auto px-6 py-10">
        <ProjectLayout project={project} analysis={analysis} activeTab="reports">
          <div className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-obsidian tracking-tight">Your Reports</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#039a85] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#039a85]"></span>
                  </span>
                  <p className="text-xs text-ash font-medium">
                    Analysis for {project.repo_name} · Snapshot #{analysis.snapshot_number || 1}
                  </p>
                </div>
              </div>
            </div>

            {/* Reports Grid */}
            <div className="mb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeReports.map((report) => {
                  const Icon = report.icon;

                  const matchedCatalogItem = catalog.find((c) => c.id === report.type);
                  const displayTitle = matchedCatalogItem ? matchedCatalogItem.title : report.label;
                  const displayDesc = matchedCatalogItem ? matchedCatalogItem.description : report.description;

                  return (
                    <Link
                      key={report.type}
                      href={`/projects/${projectId}/reports/${report.type}?analysis=${analysis.id}`}
                      className={`bg-white border border-paper-sunken hover:border-transparent rounded-2xl p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg group block relative overflow-hidden ${report.theme.hoverBorder} ${report.theme.hoverShadow} ${report.theme.hoverBg}`}
                    >
                      {/* Accent back-glow */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white via-white to-transparent pointer-events-none" />

                      <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border transition-all duration-300 group-hover:scale-105 ${report.theme.iconBg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-base text-obsidian tracking-tight">{displayTitle}</h3>
                      </div>
                      
                      <p className="text-sm text-ash leading-relaxed mb-6 relative z-10 min-h-[40px]">{displayDesc}</p>
                      
                      <div className="text-xs font-semibold flex items-center gap-1.5 text-zinc-700 group-hover:text-signal transition-colors relative z-10 uppercase tracking-wider">
                        <span>Read report</span>
                        <span className="text-sm transform group-hover:translate-x-1.5 transition-transform duration-300">→</span>
                      </div>
                    </Link>
                  );
                })}

                {/* "+ Add report" card */}
                {hasMoreReports && (
                  <button
                    onClick={() => setShowCatalogModal(true)}
                    className="bg-white hover:bg-paper-sunken/30 border border-dashed border-[#c0baba] hover:border-signal rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col items-center justify-center min-h-[180px] text-center group gap-2 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-paper-sunken text-[#1e1b1b] flex items-center justify-center group-hover:bg-signal group-hover:text-white transition-all duration-300 shadow-sm border border-black/5">
                      <span className="text-xl font-bold font-display">+</span>
                    </div>
                    <h3 className="font-bold text-sm text-obsidian tracking-tight mt-1">Add report</h3>
                    <p className="text-xs text-ash max-w-[180px] leading-normal">Generate additional insight categories</p>
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
