"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface DeleteProjectProps {
  projectId: string;
  token: string;
}

export function DeleteProject({ projectId, token }: DeleteProjectProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await api.deleteProject(token, projectId);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (error) {
    return (
      <span className="text-xs text-red-500">{error}</span>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        confirming
          ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
          : "text-ash hover:text-red-500 hover:bg-red-50"
      }`}
    >
      {deleting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
      {confirming ? "Confirm delete" : "Remove"}
    </button>
  );
}
