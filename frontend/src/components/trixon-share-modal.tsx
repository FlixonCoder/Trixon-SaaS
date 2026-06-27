"use client";

import { useState } from "react";
import { Send, X, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TrixonShareModalProps {
  analysisId: string;
  onClose: () => void;
}

export function TrixonShareModal({ analysisId, onClose }: TrixonShareModalProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/trixon-share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            analysis_id: analysisId,
            founder_message: message || null,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to send" }));
        throw new Error(err.detail || "Failed to send");
      }

      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-paper-raised rounded-2xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-paper-sunken rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-ash" />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-zinc-700" />
            </div>
            <h2 className="text-lg font-bold text-obsidian mb-2">Sent!</h2>
            <p className="text-sm text-ash leading-relaxed">
              Expect a reply within 24 hours. We review every submission
              personally.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-zinc-900 text-paper-raised text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-obsidian mb-1 pr-8">
              Send your audit to Trixon
            </h2>
            <p className="text-sm text-ash mb-5">
              We&apos;ll review your analysis and reach out within 24 hours.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything specific you'd like us to look at?"
              rows={4}
              className="w-full px-4 py-3 border border-paper-sunken rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-800/10 focus:border-zinc-800 placeholder:text-ash/60"
            />

            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={sending}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending..." : "Send →"}
            </button>

            <p className="text-xs text-ash text-center mt-3">
              No commitment. We&apos;ll tell you exactly what we see.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
