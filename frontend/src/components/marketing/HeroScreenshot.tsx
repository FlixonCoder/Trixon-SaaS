"use client";

import { Monitor, Circle } from "lucide-react";

interface HeroScreenshotProps {
  caption?: string;
  label?: string;
}

export function HeroScreenshot({
  caption = "Trixon Dashboard — Health score, timeline, and action items at a glance",
  label = "Dashboard Preview",
}: HeroScreenshotProps) {
  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Outer glow */}
      <div className="absolute -inset-4 bg-gradient-to-b from-[#039a85]/10 via-[#039a85]/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      {/* Browser chrome frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
        {/* Browser top bar */}
        <div className="bg-[#1a1717] px-4 py-3 flex items-center gap-3 border-b border-white/5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <Circle className="w-3 h-3 fill-[#ff5f57] text-[#ff5f57]" />
            <Circle className="w-3 h-3 fill-[#febc2e] text-[#febc2e]" />
            <Circle className="w-3 h-3 fill-[#28c840] text-[#28c840]" />
          </div>

          {/* URL bar */}
          <div className="flex-1 max-w-xs mx-auto bg-[#111010] rounded-md px-3 py-1 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#039a85]/60 animate-pulse" />
            <span className="text-[11px] text-[#5a5458] font-mono truncate">
              app.trixon.cloud/dashboard
            </span>
          </div>

          {/* Window actions placeholder */}
          <Monitor className="w-4 h-4 text-[#3a3535] ml-auto" />
        </div>

        {/* Screenshot placeholder */}
        <div className="relative bg-[#161313] aspect-[16/9] flex items-center justify-center overflow-hidden">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(#039a85 1px, transparent 1px), linear-gradient(90deg, #039a85 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Placeholder content */}
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#039a85]/10 border border-[#039a85]/20 flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-8 h-8 text-[#039a85]/60" />
            </div>
            <p className="text-[#3a3535] text-sm font-medium">
              {label}
            </p>
            <p className="text-[#2a2626] text-xs mt-1">
              Screenshot coming soon
            </p>
          </div>

          {/* Decorative mock UI elements to make it feel alive */}
          {/* Sidebar mock */}
          <div className="absolute left-0 top-0 bottom-0 w-[200px] bg-[#111010] border-r border-white/5 opacity-40">
            <div className="p-4 space-y-3">
              <div className="h-6 w-24 bg-[#1e1b1b] rounded" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 rounded bg-[#1e1b1b] flex items-center px-3 gap-2">
                    <div className="w-3 h-3 rounded bg-[#2a2626]" />
                    <div className="h-2 flex-1 bg-[#2a2626] rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Health score badge mock */}
          <div className="absolute top-6 right-6 opacity-50">
            <div className="bg-[#039a85]/10 border border-[#039a85]/20 rounded-xl p-3 flex items-center gap-2">
              <div className="text-2xl font-bold text-[#039a85] font-mono">74</div>
              <div className="text-[10px] text-[#039a85]/60 leading-tight">Health<br/>Score</div>
            </div>
          </div>

          {/* Mini chart mock bottom-right */}
          <div className="absolute bottom-6 right-6 opacity-30">
            <div className="bg-[#1e1b1b] border border-white/5 rounded-lg p-3">
              <svg width="80" height="40" viewBox="0 0 80 40">
                <polyline
                  points="0,35 20,28 40,20 55,22 70,8 80,5"
                  fill="none"
                  stroke="#039a85"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-xs text-[#5a5458] mt-4">{caption}</p>
    </div>
  );
}
