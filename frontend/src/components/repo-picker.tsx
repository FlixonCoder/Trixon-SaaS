"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Lock,
  Globe,
  GitBranch,
  Calendar,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type { RepoItem } from "@/lib/api";

interface RepoPicker {
  repos: RepoItem[];
  onSelect: (repo: RepoItem) => void;
  isLoading?: boolean;
}

export function RepoPicker({ repos, onSelect, isLoading }: RepoPicker) {
  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, search]);

  const handleSelect = async (repo: RepoItem) => {
    setConnecting(repo.id);
    await onSelect(repo);
    setConnecting(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-ash">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading your repositories…</p>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="text-center py-12 text-ash">
        <p className="text-sm">No repositories found in your connected account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
        <input
          type="text"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-zinc-800/10 focus:border-zinc-800 transition-all"
        />
      </div>

      {/* Repo list */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-ash py-8">
            No repositories match "{search}"
          </p>
        ) : (
          filtered.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleSelect(repo)}
              disabled={connecting === repo.id}
              className="w-full flex items-center gap-3 p-3 text-left bg-paper-raised border border-paper-sunken rounded-xl hover:border-zinc-450 hover:border-zinc-400 hover:bg-zinc-50 transition-all group disabled:opacity-60"
            >
              <div className="flex-shrink-0">
                {repo.private ? (
                  <Lock className="w-4 h-4 text-ash" />
                ) : (
                  <Globe className="w-4 h-4 text-zinc-650 text-zinc-650 text-zinc-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-obsidian truncate">
                    {repo.full_name}
                  </span>
                  {repo.private && (
                    <span className="text-xs px-1.5 py-0.5 bg-paper-sunken text-ash rounded-full flex-shrink-0">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-ash truncate mt-0.5">
                    {repo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {repo.language && (
                    <span className="text-xs text-ash">{repo.language}</span>
                  )}
                  {repo.updated_at && (
                    <span className="flex items-center gap-1 text-xs text-ash">
                      <Calendar className="w-3 h-3" />
                      {new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-ash">
                    <GitBranch className="w-3 h-3" />
                    {repo.default_branch}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0">
                {connecting === repo.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-800" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-ash group-hover:text-zinc-800 transition-colors" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
