"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowRight, GitBranch, FolderGit2, CheckCircle, BarChart2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type RepoItem, type CatalogItem } from "@/lib/api";
import { RepoPicker } from "@/components/repo-picker";

type OnboardingStep = 1 | 2 | 3;

// Maps primary_goal values to best_for keywords for highlighting
const GOAL_BEST_FOR_MAP: Record<string, string[]> = {
  prepare_investors: ["Raising a round", "Everyone"],
  prepare_hire: ["Hiring devs", "Everyone"],
  enterprise_security: ["Pre-launch, enterprise questions", "Everyone"],
  recover_agency: ["Everyone"],
  general_audit: ["Everyone"],
};

function OnboardingContent() {
  const searchParams = useSearchParams();
  const initialStep = searchParams.get("step") === "2" ? 2 : 1;

  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [connectedPlatform, setConnectedPlatform] = useState<"github" | "gitlab" | null>(null);
  const [vcsConnectionId, setVcsConnectionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [checkingVCS, setCheckingVCS] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  // Step 3: Report catalog
  const [pendingProject, setPendingProject] = useState<{ id: string } | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState<string>("");
  const router = useRouter();
  const supabase = createClient();

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    role: "",
    primary_goal: "",
  });

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPrimaryGoal(formData.primary_goal);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      setStep(2);
    } catch (error) {
      console.error(error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load VCS connection state & repos when on step 2
  useEffect(() => {
    if (step !== 2) return;

    const loadVcsState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const urlVcsId = searchParams.get("vcs_id");
      const urlPlatform = searchParams.get("platform");

      // Check limits before proceeding
      try {
        const profile = await api.getProfile(session.access_token).catch(() => null);
        const isFree = process.env.NEXT_PUBLIC_BETA_MODE === "true" ? false : (profile?.plan === "free" || !profile?.plan);
        if (isFree) {
          const userProjects = await api.listProjects(session.access_token);
          if (userProjects.length >= 2) {
            setLimitReached(true);
            return; // Stop loading VCS or repos if limit reached
          }
        }
      } catch (err) {
        console.error("Failed to check limits:", err);
      }

      if (urlVcsId && urlPlatform) {
        setVcsConnectionId(urlVcsId);
        setConnectedPlatform(urlPlatform as "github" | "gitlab");
        setConnected(true);
        loadRepos(urlPlatform as "github" | "gitlab", session.access_token);
        return;
      }

      // Check if they already have a VCS connection
      try {
        const connections = await api.listVcsConnections(session.access_token);
        // Check connections

        if (connections && connections.length > 0) {
          // Sort to get the latest connection
          const latest = [...connections].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          setVcsConnectionId(latest.id);
          setConnectedPlatform(latest.platform as "github" | "gitlab");
          setConnected(true);
          loadRepos(latest.platform as "github" | "gitlab", session.access_token);
        } else {
          console.warn("No VCS connection found for user:", session.user.id);
        }
      } catch (err) {
        console.error("Failed to query VCS connections:", err);
      }
      
      setCheckingVCS(false);
    };

    loadVcsState();
  }, [step, searchParams]);

  const loadRepos = async (platform: "github" | "gitlab", token: string) => {
    setReposLoading(true);
    try {
      const list = platform === "github"
        ? await api.listGithubRepos(token)
        : await api.listGitlabRepos(token);
      setRepos(list);
    } catch (err: any) {
      console.error("Failed to load repos:", err);
      if (err.message?.includes("expired or revoked") || err.message?.includes("Unauthorized") || err.message?.includes("API error 400")) {
        // Token is invalid, force reconnect
        setConnected(false);
        setVcsConnectionId(null);
        setConnectedPlatform(null);
        alert("Your connection has expired or is invalid. Please reconnect your repository.");
      }
    } finally {
      setReposLoading(false);
    }
  };

  const handleConnectGitHub = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback/github`;
    const scope = "repo,read:user";
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  const handleSelectRepo = async (repo: RepoItem) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !vcsConnectionId) return;

    try {
      const project = await api.createProject(session.access_token, {
        vcs_connection_id: vcsConnectionId,
        repo_id: repo.id,
        repo_name: repo.full_name,
        repo_url: repo.url,
        platform: repo.platform,
        default_branch: repo.default_branch,
      });

      // Go to Step 3: Report Catalog before triggering analysis
      setPendingProject({ id: project.id });
      setCatalogLoading(true);
      setStep(3);

      // Load the catalog
      try {
        const catalogRes = await api.getReportCatalog(session.access_token);
        setCatalog(catalogRes.catalog);
        // Pre-select defaults
        setSelectedReports(
          catalogRes.catalog
            .filter(item => item.is_default)
            .map(item => item.id)
        );
      } catch (e) {
        console.error("Failed to load catalog:", e);
        // Fallback to defaults
        setSelectedReports(["executive_summary", "architecture", "tech_debt"]);
      } finally {
        setCatalogLoading(false);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("already connected")) {
        alert("This repository is already connected.");
      } else {
        alert("Failed to connect repository. Please try again.");
      }
    }
  };

  const handleRunAnalysis = async () => {
    if (!pendingProject) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsLoading(true);
    try {
      await api.triggerAnalysisWithSelectedReports(
        session.access_token,
        pendingProject.id,
        selectedReports,
      );
      router.push(`/projects/${pendingProject.id}?analyzing=true`);
    } catch (err) {
      console.error(err);
      alert("Failed to start analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReport = (id: string) => {
    setSelectedReports(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const estimatedTokens = catalog
    .filter(item => selectedReports.includes(item.id))
    .reduce((sum, item) => sum + item.estimated_tokens, 0);
  const estimatedMinutes = Math.ceil((selectedReports.length * 60) / 60);

  return (
    <div className="min-h-screen bg-paper-sunken flex flex-col">
      {/* Header */}
      <header className="bg-paper-raised border-b border-paper-sunken px-6 py-4 flex items-center justify-between">
        <Image
          src="/light-logo.png"
          alt="Trixon"
          width={100}
          height={26}
          className="h-6 w-auto object-contain"
        />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-obsidian" : "bg-paper-sunken"}`} />
          <div className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-obsidian" : "bg-paper-sunken"}`} />
          <div className={`w-2 h-2 rounded-full ${step >= 3 ? "bg-obsidian" : "bg-paper-sunken"}`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="w-full max-w-md">
          {step === 1 ? (
            <div className="bg-paper-raised rounded-2xl shadow-sm border border-paper-sunken p-8">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-obsidian mb-2">Welcome to Trixon</h1>
                <p className="text-ash text-sm">
                  Let's personalise your experience to give you the best insights.
                </p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-obsidian">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm"
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-obsidian">Company Name</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm"
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-obsidian">Your Role</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm appearance-none"
                  >
                    <option value="" disabled>Select a role…</option>
                    <option value="founder">Founder / Co-founder</option>
                    <option value="agency">Development Agency</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-obsidian">Primary Goal</label>
                  <select
                    required
                    value={formData.primary_goal}
                    onChange={(e) => setFormData({ ...formData, primary_goal: e.target.value })}
                    className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm appearance-none"
                  >
                    <option value="" disabled>What are you looking to do?</option>
                    <option value="prepare_investors">Prepare for investors / due diligence</option>
                    <option value="prepare_hire">Prepare to hire developers</option>
                    <option value="enterprise_security">Answer an enterprise security question</option>
                    <option value="recover_agency">Recover from an agency codebase</option>
                    <option value="general_audit">General audit / peace of mind</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-obsidian text-paper-raised px-4 py-3 rounded-lg font-medium hover:bg-[#27272a] transition-all hover:shadow-lg hover:shadow-obsidian/20 disabled:opacity-70 mt-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Continue <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              {/* Step 2a: Connect VCS */}
              {!connected && !limitReached && (
                <div className="bg-paper-raised rounded-2xl shadow-sm border border-paper-sunken p-8">
                  {checkingVCS ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-obsidian mb-4" />
                      <p className="text-sm text-ash">Checking connection...</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-8">
                        <h1 className="text-2xl font-bold text-obsidian mb-2">Connect Repository</h1>
                        <p className="text-ash text-sm">
                          Connect your GitHub or GitLab account to let Trixon read your code.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={handleConnectGitHub}
                          className="w-full flex items-center gap-4 p-4 border border-paper-sunken rounded-xl hover:border-[#1e1b1b] hover:bg-paper-sunken transition-all group"
                        >
                          <div className="w-10 h-10 rounded-full bg-obsidian text-paper-raised flex items-center justify-center group-hover:scale-110 transition-transform">
                            <GitBranch className="w-5 h-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-medium text-obsidian">GitHub</h3>
                            <p className="text-xs text-ash">Connect personal or org account</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-ash group-hover:text-obsidian transition-colors" />
                        </button>

                        <button
                          disabled
                          className="w-full flex items-center gap-4 p-4 border border-paper-sunken rounded-xl transition-all opacity-60 cursor-not-allowed"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#FC6D26] text-paper-raised flex items-center justify-center">
                            <FolderGit2 className="w-5 h-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-medium text-obsidian">GitLab</h3>
                            <p className="text-xs text-ash">Connect self-hosted or cloud</p>
                          </div>
                          <span className="px-2 py-1 bg-paper-sunken text-ash text-[10px] font-semibold uppercase tracking-wider rounded-full">
                            Coming Soon
                          </span>
                        </button>
                      </div>

                      <div className="mt-8 text-center">
                        <button
                          onClick={() => router.push("/dashboard")}
                          className="text-sm font-medium text-ash hover:text-obsidian transition-colors"
                        >
                          I'll do this later
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2b: Connected — pick a repo */}
              {connected && !limitReached && (
                <div className="bg-paper-raised rounded-2xl shadow-sm border border-paper-sunken p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <CheckCircle className="w-5 h-5 text-obsidian" />
                    <span className="text-sm font-medium text-obsidian">
                      {connectedPlatform === "github" ? "GitHub" : "GitLab"} connected
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-obsidian mb-1">
                    Select a repository to analyse
                  </h2>
                  <p className="text-sm text-ash mb-5">
                    Trixon will fetch your code and generate 8 AI-powered reports.
                  </p>

                  <RepoPicker
                    repos={repos}
                    onSelect={handleSelectRepo}
                    isLoading={reposLoading}
                  />

                  <div className="mt-6 pt-4 border-t border-[#F6F4F4] text-center">
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="text-sm text-ash hover:text-obsidian transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2c: Limit Reached */}
              {limitReached && (
                <div className="bg-paper-raised rounded-2xl shadow-sm border border-paper-sunken p-8 text-center">
                  <div className="w-16 h-16 bg-paper-sunken rounded-full flex items-center justify-center mx-auto mb-6">
                    <FolderGit2 className="w-8 h-8 text-obsidian" />
                  </div>
                  <h2 className="text-2xl font-bold text-obsidian mb-2">Limit Reached</h2>
                  <p className="text-ash text-sm mb-8">
                    You have reached the limit of 2 connected repositories on the free tier. Upgrade to Pro to connect unlimited repositories.
                  </p>
                  <button
                    onClick={() => router.push("/pricing")}
                    className="w-full flex items-center justify-center bg-obsidian text-paper-raised px-4 py-3 rounded-lg font-medium hover:bg-[#333] transition-all"
                  >
                    Upgrade to Pro
                  </button>
                  <div className="mt-4">
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="text-sm font-medium text-ash hover:text-obsidian transition-colors"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─── Step 3: Report Catalog ─────────────────────── */
            <div className="bg-paper-raised rounded-2xl shadow-sm border border-paper-sunken p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-obsidian mb-2">What do you want Trixon to look at?</h1>
                <p className="text-ash text-sm">
                  Pick what's useful right now. You can always add others later — Trixon remembers your codebase.
                </p>
              </div>

              {catalogLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-obsidian" />
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {catalog.map(item => {
                    const checked = selectedReports.includes(item.id);
                    const isRecommended = item.is_recommended;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? "border-obsidian bg-obsidian/5"
                            : "border-paper-sunken hover:border-obsidian/50 hover:bg-paper-sunken"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReport(item.id)}
                          className="mt-0.5 accent-[#18181b] w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-obsidian">{item.title}</span>
                            {isRecommended && (
                              <span className="text-[10px] font-semibold text-obsidian bg-obsidian/10 px-1.5 py-0.5 rounded">
                                For you
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ash">{item.description}</p>
                        </div>
                        <span className="text-[10px] text-ash/70 flex-shrink-0 mt-0.5">
                          ~{item.estimated_tokens.toLocaleString()} tokens
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Footer estimate */}
              {selectedReports.length > 0 && (
                <p className="text-xs text-ash mb-4 text-center">
                  {selectedReports.length} reports selected · ~{estimatedTokens.toLocaleString()} tokens · approx {estimatedMinutes} min
                </p>
              )}

              <button
                onClick={handleRunAnalysis}
                disabled={isLoading || selectedReports.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-obsidian text-paper-raised px-4 py-3 rounded-lg font-medium hover:bg-[#27272a] transition-all hover:shadow-lg hover:shadow-obsidian/20 disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <><BarChart2 className="w-4 h-4" /> Run analysis →</>
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-sm text-ash hover:text-obsidian transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-paper-sunken">
        <Loader2 className="w-10 h-10 animate-spin text-obsidian" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
