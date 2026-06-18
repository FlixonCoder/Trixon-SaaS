"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

export function ExplainSimply({ text, reportId, token }: { text: string; reportId: string; token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExplain = async () => {
    if (explanation) {
      setIsOpen(true);
      return;
    }

    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await api.simplifyReport(token, reportId, text);
      setExplanation(res.simplified_text);
    } catch (err) {
      setError("Failed to generate explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative print:hidden">
      <button
        onClick={handleExplain}
        className="absolute -right-3 -top-3 w-8 h-8 bg-paper-raised border border-paper-sunken rounded-full shadow-sm flex items-center justify-center text-zinc-750 text-zinc-700 hover:bg-paper-sunken hover:scale-105 transition-all z-10"
        title="Explain simply"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-0 right-0 left-0 bottom-0 bg-paper-raised/95 backdrop-blur-sm z-20 rounded-xl border border-zinc-300 p-5 flex flex-col shadow-lg animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Simple Explanation
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-ash hover:text-obsidian">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-ash">
                <div className="w-4 h-4 rounded-full border-2 border-zinc-800 border-t-transparent animate-spin" />
                Thinking...
              </div>
            ) : error ? (
              <div className="text-sm text-red-500">{error}</div>
            ) : (
              <div className="text-sm text-obsidian leading-relaxed">
                {explanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
