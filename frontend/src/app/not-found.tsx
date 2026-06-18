"use client";

import Link from "next/link";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F4F4] flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Visual */}
        <div className="relative mb-8 mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-2xl bg-white border border-[#e0dada] flex items-center justify-center">
            <FileQuestion className="w-10 h-10 text-[#e0dada]" />
          </div>
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#18181b] flex items-center justify-center text-white text-xs font-bold">
            404
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1e1b1b] mb-3">
          Page not found
        </h1>
        <p className="text-[#837e80] text-sm leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          If you were expecting a report, the analysis may still be running.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[#18181b] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#27272a] transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 border border-[#e0dada] text-[#1e1b1b] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
