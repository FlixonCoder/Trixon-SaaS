"use client";

import { useState } from "react";
import Image from "next/image";
import { Circle } from "lucide-react";

type TabId = "dashboard" | "action-items" | "timeline" | "chat" | "reports" | "search";

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  url: string;
  src: string;
  caption: string;
}

const TABS: TabConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📄",
    url: "projects/my-app",
    src: "/assets/dashboard.png",
    caption: "Interactive project dashboard: Health score, timeline, and prioritized action items",
  },
  {
    id: "action-items",
    label: "Action Items",
    icon: "🎯",
    url: "projects/my-app/action-items",
    src: "/assets/action-items.png",
    caption: "Prioritized issues: Track and resolve technical debt, security risks, and bugs",
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: "📈",
    url: "projects/my-app/timeline",
    src: "/assets/timeline.png",
    caption: "Snapshot history: Visualize changes in codebase health over time",
  },
  {
    id: "chat",
    label: "AI Chat Advisor",
    icon: "💬",
    url: "projects/my-app/chat",
    src: "/assets/chatbot.png",
    caption: "AI Codebase Chat: Ask architectural questions, search files, and generate scripts",
  },
  {
    id: "reports",
    label: "Deep Dive Reports",
    icon: "📊",
    url: "projects/my-app/reports",
    src: "/assets/reports.png",
    caption: "Multi-dimension analysis: Executive, Security, Scalability, and Onboarding reports",
  },
  {
    id: "search",
    label: "Semantic Search",
    icon: "🔍",
    url: "projects/my-app/search",
    src: "/assets/search.png",
    caption: "Instant Codebase Search: Locate functions, models, and dependencies naturally",
  },
];

interface HeroScreenshotProps {
  caption?: string;
  label?: string;
}

export function HeroScreenshot({}: HeroScreenshotProps) {
  const [activeTabId, setActiveTabId] = useState<TabId>("dashboard");

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];

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
          <div className="flex items-end gap-0.5 ml-6 sm:ml-8 mr-auto h-9 overflow-x-auto scrollbar-none flex-nowrap pr-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] sm:text-xs font-semibold rounded-t-lg border-t border-x transition-all duration-200 cursor-pointer flex-shrink-0 ${
                  activeTabId === tab.id
                    ? "bg-[#161313] border-white/10 text-white shadow-[0_-2px_5px_rgba(0,0,0,0.2)]"
                    : "bg-transparent border-transparent text-[#837e80] hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{tab.icon} {tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Screenshot Container */}
        <div className="relative bg-[#161313] aspect-[1904/900] w-full overflow-hidden">
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 transition-all duration-500 ease-in-out transform ${
                activeTabId === tab.id
                  ? "opacity-100 scale-100 z-10"
                  : "opacity-0 scale-[0.98] z-0 pointer-events-none"
              }`}
            >
              <Image
                src={tab.src}
                alt={`Trixon ${tab.label} Preview`}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover object-top"
                priority={tab.id === "dashboard"}
              />
            </div>
          ))}

          {/* Floating Status Bar in bottom left */}
          <div className="absolute bottom-3 left-3 bg-[#111010]/85 backdrop-blur-sm border border-white/10 rounded px-2.5 py-1 text-[10px] font-mono text-[#837e80] z-20 pointer-events-none flex items-center gap-1.5 shadow-md">
            <div className="w-1.5 h-1.5 rounded-full bg-[#039a85] animate-pulse" />
            <span>app.trixon.cloud/{activeTab.url}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Caption */}
      <p className="text-center text-xs text-[#5a5458] mt-4 min-h-[16px] transition-all duration-300">
        {activeTab.caption}
      </p>
    </div>
  );
}
