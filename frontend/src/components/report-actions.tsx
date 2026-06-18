"use client";

import { useState } from "react";
import { Share, Download, Link as LinkIcon, Check, X, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { TrixonShareModal } from "@/components/trixon-share-modal";

export function ReportActions({ reportId, token, isShared, shareToken, analysisId }: { reportId: string, token: string, isShared: boolean, shareToken: string | null, analysisId?: string }) {
  const [sharing, setSharing] = useState(isShared);
  const [currentShareToken, setCurrentShareToken] = useState(shareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTrixonModal, setShowTrixonModal] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleToggleShare = async () => {
    try {
      setLoading(true);
      const newStatus = !sharing;
      const res = await api.toggleShare(token, reportId, newStatus);
      setSharing(newStatus);
      setCurrentShareToken(res.share_token);
    } catch (err) {
      alert("Failed to toggle sharing.");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = typeof window !== "undefined" && currentShareToken
    ? `${window.location.origin}/share/${currentShareToken}`
    : "";

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-paper-raised border border-paper-sunken rounded-lg text-sm font-medium text-obsidian hover:bg-paper-sunken transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleToggleShare}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sharing 
                ? "bg-zinc-100 text-zinc-900 border border-zinc-200 hover:bg-zinc-200" 
                : "bg-paper-raised border border-paper-sunken text-obsidian hover:bg-paper-sunken"
            }`}
          >
            <Share className="w-4 h-4" />
            {loading ? "..." : sharing ? "Shared" : "Share"}
          </button>
          {analysisId && (
            <button
              onClick={() => setShowTrixonModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-obsidian text-paper-raised rounded-lg text-sm font-medium hover:bg-[#333] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Send to Trixon
            </button>
          )}
        </div>
        
        {sharing && shareUrl && (
          <div className="bg-paper-raised border border-paper-sunken rounded-lg p-3 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="bg-paper-sunken px-3 py-1.5 rounded text-xs font-mono text-ash truncate max-w-[200px]">
              {shareUrl}
            </div>
            <button
              onClick={copyLink}
              className="p-1.5 hover:bg-paper-sunken rounded text-obsidian transition-colors"
              title="Copy link"
            >
              {copied ? <Check className="w-4 h-4 text-zinc-800" /> : <LinkIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleToggleShare}
              className="p-1.5 hover:bg-[#fee2e2] rounded text-red-500 transition-colors ml-2"
              title="Disable sharing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {showTrixonModal && analysisId && (
        <TrixonShareModal
          analysisId={analysisId}
          onClose={() => setShowTrixonModal(false)}
        />
      )}
    </>
  );
}
