"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { ScopingModal } from "@/components/scoping-modal";

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

export function StickyEngageBar() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* Desktop: sticky bottom bar */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-paper-raised/95 backdrop-blur border-t border-paper-sunken print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="text-[13px] text-ash">
            Issues found? Trixon can fix them.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/engage"
              className="text-sm text-ash hover:text-obsidian transition-colors"
            >
              How Trixon works →
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-zinc-900 text-paper-raised px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              Book a free call →
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: card at bottom of content */}
      <div className="md:hidden bg-paper-raised border border-paper-sunken rounded-xl p-5 mt-8 print:hidden">
        <p className="text-[13px] text-ash mb-3">
          Issues found? Trixon can fix them.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            Book a free call →
          </button>
          <Link
            href="/engage"
            className="text-center text-sm text-ash hover:text-obsidian transition-colors py-1"
          >
            How Trixon works →
          </Link>
        </div>
      </div>

      {showModal && (
        <ScopingModal
          bookingUrl={BOOKING_URL}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
