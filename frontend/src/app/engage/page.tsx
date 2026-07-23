"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Code2,
  FileText,
  Key,
  Users,
  Shield,
  Blocks,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScopingModal } from "@/components/scoping-modal";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

const PHASES = [
  {
    phase: "Phase 1",
    icon: Blocks,
    title: "We come in and design a scalable foundation",
    body: "We audit your codebase deeply, map what's blocking you, and design a technical architecture that can support 10× growth. You get a clear plan — what to build, what to fix, what to throw away.",
    timeline: "2–4 weeks",
    color: "#18181b",
  },
  {
    phase: "Phase 2",
    icon: Users,
    title: "We build the foundation and hire your team",
    body: "We implement the architectural plan and simultaneously recruit and onboard your internal engineering team. We manage them. We train them. We make sure they understand the codebase before we leave.",
    timeline: "4–12 weeks",
    color: "#3B82F6",
  },
  {
    phase: "Phase 3",
    icon: Key,
    title: "We hand over the keys and walk away",
    body: "We transfer full ownership: codebase, team, documentation, and hiring playbook. Trixon's job is to make itself unnecessary. By the time we leave, you own everything and need nobody.",
    timeline: "2–4 weeks",
    color: "#8B5CF6",
  },
];

const OWNERSHIP = [
  { icon: Code2, label: "Your IP", sublabel: "No agency lock-in" },
  { icon: Users, label: "Your team", sublabel: "Hired and trained" },
  {
    icon: FileText,
    label: "Your documentation",
    sublabel: "Every system documented",
  },
  {
    icon: Shield,
    label: "Your independence",
    sublabel: "No Trixon dependency",
  },
];

export default function EngagePage() {
  const [showScopingModal, setShowScopingModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F4F4]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1e1b1b] tracking-tight">
            What happens after the audit?
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#837e80] max-w-2xl mx-auto leading-relaxed">
            Trixon&apos;s Build-Operate-Transfer model — designed for founders
            who have something built but can&apos;t safely scale it.
          </p>
        </div>

        {/* Phase Cards */}
        <div className="space-y-6 mb-16">
          {PHASES.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.phase}
                className="bg-white rounded-2xl border border-[#e0dada] p-8 flex flex-col md:flex-row gap-6 items-start"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${phase.color}10` }}
                >
                  <Icon
                    className="w-7 h-7"
                    style={{ color: phase.color }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${phase.color}10`,
                        color: phase.color,
                      }}
                    >
                      {phase.phase}
                    </span>
                    <span className="text-xs text-[#837e80] font-medium">
                      {phase.timeline}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[#1e1b1b] mb-2">
                    {phase.title}
                  </h2>
                  <p className="text-sm text-[#837e80] leading-relaxed">
                    {phase.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* What You Own */}
        <div className="mb-16">
          <h2 className="text-xl font-bold text-[#1e1b1b] text-center mb-8">
            What you own at the end
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {OWNERSHIP.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-[#e0dada] p-5 text-center"
                >
                  <div className="w-10 h-10 bg-[#18181b]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-[#18181b]" />
                  </div>
                  <div className="font-semibold text-sm text-[#1e1b1b]">
                    {item.label}
                  </div>
                  <div className="text-xs text-[#837e80] mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#18181b] rounded-2xl p-8 sm:p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Book a free 30-minute scoping call
          </h2>
          <p className="text-white/80 text-sm max-w-xl mx-auto mb-6 leading-relaxed">
            We&apos;ll review your audit together and tell you exactly what a
            Trixon engagement would look like for your situation.
          </p>
          <button
            onClick={() => setShowScopingModal(true)}
            className="group inline-flex items-center gap-2 bg-white text-[#18181b] font-medium px-8 py-3.5 rounded-lg text-base hover:bg-white/90 transition-colors cursor-pointer mx-auto"
          >
            <Calendar className="w-4 h-4" />
            Book a free call
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </main>
      <Footer />

      {showScopingModal && (
        <ScopingModal
          bookingUrl={BOOKING_URL}
          onClose={() => setShowScopingModal(false)}
        />
      )}
    </div>
  );
}
