"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export function VcsDisconnect({ connectionId, token }: { connectionId: string; token: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect this account?")) return;
    
    setLoading(true);
    try {
      await api.disconnectVcs(token, connectionId);
      router.refresh();
    } catch (err) {
      alert("Failed to disconnect VCS account.");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="p-2 text-ash hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
      title="Disconnect"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
