"use client";

import { useState } from "react";
import Image from "next/image";
import { Circle } from "lucide-react";

interface HeroScreenshotProps {
  caption?: string;
  label?: string;
}

export function HeroScreenshot({}: HeroScreenshotProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat">("dashboard");

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Outer glow */}
      <div className="absolute -inset-4 bg-gradient-to-b from-[#039a85]/10 via-[#039a85]/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      {/* Browser chrome frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-[#161313]">
        {/* Browser top bar */}
        <div className="bg-[#1a1717] px-4 pt-3 flex items-center justify-between border-b border-white/5 relative z-20">
          {/* Left: Traffic lights */}
          <div className="flex items-center gap-1.5 z-10 flex-shrink-0 mb-2">
            <Circle className="w-3 h-3 fill-[#ff5f57] text-[#ff5f57]" />
            <Circle className="w-3 h-3 fill-[#febc2e] text-[#febc2e]" />
            <Circle className="w-3 h-3 fill-[#28c840] text-[#28c840]" />
          </div>

          {/* Center: Interactive Tabs */}
          <div className="flex items-end gap-1 ml-6 sm:ml-8 mr-auto h-9">
            {/* Tab 1 */}
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-semibold rounded-t-lg border-t border-x transition-all duration-200 cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-[#161313] border-white/10 text-white shadow-[0_-2px_5px_rgba(0,0,0,0.2)]"
                  : "bg-transparent border-transparent text-[#837e80] hover:text-white hover:bg-white/5"
              }`}
            >
              <span>📄 Dashboard</span>
            </button>

            {/* Tab 2 */}
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-semibold rounded-t-lg border-t border-x transition-all duration-200 cursor-pointer ${
                activeTab === "chat"
                  ? "bg-[#161313] border-white/10 text-white shadow-[0_-2px_5px_rgba(0,0,0,0.2)]"
                  : "bg-transparent border-transparent text-[#837e80] hover:text-white hover:bg-white/5"
              }`}
            >
              <span>💬 AI Chat Advisor</span>
            </button>
          </div>

          {/* Right: Dynamic URL bar */}
          <div className="hidden md:flex items-center gap-2 bg-[#111010] rounded-md px-3 py-1.5 text-[10px] font-mono text-[#5a5458] border border-white/5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#039a85] animate-pulse" />
            <span>
              app.trixon.cloud/{activeTab === "dashboard" ? "projects/my-app" : "projects/my-app/chat"}
            </span>
          </div>
        </div>

        {/* Screenshot Container */}
        <div className="relative bg-[#161313] aspect-[1904/900] w-full overflow-hidden">
          {/* Tab 1: Dashboard View */}
          <div
            className={`absolute inset-0 transition-all duration-500 ease-in-out transform ${
              activeTab === "dashboard"
                ? "opacity-100 scale-100 z-10"
                : "opacity-0 scale-[0.98] z-0 pointer-events-none"
            }`}
          >
            <Image
              src="/assets/dashboard_pic1.png"
              alt="Trixon Project Dashboard Preview"
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover object-top"
              priority
            />
          </div>

          {/* Tab 2: Chat View */}
          <div
            className={`absolute inset-0 transition-all duration-500 ease-in-out transform ${
              activeTab === "chat"
                ? "opacity-100 scale-100 z-10"
                : "opacity-0 scale-[0.98] z-0 pointer-events-none"
            }`}
          >
            <Image
              src="/assets/dashboard_pic2.png"
              alt="Trixon AI Chat & Advisor Preview"
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Caption */}
      <p className="text-center text-xs text-[#5a5458] mt-4 transition-all duration-300">
        {activeTab === "dashboard"
          ? "Interactive project dashboard: Health score, timeline, and prioritized action items"
          : "AI Chat & Advisor: Converse directly with your codebase, search files, and apply suggestions"}
      </p>
    </div>
  );
}
