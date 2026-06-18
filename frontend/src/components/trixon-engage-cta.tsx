"use client";

import Link from "next/link";
import { Building, ArrowRight, Calendar, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

interface TrixonEngageCTAProps {
  healthScore: number;
  securityScore: number;
  scalabilityScore: number;
  qualityScore: number;
  docsScore: number;
}

type Variant = "critical" | "moderate" | "positive";

function getVariant(props: TrixonEngageCTAProps): Variant {
  const scores = [props.healthScore, props.securityScore, props.scalabilityScore, props.qualityScore, props.docsScore].filter(s => s != null);
  if (scores.some(s => s < 60)) return "critical";
  if (scores.every(s => s >= 80)) return "positive";
  return "moderate";
}

const VARIANT_CONFIG: Record<Variant, {
  heading: string;
  body: string;
  borderColor: string;
  bgColor: string;
  icon: React.ElementType;
  iconColor: string;
}> = {
  critical: {
    heading: "Critical issues that need a human to fix",
    body: "Your audit found high-severity problems that can't be patched with a checklist. Trixon specialises in exactly this — we come in, fix it, and build your team to own it.",
    borderColor: "border-red-200",
    bgColor: "bg-red-50/50",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  moderate: {
    heading: "Your codebase has real gaps before it can scale",
    body: "The audit found moderate issues that will become critical at your next growth stage. Trixon can close them before they close a deal for you.",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50/50",
    icon: AlertCircle,
    iconColor: "text-amber-500",
  },
  positive: {
    heading: "Solid foundation — now build the team to own it",
    body: "Your codebase is in good shape. The next challenge is building an internal engineering team that can maintain and scale it. That's Trixon's specialty.",
    borderColor: "border-zinc-200",
    bgColor: "bg-zinc-50/50",
    icon: CheckCircle,
    iconColor: "text-zinc-700",
  },
};

export function TrixonEngageCTA(props: TrixonEngageCTAProps) {
  const variant = getVariant(props);
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className={`rounded-2xl border ${config.borderColor} ${config.bgColor} p-6 sm:p-8`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 bg-paper-raised rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div>
            <h3 className="font-bold text-obsidian mb-1">{config.heading}</h3>
            <p className="text-sm text-ash leading-relaxed">{config.body}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0">
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Book a free call
          </a>
          <Link
            href="/engage"
            className="inline-flex items-center justify-center gap-2 border border-paper-sunken text-obsidian px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-paper-raised transition-colors"
          >
            Learn how Trixon works →
          </Link>
        </div>
      </div>
    </div>
  );
}
