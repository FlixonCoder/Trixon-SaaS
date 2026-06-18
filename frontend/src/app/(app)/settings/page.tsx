import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderGit2,
  GitBranch,
  Settings as SettingsIcon,
  User,
  CreditCard,
  Activity,
  AlertCircle,
  Trash2,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { VcsDisconnect } from "@/components/vcs-disconnect";
import { DeleteProject } from "@/components/delete-project";

export const metadata = {
  title: "Settings — Trixon Audit",
  description: "Manage your account, connected repositories, and purchases.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Fetch VCS connections via API
  const connections = await api.listVcsConnections(session.access_token).catch(() => []);

  // Fetch profile via API
  const profile = await api.getProfile(session.access_token).catch(() => null);

  const isFreeTier = process.env.NEXT_PUBLIC_BETA_MODE === "true" ? false : (profile?.plan === "free" || !profile?.plan);

  // Fetch projects for this user
  let projects: Awaited<ReturnType<typeof api.listProjects>> = [];
  try {
    projects = await api.listProjects(session.access_token);
  } catch {
    // non-critical
  }

  // Fetch purchases for this user via API
  const purchases = await api.listPurchases(session.access_token).catch(() => []);

  const connectedPlatforms = connections?.map((c) => c.platform) || [];
  const githubConnected = connectedPlatforms.includes("github");
  const gitlabConnected = connectedPlatforms.includes("gitlab");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-obsidian flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-sm text-ash mt-1">
          Manage your account, connected repositories, and VCS connections.
        </p>
      </div>

      <div className="space-y-6">

        {/* Account Section */}
        <div className="bg-paper-raised border border-paper-sunken rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-paper-sunken flex items-center gap-2">
            <User className="w-4 h-4 text-ash" />
            <h2 className="text-base font-semibold text-obsidian">Account</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-ash">Email</span>
              <span className="font-medium text-obsidian">{session.user.email}</span>
            </div>
            {profile?.full_name && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-ash">Name</span>
                <span className="font-medium text-obsidian">{profile.full_name}</span>
              </div>
            )}
            {profile?.company_name && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-ash">Company</span>
                <span className="font-medium text-obsidian">{profile.company_name}</span>
              </div>
            )}
            {profile?.role && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-ash">Role</span>
                <span className="font-medium text-obsidian capitalize">{profile.role}</span>
              </div>
            )}
          </div>
        </div>

        {/* Purchases */}
        <div className="bg-paper-raised border border-paper-sunken rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-paper-sunken flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-ash" />
            <h2 className="text-base font-semibold text-obsidian">Purchases</h2>
          </div>
          <div className="p-5">
            {(!purchases || purchases.length === 0) ? (
              <div className="text-center py-4">
                <p className="text-sm text-ash mb-3">No purchases yet.</p>
                <Link
                  href="/pricing"
                  className="text-sm text-obsidian font-medium hover:underline"
                >
                  Get your full audit →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase) => {
                  const projectName = projects.find((p) => p.id === purchase.project_id)?.repo_name || "Unknown project";
                  return (
                    <div key={purchase.id} className="flex items-center justify-between p-3 bg-paper-sunken rounded-xl border border-paper-sunken">
                      <div>
                        <div className="text-sm font-medium text-obsidian">{projectName.split("/").pop()}</div>
                        <div className="text-xs text-ash">
                          {purchase.purchased_at
                            ? new Date(purchase.purchased_at).toLocaleDateString()
                            : new Date(purchase.created_at).toLocaleDateString()}
                          {" · "}
                          ${(purchase.amount_cents / 100).toFixed(0)}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        purchase.status === "complete"
                          ? "bg-obsidian/10 text-obsidian"
                          : purchase.status === "refunded"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-paper-sunken text-ash"
                      }`}>
                        {purchase.status === "complete" ? "Paid" : purchase.status === "refunded" ? "Refunded" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Connected VCS Accounts */}
        <div className="bg-paper-raised border border-paper-sunken rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-paper-sunken flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-ash" />
              <h2 className="text-base font-semibold text-obsidian">Connected Accounts</h2>
            </div>
            {!githubConnected && (
              <Link
                href="/onboarding?step=2"
                className="inline-flex items-center gap-1.5 text-xs text-obsidian hover:underline font-medium"
              >
                <Plus className="w-3 h-3" />
                Add account
              </Link>
            )}
          </div>
          <div className="p-5 space-y-3">
            {/* GitHub */}
            <div className="flex items-center justify-between p-4 bg-paper-sunken rounded-xl border border-paper-sunken">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-paper-raised rounded-full flex items-center justify-center border border-paper-sunken">
                  <FolderGit2 className="w-4 h-4 text-obsidian" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-obsidian">GitHub</h3>
                  {githubConnected ? (
                    <p className="text-xs text-obsidian">
                      Connected as @{connections?.find((c) => c.platform === "github")?.platform_username}
                    </p>
                  ) : (
                    <p className="text-xs text-ash">Not connected</p>
                  )}
                </div>
              </div>
              {githubConnected ? (
                <VcsDisconnect
                  connectionId={connections?.find((c) => c.platform === "github")?.id as string}
                  token={session.access_token}
                />
              ) : (
                <Link
                  href={`https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&scope=repo,read:user&redirect_uri=${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/github`}
                  className="px-3 py-1.5 bg-paper-raised border border-paper-sunken rounded-lg text-xs font-medium text-obsidian hover:bg-paper-sunken transition-colors"
                >
                  Connect
                </Link>
              )}
            </div>

            {/* GitLab */}
            <div className="flex items-center justify-between p-4 bg-paper-sunken rounded-xl border border-paper-sunken">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-paper-raised rounded-full flex items-center justify-center border border-paper-sunken">
                  <GitBranch className="w-4 h-4 text-[#FC6D26]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-obsidian">GitLab</h3>
                  {gitlabConnected ? (
                    <p className="text-xs text-obsidian">
                      Connected as @{connections?.find((c) => c.platform === "gitlab")?.platform_username}
                    </p>
                  ) : (
                    <p className="text-xs text-ash">Not connected</p>
                  )}
                </div>
              </div>
              {gitlabConnected ? (
                <VcsDisconnect
                  connectionId={connections?.find((c) => c.platform === "gitlab")?.id as string}
                  token={session.access_token}
                />
              ) : (
                <span className="px-3 py-1.5 bg-paper-raised border border-paper-sunken rounded-lg text-xs font-medium text-ash">
                  Coming soon
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Connected Projects */}
        <div className="bg-paper-raised border border-paper-sunken rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-paper-sunken flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-ash" />
              <h2 className="text-base font-semibold text-obsidian">Connected Repositories</h2>
            </div>
            {(!isFreeTier || projects.length < 2) && (
              <Link
                href="/onboarding?step=2"
                className="inline-flex items-center gap-1.5 text-xs text-obsidian hover:underline font-medium"
              >
                <Plus className="w-3 h-3" />
                Add repository
              </Link>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="p-8 text-center">
              <FolderGit2 className="w-8 h-8 text-[#e0dada] mx-auto mb-3" />
              <p className="text-sm text-ash">No repositories connected yet.</p>
              <Link
                href="/onboarding?step=2"
                className="mt-4 inline-flex items-center gap-2 text-xs text-obsidian hover:underline font-medium"
              >
                <Plus className="w-3 h-3" />
                Connect your first repository
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F6F4F4]">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 hover:bg-paper-sunken/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-paper-sunken rounded-lg flex items-center justify-center flex-shrink-0">
                      <FolderGit2 className="w-4 h-4 text-obsidian" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-sm text-obsidian hover:text-obsidian transition-colors truncate block"
                      >
                        {project.repo_name.split("/").pop()}
                      </Link>
                      <p className="text-xs text-ash truncate">{project.repo_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.latest_analysis?.status === "complete"
                        ? "bg-obsidian/10 text-obsidian"
                        : project.latest_analysis?.status === "failed"
                        ? "bg-red-50 text-red-500"
                        : project.latest_analysis?.status === "running" || project.latest_analysis?.status === "queued"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-paper-sunken text-ash"
                    }`}>
                      {project.latest_analysis?.status === "complete" ? "Ready" :
                       project.latest_analysis?.status === "failed" ? "Failed" :
                       project.latest_analysis?.status === "running" ? "Analysing" :
                       project.latest_analysis?.status === "queued" ? "Queued" : "No analysis"}
                    </span>
                    {!isFreeTier && (
                      <DeleteProject projectId={project.id} token={session.access_token} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-paper-raised border border-red-100 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-red-100">
            <h2 className="text-base font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Danger Zone
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-obsidian">Delete Account</h3>
                <p className="text-xs text-ash mt-0.5">Permanently delete your account and all data. This cannot be undone.</p>
              </div>
              <button
                disabled
                className="px-4 py-2 border border-red-200 text-red-500 text-xs font-medium rounded-lg opacity-50 cursor-not-allowed"
                title="Contact support to delete your account"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
