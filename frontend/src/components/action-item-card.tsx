"use client";

import { useState } from "react";
import { Shield, Wrench, Zap, CheckCircle2, Circle, Clock, Copy, Check, Loader2 } from "lucide-react";
import { api, type ActionItem } from "@/lib/api";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const EFFORT_COLORS: Record<string, string> = {
  "quick-win": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "moderate": "bg-blue-100 text-blue-700 border-blue-200",
  "complex": "bg-purple-100 text-purple-700 border-purple-200",
  "architectural": "bg-rose-100 text-rose-700 border-rose-200",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  tech_debt: Wrench,
  scalability: Zap,
};

const CATEGORY_LABELS: Record<string, string> = {
  security: "Security",
  tech_debt: "Tech Debt",
  scalability: "Scalability",
  quality: "Quality",
  docs: "Docs",
};

interface ActionItemCardProps {
  item: ActionItem;
  onStatusChange: (id: string, status: ActionItem["status"]) => void;
}

export function ActionItemCard({ item, onStatusChange }: ActionItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[item.category] || Wrench;

  const handleCopyPrompt = async () => {
    if (!item.ai_prompt) return;
    await navigator.clipboard.writeText(item.ai_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatus = async (status: ActionItem["status"]) => {
    setUpdating(true);
    try {
      await onStatusChange(item.id, status);
    } finally {
      setUpdating(false);
    }
  };

  const age = item.first_detected_at
    ? Math.floor((Date.now() - new Date(item.first_detected_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5 hover:shadow-sm transition-shadow group">
      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className="w-9 h-9 rounded-lg bg-paper-sunken flex items-center justify-center flex-shrink-0 mt-0.5">
          <CategoryIcon className="w-4 h-4 text-obsidian" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.medium}`}>
              {item.severity}
            </span>
            {item.effort_level && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${EFFORT_COLORS[item.effort_level] || ""}`}>
                {item.effort_level}
              </span>
            )}
            <span className="text-[10px] text-ash">
              {CATEGORY_LABELS[item.category] || item.category}
            </span>
            {age !== null && (
              <span className="text-[10px] text-ash flex items-center gap-0.5 ml-auto">
                <Clock className="w-3 h-3" />
                {age === 0 ? "today" : `${age}d ago`}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-obsidian mb-1 leading-snug">
            {item.title}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-ash leading-relaxed mb-3 line-clamp-2">
              {item.description}
            </p>
          )}

          {/* File paths */}
          {item.file_paths && item.file_paths.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.file_paths.slice(0, 3).map((fp) => (
                <span key={fp} className="text-[10px] font-mono bg-paper-sunken text-[#5a5458] px-2 py-0.5 rounded">
                  {fp.split("/").slice(-2).join("/")}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.ai_prompt && (
              <button
                onClick={handleCopyPrompt}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${
                  copied
                    ? "bg-zinc-900 text-paper-raised border-zinc-900"
                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border-zinc-200/50"
                }`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy AI Prompt"}
              </button>
            )}

            {item.status === "open" && (
              <>
                <button
                  onClick={() => handleStatus("in_progress")}
                  disabled={updating}
                  className="flex items-center gap-1 text-xs text-ash hover:text-obsidian px-2 py-1.5 rounded-lg hover:bg-paper-sunken transition-all disabled:opacity-50"
                >
                  <Circle className="w-3 h-3" /> In Progress
                </button>
                <button
                  onClick={() => handleStatus("resolved")}
                  disabled={updating}
                  className="flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-900 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                </button>
                <button
                  onClick={() => handleStatus("ignored")}
                  disabled={updating}
                  className="text-xs text-ash/70 hover:text-ash px-2 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  Ignore
                </button>
              </>
            )}

            {item.status === "in_progress" && (
              <button
                onClick={() => handleStatus("resolved")}
                disabled={updating}
                className="flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-900 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-all"
              >
                <CheckCircle2 className="w-3 h-3" /> Mark Resolved
              </button>
            )}

            {item.status === "resolved" && (
              <button
                onClick={() => handleStatus("open")}
                disabled={updating}
                className="text-xs text-ash hover:text-obsidian px-2 py-1.5 rounded-lg hover:bg-paper-sunken transition-all"
              >
                Reopen
              </button>
            )}

            {updating && <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />}
          </div>
        </div>
      </div>
    </div>
  );
}
