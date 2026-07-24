"use client";

import { useState, useEffect } from "react";
import { X, Send, Loader2, CheckCircle, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ScopingModalProps {
  onClose: () => void;
  bookingUrl: string;
}

export function ScopingModal({ onClose, bookingUrl }: ScopingModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [referral, setReferral] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setEmail(session.user.email || "");
        if (session.user.user_metadata) {
          const meta = session.user.user_metadata;
          setName(meta.full_name || "");
          setCompany(meta.company_name || "");
          setRole(meta.role || "");
          setGoal(meta.primary_goal || "");
          setReferral(meta.referral_source || "");
        }
      }
    });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "scoping_call",
          name,
          email,
          company,
          message,
          role,
          primary_goal: goal,
          referral_source: referral,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to submit request" }));
        throw new Error(err.error || "Failed to submit request");
      }

      setSent(true);

      // Open Calendly/Cal.com in new tab after a brief delay
      setTimeout(() => {
        if (bookingUrl && bookingUrl !== "#") {
          window.open(bookingUrl, "_blank", "noopener,noreferrer");
        }
      }, 1000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="bg-paper-raised border border-paper-sunken rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95">
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
            <h2 className="text-xl font-bold text-obsidian mb-2">Request Sent!</h2>
            <p className="text-sm text-ash leading-relaxed mb-4">
              Your scoping details have been sent to Saqib. We are redirecting you to book a slot on our calendar now...
            </p>
            {bookingUrl && bookingUrl !== "#" ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#039a85] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#02816f] transition-all"
              >
                <Calendar className="w-4 h-4" />
                Go to calendar scheduler
              </a>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-zinc-900 text-paper-raised text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-obsidian pr-8">
                Book a free scoping call
              </h2>
              <p className="text-xs text-ash mt-1">
                Enter your details to share context with Saqib before booking your calendar slot.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scoping-name" className="block text-xs font-semibold text-obsidian">
                Your Name
              </label>
              <input
                id="scoping-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mohammed Saqib Junaid Khan"
                className="w-full px-3 py-2 border border-paper-sunken rounded-lg text-sm focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scoping-email" className="block text-xs font-semibold text-obsidian">
                Email Address
              </label>
              <input
                id="scoping-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 border border-paper-sunken rounded-lg text-sm focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scoping-company" className="block text-xs font-semibold text-obsidian">
                Company Name
              </label>
              <input
                id="scoping-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Trixon Inc."
                className="w-full px-3 py-2 border border-paper-sunken rounded-lg text-sm focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="scoping-message" className="block text-xs font-semibold text-obsidian">
                Briefly describe your app or current goals
              </label>
              <textarea
                id="scoping-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. built with Cursor, want to launch and hire devs..."
                rows={3}
                className="w-full px-3 py-2 border border-paper-sunken rounded-lg text-sm resize-none focus:outline-none focus:border-zinc-800"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-[#039a85] text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-[#02816f] transition-all disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending Details..." : "Proceed to Calendar Schedule →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
