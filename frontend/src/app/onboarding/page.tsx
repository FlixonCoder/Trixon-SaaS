"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  GitBranch, 
  FolderGit2, 
  CheckCircle, 
  BarChart2,
  Check,
  Mail,
  Building2,
  Sparkles,
  UserCheck,
  TrendingUp,
  Terminal,
  Compass,
  Search,
  Share2,
  HelpCircle,
  MessageSquare,
  Shield,
  Lock,
  Globe,
  Play,
  Camera
} from "lucide-react";
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
  const [questionIndex, setQuestionIndex] = useState(initialStep === 2 ? 8 : 0);
  const [customRole, setCustomRole] = useState("");
  const [repoQuery, setRepoQuery] = useState("");
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
    referral_source: "",
  });
  const [userEmail, setUserEmail] = useState("");

  // Prefill email and details from existing user session & profile
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) return;

        setUserEmail(session.user.email || "");

        // Fetch DB profile to check if already completed
        const profile = await api.getProfile(session.access_token);
        const isProfileComplete = !!(profile.full_name && profile.company_name);

        setFormData({
          full_name: profile.full_name || "",
          company_name: profile.company_name || "",
          role: profile.role || "",
          primary_goal: profile.primary_goal || "",
          referral_source: session.user.user_metadata?.referral_source || "",
        });

        if (isProfileComplete && searchParams.get("step") !== "1") {
          if (searchParams.get("step") === "2") {
            setQuestionIndex(8);
          } else {
            setQuestionIndex(7);
          }
        }
      } catch (err) {
        console.error("Failed to load profile in onboarding:", err);
      }
    })();
  }, [supabase, searchParams]);

  const submitQuestionnaire = async (finalData = formData) => {
    setIsLoading(true);
    setPrimaryGoal(finalData.primary_goal);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // 1. Update user metadata in Supabase Auth (safe place for all custom metadata)
      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          full_name: finalData.full_name,
          company_name: finalData.company_name,
          role: finalData.role,
          primary_goal: finalData.primary_goal,
          referral_source: finalData.referral_source,
        }
      });
      if (metaError) {
        console.error("Failed to update user auth metadata:", metaError);
      }

      // 2. Save profile in DB (only columns present in the schema)
      const dbPayload = {
        full_name: finalData.full_name,
        company_name: finalData.company_name,
        role: finalData.role,
        primary_goal: finalData.primary_goal,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(dbPayload),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      setQuestionIndex(7);
    } catch (error) {
      console.error(error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (questionIndex === 0) {
      setQuestionIndex(1);
    } else if (questionIndex === 1) {
      if (!formData.full_name.trim()) return;
      setQuestionIndex(2);
    } else if (questionIndex === 2) {
      setQuestionIndex(3);
    } else if (questionIndex === 3) {
      if (!formData.company_name.trim()) return;
      setQuestionIndex(4);
    } else if (questionIndex === 4) {
      if (!formData.role) return;
      setQuestionIndex(5);
    } else if (questionIndex === 5) {
      if (!formData.primary_goal) return;
      setQuestionIndex(6);
    }
  };

  const handleBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(prev => prev - 1);
    }
  };

  // Load VCS connection state & repos when questionIndex >= 7
  useEffect(() => {
    if (questionIndex < 7) return;

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
  }, [questionIndex, searchParams, supabase]);

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
      setQuestionIndex(9);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (questionIndex === 1 && !formData.full_name.trim()) return;
      if (questionIndex === 3 && !formData.company_name.trim()) return;
      if (questionIndex === 4 && formData.role === "other" && !customRole.trim()) return;
      e.preventDefault();
      handleNext();
    }
  };

  const progressPercent = Math.round((questionIndex / 9) * 100);

  return (
    <div 
      className="h-screen w-full bg-[#0a0a0a] text-zinc-100 flex flex-col justify-between p-6 sm:p-12 font-sans relative overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Radial backgrounds */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#039a85]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />

      {/* Top Header & Progress */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10 py-2">
        <span className="text-sm tracking-[0.25em] text-zinc-300 font-mono font-bold uppercase select-none">
          ONBOARDING
        </span>
        <div />
      </div>

      {/* Slides */}
      <div className="w-full max-w-2xl mx-auto py-6 sm:py-8 flex-1 flex flex-col justify-center z-10">
        {questionIndex === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="inline-flex items-center gap-2 bg-[#039a85]/10 border border-[#039a85]/20 text-[#039a85] text-xs font-semibold px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Zero configuration required</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight font-display">
              Welcome to Trixon.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
              Let&apos;s personalize your experience to get you actionable codebase intelligence. We&apos;ll configure your workspace in under 60 seconds.
            </p>
            <div className="pt-4 flex items-center gap-4">
              <button
                onClick={handleNext}
                className="bg-white text-zinc-950 hover:bg-zinc-100 px-8 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] shadow-lg shadow-white/5 active:scale-[0.98]"
              >
                Let&apos;s get started
              </button>
              <span className="hidden sm:inline text-xs text-zinc-500 font-mono">
                press <kbd className="bg-zinc-900 px-1.5 py-1 rounded border border-zinc-800">Enter ↵</kbd>
              </span>
            </div>
          </div>
        )}

        {questionIndex === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">01 / Profile Name</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              First, what should we call you?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Your name helps us personalize notifications, emails, and scoping reports.
            </p>
            <div className="relative pt-2">
              <input
                type="text"
                autoFocus
                required
                placeholder="Jane Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-transparent text-white border-b-2 border-zinc-800 focus:border-[#039a85] py-4 text-2xl sm:text-3xl focus:outline-none transition-all placeholder-zinc-700 font-medium"
              />
            </div>
            <div className="pt-4 flex items-center gap-4">
              <button
                onClick={handleNext}
                disabled={!formData.full_name.trim()}
                className="bg-white text-zinc-950 disabled:opacity-50 disabled:pointer-events-none hover:bg-zinc-100 px-6 py-3 rounded-lg font-bold text-sm transition-all"
              >
                Continue
              </button>
              <span className="hidden sm:inline text-xs text-zinc-500 font-mono">
                press <kbd className="bg-zinc-900 px-1.5 py-1 rounded border border-zinc-800">Enter ↵</kbd>
              </span>
            </div>
          </div>
        )}

        {questionIndex === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">02 / Email Verification</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              Is your email address correct?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              We will use this address to send your scoping summaries, timeline updates, and reports.
            </p>
            <div className="relative pt-2">
              <div className="flex items-center gap-2 border-b-2 border-zinc-900 py-4">
                <Mail className="w-5 h-5 text-zinc-600" />
                <input
                  type="email"
                  readOnly
                  autoFocus
                  value={userEmail}
                  className="w-full bg-transparent text-zinc-400 text-2xl sm:text-3xl focus:outline-none select-none font-medium"
                />
              </div>
            </div>
            <div className="pt-4 flex items-center gap-4">
              <button
                onClick={handleNext}
                className="bg-white text-zinc-950 hover:bg-zinc-100 px-6 py-3 rounded-lg font-bold text-sm transition-all"
              >
                Verify &amp; Continue
              </button>
              <span className="hidden sm:inline text-xs text-zinc-500 font-mono">
                press <kbd className="bg-zinc-900 px-1.5 py-1 rounded border border-zinc-800">Enter ↵</kbd>
              </span>
            </div>
          </div>
        )}

        {questionIndex === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">03 / Company context</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              What is your company or project name?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Your connected code repositories will be organized under this project context.
            </p>
            <div className="relative pt-2">
              <input
                type="text"
                autoFocus
                required
                placeholder="Acme Corp"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full bg-transparent text-white border-b-2 border-zinc-800 focus:border-[#039a85] py-4 text-2xl sm:text-3xl focus:outline-none transition-all placeholder-zinc-700 font-medium"
              />
            </div>
            <div className="pt-4 flex items-center gap-4">
              <button
                onClick={handleNext}
                disabled={!formData.company_name.trim()}
                className="bg-white text-zinc-950 disabled:opacity-50 disabled:pointer-events-none hover:bg-zinc-100 px-6 py-3 rounded-lg font-bold text-sm transition-all"
              >
                Continue
              </button>
              <span className="hidden sm:inline text-xs text-zinc-500 font-mono">
                press <kbd className="bg-zinc-900 px-1.5 py-1 rounded border border-zinc-800">Enter ↵</kbd>
              </span>
            </div>
          </div>
        )}

        {questionIndex === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">04 / Company Role</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              What is your role at {formData.company_name || "your company"}?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Select your role to help customize your repository insights dashboard.
            </p>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { id: "founder", title: "Founder / Co-founder", desc: "Product vision and quick scaling.", icon: UserCheck },
                { id: "investor", title: "Investor / VC Partner", desc: "Code due diligence evaluation.", icon: TrendingUp },
                { id: "agency", title: "Developer / Team Agency", desc: "Code delivery and team lead.", icon: Terminal },
                { id: "other", title: "Other / Custom Role", desc: "Specify your custom role below.", icon: HelpCircle }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = formData.role === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      const updated = { ...formData, role: item.id };
                      setFormData(updated);
                      if (item.id !== "other") {
                        setTimeout(() => setQuestionIndex(5), 220);
                      }
                    }}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? "bg-zinc-900 border-[#039a85] ring-1 ring-[#039a85]" 
                        : "bg-zinc-950 border-zinc-900 hover:border-zinc-700/60"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-[#039a85]/10 text-[#039a85]" : "bg-zinc-900 text-zinc-400"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {formData.role === "other" && (
              <div className="pt-4 animate-in fade-in duration-300 space-y-2">
                <label className="block text-xs font-semibold text-[#039a85] uppercase tracking-wider font-mono">
                  Please specify your role
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. CTO, Product Manager, Product Designer"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full bg-transparent text-white border-b-2 border-zinc-800 focus:border-[#039a85] py-2 text-lg focus:outline-none transition-all placeholder-zinc-700"
                />
              </div>
            )}
          </div>
        )}

        {questionIndex === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">05 / Main Objective</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              What will you use Trixon for?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              We will prioritize analysis metrics and timeline tracking based on this goal.
            </p>
            
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              {[
                { id: "prepare_investors", title: "Prepare for investors / technical due diligence", icon: TrendingUp },
                { id: "prepare_hire", title: "Prepare to onboard / hire developers", icon: UserCheck },
                { id: "enterprise_security", title: "Audit codebase security & exposed variables", icon: Shield },
                { id: "recover_agency", title: "Review code quality delivered by an agency", icon: FolderGit2 },
                { id: "general_audit", title: "General audit / peace of mind", icon: Sparkles }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = formData.primary_goal === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      const updated = { ...formData, primary_goal: item.id };
                      setFormData(updated);
                      setTimeout(() => setQuestionIndex(6), 220);
                    }}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? "bg-zinc-900 border-[#039a85] ring-1 ring-[#039a85]" 
                        : "bg-zinc-950 border-zinc-900 hover:border-zinc-700/60"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-[#039a85]/10 text-[#039a85]" : "bg-zinc-900 text-zinc-400"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-sm font-semibold text-white flex-1">{item.title}</div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-[#039a85] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {questionIndex === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">06 / Acquisition Source</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              Where did you hear about Trixon?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              We are founder-led and grow primarily by word of mouth. Let us know how you found us.
            </p>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { id: "Google Search", title: "Google Search", icon: Search },
                { id: "Twitter/X", title: "Twitter / X", icon: Compass },
                { id: "LinkedIn", title: "LinkedIn", icon: Share2 },
                { id: "Instagram", title: "Instagram", icon: Camera },
                { id: "YouTube", title: "YouTube", icon: Play },
                { id: "Word of Mouth", title: "Friend / Colleague", icon: MessageSquare },
                { id: "Other", title: "Other", icon: HelpCircle }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = formData.referral_source === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={async () => {
                      const updated = { ...formData, referral_source: item.id };
                      setFormData(updated);
                      
                      const submissionData = {
                        ...updated,
                        role: updated.role === "other" ? (customRole || "other") : updated.role
                      };
                      await submitQuestionnaire(submissionData);
                    }}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${
                      isSelected 
                        ? "bg-zinc-900 border-[#039a85] ring-1 ring-[#039a85]" 
                        : "bg-zinc-950 border-zinc-900 hover:border-zinc-700/60"
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-zinc-900 ${isSelected ? "text-[#039a85]" : "text-zinc-400"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-sm font-semibold text-white flex-1">{item.title}</div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-[#039a85] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {questionIndex === 7 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">07 / Connect Repository</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              Connect your repository provider.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Trixon requires read-only access to analyze your structure. We never modify your code.
            </p>
            
            {checkingVCS ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#039a85] mb-4" />
                <p className="text-sm text-zinc-500">Verifying connection status...</p>
              </div>
            ) : connected ? (
              <div className="space-y-4 py-4 animate-in fade-in duration-500">
                <div className="flex items-center gap-3.5 p-4 rounded-xl border border-[#039a85]/30 bg-[#039a85]/5">
                  <Check className="w-5 h-5 text-[#039a85] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">GitHub connected successfully</div>
                    <p className="text-xs text-zinc-400">Ready to select repository</p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setQuestionIndex(8)}
                    className="bg-white text-zinc-950 hover:bg-zinc-100 px-6 py-3 rounded-lg font-bold text-sm transition-all"
                  >
                    Select Repository
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConnectGitHub}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border border-zinc-900 bg-zinc-950 hover:border-zinc-700/60 text-left transition-all group"
                >
                  <div className="p-3 rounded-lg bg-zinc-900 text-white group-hover:scale-105 transition-transform">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">Connect GitHub</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Link personal or organization account</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                </button>

                <div className="text-center pt-6">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    I&apos;ll do this later (Go to Dashboard)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {questionIndex === 8 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">08 / Select Repository</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              Which repository should we analyze?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Choose the primary codebase you want to evaluate. We will fetch its branch details.
            </p>

            {limitReached ? (
              <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950 text-center">
                <h3 className="text-lg font-bold text-white mb-2">Free Tier Limit Reached</h3>
                <p className="text-xs text-zinc-500 mb-6">
                  You have reached the limit of 2 connected repositories on the free tier. Upgrade to Pro to connect unlimited repositories.
                </p>
                <button
                  onClick={() => router.push("/pricing")}
                  className="bg-white text-zinc-950 hover:bg-zinc-100 px-6 py-3 rounded-lg font-bold text-sm transition-all"
                >
                  Upgrade to Pro
                </button>
              </div>
            ) : reposLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#039a85]" />
                <p className="text-sm">Fetching repository list from GitHub…</p>
              </div>
            ) : repos.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p className="text-sm">No repositories found in your account.</p>
                <button
                  onClick={() => setQuestionIndex(7)}
                  className="mt-4 text-xs text-[#039a85] hover:underline"
                >
                  Reconnect or try another account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={repoQuery}
                    onChange={(e) => setRepoQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white focus:outline-none focus:border-[#039a85] focus:ring-1 focus:ring-[#039a85] transition-all"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-850">
                  {repos
                    .filter(r => 
                      r.name.toLowerCase().includes(repoQuery.toLowerCase()) || 
                      (r.description && r.description.toLowerCase().includes(repoQuery.toLowerCase()))
                    )
                    .map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        className="w-full flex items-center gap-3 p-3 text-left bg-zinc-950 border border-zinc-900 rounded-xl hover:border-[#039a85]/55 hover:bg-zinc-900/40 transition-all group"
                      >
                        <div className="flex-shrink-0">
                          {repo.private ? (
                            <Lock className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white truncate">
                              {repo.full_name}
                            </span>
                            {repo.private && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-zinc-400 rounded-full border border-zinc-800">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-zinc-500 truncate mt-0.5">{repo.description}</p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {questionIndex === 9 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="text-xs text-[#039a85] font-mono tracking-widest uppercase">09 / Report Configuration</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight animate-fade-in">
              What should Trixon evaluate?
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Select the reports you want to generate. You can always change these configurations later.
            </p>

            {catalogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#039a85]" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-850">
                {catalog.map((item) => {
                  const checked = selectedReports.includes(item.id);
                  const isRecommended = item.is_recommended;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        checked
                          ? "border-[#039a85] bg-[#039a85]/5"
                          : "border-zinc-900 bg-zinc-950 hover:border-zinc-700/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleReport(item.id)}
                        className="mt-0.5 accent-[#039a85] w-4 h-4 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">{item.title}</span>
                          {isRecommended && (
                            <span className="text-[10px] font-mono text-[#039a85] bg-[#039a85]/10 border border-[#039a85]/20 px-1.5 py-0.2 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">{item.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Estimate & Button */}
            <div className="space-y-4 pt-2">
              {selectedReports.length > 0 && (
                <p className="text-xs text-zinc-500 text-center">
                  {selectedReports.length} reports selected · ~{estimatedTokens.toLocaleString()} tokens
                </p>
              )}

              <button
                onClick={handleRunAnalysis}
                disabled={isLoading || selectedReports.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-100 disabled:opacity-50 disabled:pointer-events-none px-6 py-4 rounded-xl font-bold text-sm transition-all"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <BarChart2 className="w-4 h-4" />
                    Run Analysis &amp; Launch
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between border-t border-zinc-900/60 pt-6 z-10">
        <div>
          {questionIndex > 0 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-6">
          {questionIndex > 0 && (
            <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
              <span>{questionIndex} / 9</span>
              <div className="w-20 sm:w-28 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#039a85] to-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Setting up workspace...
              </div>
            ) : questionIndex > 0 && questionIndex < 7 ? (
              <button
                onClick={handleNext}
                disabled={
                  (questionIndex === 1 && !formData.full_name.trim()) ||
                  (questionIndex === 3 && !formData.company_name.trim()) ||
                  (questionIndex === 4 && formData.role === "other" && !customRole.trim())
                }
                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : questionIndex === 7 && connected ? (
              <button
                onClick={() => setQuestionIndex(8)}
                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 animate-spin text-[#039a85]" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
