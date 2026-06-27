"use client";

import Link from "next/link";
import {
  Shield,
  Zap,
  Lock,
  RefreshCw,
  Clock,
  FileText,
  AlertCircle,
  BookOpen,
  BarChart3,
  FolderGit2,
  GitBranch,
  Activity,
  CheckCircle,
  XCircle,
  Users,
  ListTodo,
  History,
  MessageCircle,
  Flame,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { api, type Project, type AnalysisStatus, type CatalogItem } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { TrixonEngageCTA } from "@/components/trixon-engage-cta";
import { ProjectLayout } from "@/components/project-layout";
import { TutorialOverlay } from "@/components/tutorial-overlay";


function ClientDate({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="opacity-0">–</span>;
  return <span suppressHydrationWarning>{new Date(date).toLocaleDateString()}</span>;
}

interface ProjectDashboardProps {
  project: Project;
  analysis: AnalysisStatus;
  hasFullAccess?: boolean;
}

const REPORT_CONFIG = [
  {
    type: "executive_summary",
    label: "Executive Summary",
    description: "Plain English overview of your codebase",
    icon: FileText,
    gradient: "from-zinc-100/70 to-zinc-50/50",
    iconColor: "text-zinc-700",
    iconBg: "bg-zinc-100 border border-zinc-200/50",
  },
  {
    type: "architecture",
    label: "Architecture",
    description: "How your system's components connect",
    icon: BarChart3,
    gradient: "from-purple-50 to-purple-50/50",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50",
  },
  {
    type: "tech_debt",
    label: "Tech Debt",
    description: "What's messy, risky, or unscalable",
    icon: Activity,
    gradient: "from-amber-50 to-amber-50/50",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
  },
  {
    type: "security",
    label: "Security Risks",
    description: "Secrets, missing auth, exposed endpoints",
    icon: Shield,
    gradient: "from-red-50 to-red-50/50",
    iconColor: "text-red-500",
    iconBg: "bg-red-50",
  },
  {
    type: "scalability",
    label: "Scalability",
    description: "What breaks first at 10x users",
    icon: Zap,
    gradient: "from-blue-50 to-blue-50/50",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
  },
  {
    type: "onboarding",
    label: "Dev Onboarding Guide",
    description: "What a new developer needs to know",
    icon: BookOpen,
    gradient: "from-green-50 to-green-50/50",
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
  },
  {
    type: "investor",
    label: "Investor Summary",
    description: "Due-diligence 1-pager for fundraising",
    icon: Lock,
    gradient: "from-indigo-50 to-indigo-50/50",
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
  },
  {
    type: "team_readiness",
    label: "Team Readiness",
    description: "Who to hire, when, and what to look for",
    icon: Users,
    gradient: "from-pink-50 to-pink-50/50",
    iconColor: "text-pink-500",
    iconBg: "bg-pink-50",
  },
];

function Sparkline({ data }: { data: number[] }) {
  if (data.length <= 1) return null;
  const width = 50;
  const height = 16;
  const padding = 2;
  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - val / 100) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80 mt-1.5">
      <polyline
        fill="none"
        stroke="var(--color-obsidian)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={padding + (width - padding * 2)}
        cy={padding + (1 - data[data.length - 1] / 100) * (height - padding * 2)}
        r={1.5}
        fill="var(--color-obsidian)"
      />
    </svg>
  );
}

function ScoreRing({ score, label, size = 80, sparklineData = null }: { score: number | null; label: string; size?: number; sparklineData?: number[] | null }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const displayScore = score ?? 0;
  const dashOffset = score !== null ? circumference - (displayScore / 100) * circumference : circumference;
  const color = score === null ? "var(--color-paper-sunken)" : score >= 80 ? "var(--color-obsidian)" : score >= 60 ? "#71717a" : "var(--color-trixon-danger)";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-paper-sunken)"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold font-mono" style={{ color: score === null ? "var(--color-ash)" : color }}>
            {score !== null ? score : "N/A"}
          </span>
        </div>
      </div>
      <span className="text-xs text-ash text-center leading-tight font-sans">{label}</span>
      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} />
      )}
    </div>
  );
}

function BadgeShareCard({ projectId, healthScore }: { projectId: string; healthScore: number }) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://trixon.cloud";
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "https://api.trixon.cloud";
  const badgeMarkdown = `[![Trixon Health: ${healthScore}/100](${apiUrl}/api/badge/${projectId})](${appUrl}/public/${projectId})`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-obsidian mb-0.5">Share your score</p>
          <p className="text-xs text-ash">Embed this badge in your GitHub README to showcase your health score.</p>
        </div>
        {/* Live badge preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiUrl}/api/badge/${projectId}`}
          alt={`Trixon Health: ${healthScore}/100`}
          className="h-5 flex-shrink-0"
        />
      </div>
      <div className="mt-4 flex items-center gap-2 bg-paper-sunken rounded-xl px-3 py-2.5 border border-paper-sunken">
        <code className="font-mono text-[10px] text-ash flex-1 truncate">
          {badgeMarkdown}
        </code>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-lg border transition-all ${
            copied
              ? "bg-signal/10 border-signal/20 text-signal"
              : "bg-paper-raised border-paper-sunken text-obsidian hover:bg-paper-sunken"
          }`}
        >
          {copied ? "Copied!" : "Copy for README"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, icon: Icon }: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-4 flex items-start gap-3 card-elevated">
      {Icon && (
        <div className="w-8 h-8 bg-paper-sunken rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-zinc-700" />
        </div>
      )}
      <div>
        <div className="text-2xl font-bold text-obsidian font-mono">{value}</div>
        <div className="text-sm text-obsidian font-medium mt-0.5">{label}</div>
        {sublabel && <div className="text-xs text-ash mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

function LanguageBar({ breakdown }: { breakdown: Record<string, number> }) {
  const COLORS = [
    "var(--color-obsidian)", "#3B82F6", "#8B5CF6", "var(--color-trixon-warning)", "#EC4899", "#10B981", "#F97316",
  ];
  const entries = Object.entries(breakdown).slice(0, 7);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-obsidian">Language Breakdown</h3>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {entries.map(([lang, pct], i) => (
          <div
            key={lang}
            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
            className="transition-all"
            title={`${lang}: ${pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([lang, pct], i) => (
          <div key={lang} className="flex items-center gap-1.5 text-xs text-ash">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {lang} ({pct}%)
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectDashboard({ project, analysis: initialAnalysis, hasFullAccess }: ProjectDashboardProps) {
  const [reanalysing, setReanalysing] = useState(false);
  const [reanalyseError, setReanalyseError] = useState<string | null>(null);
  const [reanalyseSuccess, setReanalyseSuccess] = useState(false);

  // v3.0 + v3.1 states
  const [webhookConnected, setWebhookConnected] = useState(project.webhook_connected);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [quickWinsCount, setQuickWinsCount] = useState(0);
  const [latestDiff, setLatestDiff] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const stats = initialAnalysis.stats;
  const languageBreakdown = initialAnalysis.language_breakdown || {};
  const services = initialAnalysis.third_party_services?.services || [];

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        // Fetch Action Items count
        const aiRes = await api.getActionItems(session.access_token, project.id, { status: "open" });
        setOpenCount(aiRes.items.length);
        setQuickWinsCount(aiRes.items.filter(i => i.effort_level === "quick-win").length);

        // Fetch Timeline for sparklines
        const tlRes = await api.getProjectTimeline(session.access_token, project.id);
        setTimeline(tlRes.timeline || []);

        // Fetch Latest Diff
        if (initialAnalysis.snapshot_number && initialAnalysis.snapshot_number > 1) {
          const diff = await api.getAnalysisDiff(session.access_token, initialAnalysis.id);
          setLatestDiff(diff);
        }

        // Fetch Catalog
        try {
          const catRes = await api.getReportCatalog(session.access_token);
          setCatalog(catRes.catalog || []);
        } catch (e) {
          console.error("Failed to fetch report catalog:", e);
        }
      } catch (e) {
        console.error("Dashboard metadata load failed:", e);
      }
    })();
  }, [project.id, initialAnalysis]);

  const handleToggleWebhook = async () => {
    setWebhookLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      if (webhookConnected) {
        await api.disableWebhook(session.access_token, project.id);
        setWebhookConnected(false);
      } else {
        await api.enableWebhook(session.access_token, project.id, project.platform || "github");
        setWebhookConnected(true);
      }
    } catch (e) {
      console.error("Failed to toggle webhook:", e);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleReanalyse = useCallback(async () => {
    setReanalysing(true);
    setReanalyseError(null);
    setReanalyseSuccess(false);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      
      // Pass currently selected reports
      const currentReports = initialAnalysis.selected_reports || ["executive_summary", "architecture", "tech_debt"];
      await api.triggerAnalysisWithSelectedReports(session.access_token, project.id, currentReports);
      setReanalyseSuccess(true);
      // Reload page to show progress tracker
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start re-analysis";
      setReanalyseError(msg);
    } finally {
      setReanalysing(false);
    }
  }, [project.id, initialAnalysis]);

  // Sparkline trend data arrays
  const healthTrend = [...timeline].reverse().map(t => t.health_score).filter((v): v is number => v !== null);
  const securityTrend = [...timeline].reverse().map(t => t.security_score).filter((v): v is number => v !== null);
  const scalabilityTrend = [...timeline].reverse().map(t => t.scalability_score).filter((v): v is number => v !== null);
  const qualityTrend = [...timeline].reverse().map(t => t.quality_score).filter((v): v is number => v !== null);
  const docsTrend = [...timeline].reverse().map(t => t.docs_score).filter((v): v is number => v !== null);

  const diffVerdict = latestDiff?.verdict;
  const showChangelog = !!latestDiff;

  return (
    <ProjectLayout project={project} analysis={initialAnalysis} activeTab="dashboard">
      <TutorialOverlay isFirstAnalysis={initialAnalysis.snapshot_number === 1} />
      <div className="space-y-6 mt-6">
        {/* v3.0 Enriched Navigation & Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action Items Card */}
          <Link
            href={`/projects/${project.id}/action-items`}
            className="group flex flex-col justify-between bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:border-zinc-400 hover:shadow-sm transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <ListTodo className="w-4 h-4 text-red-500" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ash/70 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-obsidian">Open Action Items</h3>
              <p className="text-xs text-ash mt-1 leading-snug">
                Issues found sorted by priority. Fix them using Cursor/Claude prompt templates.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-100">
                {openCount} Open Issues
              </span>
              {quickWinsCount > 0 && (
                <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-full border border-zinc-200">
                  {quickWinsCount} Quick Wins
                </span>
              )}
            </div>
          </Link>

          {/* Latest Changes / Changelog Card */}
          {showChangelog ? (
            <Link
              href={`/projects/${project.id}/timeline`}
              className="group flex flex-col justify-between bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:border-zinc-400 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                    <History className="w-4 h-4 text-purple-500" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ash/70 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-obsidian">Latest Changelog</h3>
                  {diffVerdict && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      diffVerdict === "improved" ? "bg-zinc-100 text-zinc-800 border border-zinc-200" :
                      diffVerdict === "regressed" ? "bg-red-50 text-red-700 border border-red-100" :
                      "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      {diffVerdict.replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ash mt-1.5 leading-relaxed line-clamp-2">
                  {latestDiff.summary_markdown || "No changes summary generated yet."}
                </p>
              </div>
              <div className="mt-4 text-[10px] text-ash/70 font-medium">
                Click to view timeline & diff details
              </div>
            </Link>
          ) : (
            <Link
              href={`/projects/${project.id}/timeline`}
              className="group flex flex-col justify-between bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:border-zinc-400 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                    <History className="w-4 h-4 text-purple-500" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ash/70 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="text-sm font-bold text-obsidian">Snapshot Timeline</h3>
                <p className="text-xs text-ash mt-1 leading-snug">
                  Track health trends and compare codebase diffs across snapshots.
                </p>
              </div>
              <div className="mt-4 text-[10px] text-ash/70 font-medium">
                No previous snapshot to compare
              </div>
            </Link>
          )}

          {/* Chat Card */}
          <Link
            href={`/projects/${project.id}/chat`}
            className="group flex flex-col justify-between bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:border-zinc-400 hover:shadow-sm transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-zinc-700" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ash/70 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-obsidian">Chat</h3>
              <p className="text-xs text-ash mt-1 leading-snug">
                Chat directly with our AI codebase advisor about reports, files, or design decisions.
              </p>
            </div>
            <div className="mt-4 text-[10px] text-ash/70 font-medium">
              SSE Streaming enabled
            </div>
          </Link>
        </div>


      <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-obsidian">Health Scores</h2>
          <span className="text-xs text-ash">0–100</span>
        </div>
        <div className="flex items-center justify-around flex-wrap gap-6">
          <ScoreRing score={initialAnalysis.health_score ?? null} label="Overall Health" size={96} sparklineData={healthTrend} />
          <ScoreRing score={initialAnalysis.security_score ?? null} label="Security" sparklineData={securityTrend} />
          <ScoreRing score={initialAnalysis.scalability_score ?? null} label="Scalability" sparklineData={scalabilityTrend} />
          <ScoreRing score={initialAnalysis.quality_score ?? null} label="Code Quality" sparklineData={qualityTrend} />
          <ScoreRing score={initialAnalysis.docs_score ?? null} label="Documentation" sparklineData={docsTrend} />
        </div>
      </div>

      {/* Badge Share Card — v3.6 */}
      {initialAnalysis.health_score !== null && (
        <BadgeShareCard
          projectId={project.id}
          healthScore={initialAnalysis.health_score}
        />
      )}

      {/* Stats + Languages Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stats Grid */}
        {stats && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-obsidian">Codebase Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Files" value={stats.total_files.toLocaleString()} />
              <StatCard label="Lines of Code" value={stats.total_lines.toLocaleString()} />
              <StatCard label="API Endpoints" value={stats.total_endpoints} />
              <StatCard label="Dependencies" value={stats.total_dependencies} />
            </div>
          </div>
        )}

        {/* Language Breakdown */}
        {Object.keys(languageBreakdown).length > 0 && (
          <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
            <LanguageBar breakdown={languageBreakdown} />
          </div>
        )}
      </div>

      {/* Third-Party Services */}
      {services.length > 0 && (
        <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
          <h3 className="text-sm font-semibold text-obsidian mb-4">
            Services Detected
            <span className="ml-2 text-xs font-normal text-ash">({services.length} found)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <span
                key={service}
                className="px-3 py-1.5 bg-paper-sunken text-obsidian text-xs font-medium rounded-lg border border-paper-sunken capitalize"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reports Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-obsidian">Your Reports</h2>
          <Link
            href={`/projects/${project.id}/reports`}
            className="text-xs text-zinc-800 hover:text-zinc-950 hover:underline font-semibold"
          >
            View all
          </Link>
        </div>

        {/* Available Reports */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-ash uppercase tracking-wider mb-3">Available Now</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(catalog.length > 0 ? catalog : REPORT_CONFIG.map(r => ({ id: r.type, title: r.label, description: r.description })) as any)
              .filter((c: any) => (initialAnalysis.selected_reports || ["executive_summary", "architecture", "tech_debt"]).includes(c.id || c.type))
              .map((report: any) => {
              const conf = REPORT_CONFIG.find(r => r.type === (report.id || report.type)) || REPORT_CONFIG[0];
              const Icon = conf.icon;
              return (
                <Link
                  key={report.id || report.type}
                  href={`/projects/${project.id}/reports/${report.id || report.type}?analysis=${initialAnalysis.id}`}
                  className={`bg-gradient-to-br ${conf.gradient} border border-paper-sunken rounded-xl p-5 hover:shadow-md transition-all group block`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 bg-paper-raised rounded-lg flex items-center justify-center shadow-sm`}>
                      <Icon className={`w-4 h-4 ${conf.iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-sm text-obsidian leading-tight">{report.title || report.label}</h3>
                  </div>
                  <p className="text-xs text-ash leading-relaxed">{report.description}</p>
                  <div className="mt-4 text-xs font-medium text-zinc-800 group-hover:text-zinc-950 group-hover:underline flex items-center gap-1">
                    Read report
                    <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Locked Reports */}
        {!hasFullAccess && (
          <div className="mb-6 relative">
            <h3 className="text-xs font-semibold text-ash uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Locked (Requires Full Audit)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60 pointer-events-none">
              {(catalog.length > 0 ? catalog : REPORT_CONFIG.map(r => ({ id: r.type, title: r.label, description: r.description })) as any)
                .filter((c: any) => !(initialAnalysis.selected_reports || ["executive_summary", "architecture", "tech_debt"]).includes(c.id || c.type))
                .map((report: any) => {
                const conf = REPORT_CONFIG.find(r => r.type === (report.id || report.type)) || REPORT_CONFIG[0];
                const Icon = conf.icon;
                return (
                  <div
                    key={report.id || report.type}
                    className={`bg-paper-sunken border border-paper-sunken rounded-xl p-5 transition-all block relative`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 bg-paper-raised rounded-lg flex items-center justify-center shadow-sm opacity-50`}>
                        <Icon className={`w-4 h-4 text-ash`} />
                      </div>
                      <h3 className="font-semibold text-sm text-obsidian leading-tight">{report.title || report.label}</h3>
                    </div>
                    <p className="text-xs text-ash leading-relaxed">{report.description}</p>
                    <div className="absolute top-4 right-4">
                      <Lock className="w-4 h-4 text-ash" />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center">
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6 text-center max-w-md w-full shadow-sm">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-indigo-500" />
                </div>
                <h3 className="text-base font-bold text-obsidian mb-2">Unlock Full Technical Audit</h3>
                <p className="text-xs text-ash mb-5 leading-relaxed">
                  Get access to architecture, tech debt, scalability, security, onboarding, and investor reports.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center w-full bg-obsidian text-paper-raised px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  View Pricing Options
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trixon Engage CTA */}
      <div className="mt-8">
        <TrixonEngageCTA
          healthScore={initialAnalysis.health_score ?? 50}
          securityScore={initialAnalysis.security_score ?? 50}
          scalabilityScore={initialAnalysis.scalability_score ?? 50}
          qualityScore={initialAnalysis.quality_score ?? 50}
          docsScore={initialAnalysis.docs_score ?? 50}
        />
      </div>
    </div>
  </ProjectLayout>
);
}
