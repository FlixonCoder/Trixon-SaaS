import type { Metadata } from "next";
import Link from "next/link";
import { Zap, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Trixon Audit — Pricing",
  description: "Pricing for Trixon is currently in beta. Enjoy free unlimited access.",
};

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

export default function PricingPage() {
  return (
    <div className="min-h-[80vh] bg-[#F6F4F4] flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-xl w-full bg-white border border-[#e0dada] rounded-2xl p-8 sm:p-10 text-center shadow-sm">
        {/* Logo/Icon container */}
        <div className="w-16 h-16 bg-[#18181b]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-[#18181b]" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[#1e1b1b] tracking-tight mb-4">
          Trixon Beta Access
        </h1>

        {/* Subtext */}
        <p className="text-[#837e80] text-sm sm:text-base leading-relaxed mb-8">
          Pricing for Trixon is currently being finalized. As we refine the product
          during our beta period, <span className="font-semibold text-[#1e1b1b]">unlimited access is completely free</span> for all registered testers.
        </p>

        {/* CTA Buttons */}
        <div className="space-y-4">
          <Link
            href="/onboarding?step=2"
            className="block w-full text-center bg-[#18181b] text-white px-6 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#27272a] hover:shadow-lg hover:shadow-[#18181b]/20 transition-all duration-200"
          >
            Connect Repository &amp; Start Audit
          </Link>
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full text-center border border-[#e0dada] text-[#1e1b1b] px-6 py-3.5 rounded-lg text-sm font-medium hover:bg-[#F6F4F4] transition-colors"
          >
            <Calendar className="w-4 h-4 text-[#837e80]" />
            Book a free readout call
          </a>
        </div>

        {/* Footer info */}
        <p className="text-xs text-[#c0baba] mt-6">
          No credit card required. You will be notified well in advance before the paid version launches.
        </p>
      </div>
    </div>
  );
}
