"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderGit2,
  GitBranch,
  Clock,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Search,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { api, type Project, type AnalysisStatus } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

function ClientDate({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="opacity-0">–</span>;
  return <span suppressHydrationWarning>{new Date(date).toLocaleDateString()}</span>;
}

interface ProjectLayoutProps {
  project: Project;
  analysis: AnalysisStatus;
  activeTab: "dashboard" | "action-items" | "timeline" | "chat" | "reports" | "search";
  children: React.ReactNode;
}

export function ProjectLayout({
  project,
  analysis,
  activeTab,
  children,
}: ProjectLayoutProps) {
  const router = useRouter();
  const [webhookConnected, setWebhookConnected] = useState(project.webhook_connected);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [reanalysing, setReanalysing] = useState(false);
  const [reanalyseError, setReanalyseError] = useState<string | null>(null);
  const [reanalyseSuccess, setReanalyseSuccess] = useState(false);

  // Cmd+K / Ctrl+K shortcut — opens project search from anywhere in a project
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push(`/projects/${project.id}/search`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project.id, router]);

  useEffect(() => {
    setWebhookConnected(project.webhook_connected);
  }, [project.webhook_connected]);

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
      
      const currentReports = analysis.selected_reports || ["executive_summary", "architecture", "tech_debt"];
      await api.triggerAnalysisWithSelectedReports(session.access_token, project.id, currentReports);
      setReanalyseSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start re-analysis";
      setReanalyseError(msg);
    } finally {
      setReanalysing(false);
    }
  }, [project.id, analysis]);

  return (
    <div className="space-y-6">
      {/* Back to main dashboard link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-ash hover:text-obsidian transition-colors -mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-paper-raised border border-paper-sunken flex items-center justify-center">
            <FolderGit2 className="w-6 h-6 text-zinc-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-obsidian">
                {project.repo_name.split("/").pop()}
              </h1>
              {analysis.snapshot_number && (
                <span className="text-[10px] font-semibold bg-paper-sunken text-ash px-2 py-0.5 rounded-md border border-paper-sunken">
                  Snapshot #{analysis.snapshot_number}
                </span>
              )}
            </div>
            <p className="text-sm text-ash flex items-center gap-1.5 mt-0.5">
              <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
              {project.repo_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {project.last_synced_at && (
            <Link
              href={`/projects/${project.id}/history`}
              className="text-xs text-ash hover:text-obsidian flex items-center gap-1 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <ClientDate date={project.last_synced_at} />
            </Link>
          )}
          <button
            onClick={handleReanalyse}
            disabled={reanalysing}
            className="inline-flex items-center gap-2 border border-paper-sunken text-obsidian px-4 py-2 rounded-lg text-sm font-medium hover:bg-paper-sunken transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reanalysing ? "animate-spin" : ""}`} />
            {reanalysing ? "Starting…" : "Re-analyse"}
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-paper-sunken gap-6 flex-wrap">
        <Link
          href={`/projects/${project.id}`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all ${
            activeTab === "dashboard"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          Dashboard
        </Link>
        <Link
          href={`/projects/${project.id}/action-items`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all ${
            activeTab === "action-items"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          Action Items
        </Link>
        <Link
          href={`/projects/${project.id}/timeline`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all ${
            activeTab === "timeline"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          Timeline
        </Link>
        <Link
          href={`/projects/${project.id}/chat`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all ${
            activeTab === "chat"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          Chat
        </Link>
        <Link
          href={`/projects/${project.id}/reports`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all ${
            activeTab === "reports"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          Reports
        </Link>
        <Link
          href={`/projects/${project.id}/search`}
          className={`text-sm pb-3 px-1 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "search"
              ? "font-semibold text-zinc-900 border-zinc-900"
              : "font-medium text-ash border-transparent hover:text-obsidian"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Search
          <kbd className="hidden sm:inline-flex text-[9px] bg-paper-sunken border border-paper-sunken rounded px-1 py-0.5 font-mono text-ash/70">⌘K</kbd>
        </Link>
      </div>

      {/* Webhook Status Banner */}
      <div className="bg-paper-raised border border-paper-sunken rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              webhookConnected
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-slate-50 text-slate-400 border border-slate-100"
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-obsidian">
              {webhookConnected ? "Continuous Auto-Tracking Active" : "Continuous Codebase Intelligence"}
            </p>
            <p className="text-xs text-ash leading-snug">
              {webhookConnected
                ? "Trixon will automatically trigger a new analysis on every commit push to your main branch."
                : "Connect a webhook to automatically trigger analysis on every git push."}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleWebhook}
          disabled={webhookLoading}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
            webhookConnected
              ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              : "border-zinc-300 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400"
          }`}
        >
          {webhookLoading ? "Updating..." : webhookConnected ? "Disable tracking" : "Connect auto-tracking"}
        </button>
      </div>

      {/* Reanalyse feedback */}
      {reanalyseError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {reanalyseError}
        </div>
      )}
      {reanalyseSuccess && (
        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-zinc-600" />
          Re-analysis started! Loading progress tracker…
        </div>
      )}

      {/* Main page content */}
      <div className="animate-in fade-in duration-300">{children}</div>
    </div>
  );
}
