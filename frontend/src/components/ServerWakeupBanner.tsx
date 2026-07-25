"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function ServerWakeupBanner() {
  const [slowRequestsCount, setSlowRequestsCount] = useState(0);

  useEffect(() => {
    const handleSlow = () => {
      setSlowRequestsCount((prev) => prev + 1);
    };
    const handleComplete = () => {
      setSlowRequestsCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener("api-slow-request", handleSlow);
    window.addEventListener("api-request-completed", handleComplete);

    return () => {
      window.removeEventListener("api-slow-request", handleSlow);
      window.removeEventListener("api-request-completed", handleComplete);
    };
  }, []);

  if (slowRequestsCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#1e1b1b] border border-white/10 text-white rounded-xl p-4 shadow-xl max-w-xs sm:max-w-sm flex gap-3 items-start backdrop-blur-md bg-opacity-95">
        <Loader2 className="w-5 h-5 text-[#039a85] animate-spin flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold font-display text-white">
            Backend Server Waking Up
          </h4>
          <p className="text-[11px] text-[#837e80] leading-normal">
            We host our free beta backend on Render. The server sleeps after 15 minutes of inactivity and can take 15-30 seconds to boot back up. Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
}
