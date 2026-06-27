"use client";

import { Lock, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

interface PaywallOverlayProps {
  projectId: string;
}

export function PaywallOverlay({ projectId }: PaywallOverlayProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/checkout/create-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ project_id: projectId }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.detail?.includes("already purchased")) {
          router.refresh();
          return;
        }
        throw new Error(err.detail || "Failed to start checkout");
      }

      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (e: any) {
      alert(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[8px] bg-paper-raised/40 z-10 rounded-2xl" />

      {/* Paywall card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
        <div className="bg-paper-raised rounded-2xl border border-paper-sunken shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-paper-sunken rounded-full flex items-center justify-center mx-auto mb-5 border border-paper-sunken">
            <Lock className="w-7 h-7 text-ash" />
          </div>
          <h2 className="text-lg font-bold text-obsidian mb-2">
            This report is part of the Full Audit
          </h2>
          <p className="text-sm text-ash leading-relaxed mb-2">
            Get all 8 reports including Investor Summary, Team Readiness, and
            detailed Tech Debt analysis.
          </p>
          <p className="text-2xl font-bold text-obsidian mb-6">
            $497{" "}
            <span className="text-sm font-normal text-ash">
              one-time, no subscription
            </span>
          </p>

          <button
            onClick={handleUnlock}
            disabled={loading}
            className="w-full bg-obsidian text-paper-raised px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#27272a] transition-colors disabled:opacity-50 mb-3"
          >
            {loading ? "Starting checkout..." : "Unlock full audit →"}
          </button>

          <p className="text-xs text-ash">
            Or{" "}
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-obsidian hover:underline"
            >
              book a call
            </a>{" "}
            and let us walk you through it
          </p>
        </div>
      </div>
    </div>
  );
}
