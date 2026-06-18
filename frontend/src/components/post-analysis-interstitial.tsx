"use client";

import Link from "next/link";
import { Calendar, ArrowRight, Send } from "lucide-react";
import { useState } from "react";
import { TrixonShareModal } from "@/components/trixon-share-modal";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

interface PostAnalysisInterstitialProps {
  healthScore: number;
  projectId: string;
  analysisId: string;
  keyFindings?: string[];
}

export function PostAnalysisInterstitial({
  healthScore,
  projectId,
  analysisId,
  keyFindings = [],
}: PostAnalysisInterstitialProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  // Determine ring color based on score
  const ringColor =
    healthScore >= 80
      ? "var(--color-obsidian)"
      : healthScore >= 60
        ? "var(--color-trixon-warning)"
        : "var(--color-trixon-danger)";

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (healthScore / 100) * circumference;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-paper-raised/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-lg w-full text-center py-8">
          {/* Health Score Ring */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--color-paper-sunken)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-bold"
                style={{ color: ringColor }}
              >
                {healthScore}
              </span>
              <span className="text-xs text-ash">/ 100</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-obsidian mb-3">
            Your audit is ready.
          </h1>

          {/* Key Findings */}
          {keyFindings.length > 0 && (
            <ul className="text-left bg-paper-sunken border border-paper-sunken rounded-xl p-5 mb-8 space-y-2">
              {keyFindings.slice(0, 3).map((finding, i) => (
                <li
                  key={i}
                  className="text-sm text-obsidian flex items-start gap-2"
                >
                  <span className="text-obsidian font-medium mt-0.5">
                    •
                  </span>
                  <span className="leading-relaxed">{finding}</span>
                </li>
              ))}
            </ul>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href={`/projects/${projectId}/reports`}
              className="group inline-flex items-center justify-center gap-2 bg-obsidian text-paper-raised font-medium px-6 py-3 rounded-lg text-sm hover:bg-[#27272a] transition-colors"
            >
              View your full audit
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-paper-sunken text-obsidian font-medium px-6 py-3 rounded-lg text-sm hover:bg-paper-raised transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Talk to Trixon about this
            </a>
          </div>

          {/* Share Link */}
          <button
            onClick={() => setShowShareModal(true)}
            className="text-xs text-ash hover:text-obsidian transition-colors inline-flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            Or send this audit to the Trixon team for a free 15-min readout
          </button>
        </div>
      </div>

      {showShareModal && (
        <TrixonShareModal
          analysisId={analysisId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}
