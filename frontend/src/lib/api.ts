/**
 * Typed API client for the Trixon FastAPI backend.
 * Attaches the Supabase JWT to every request automatically.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface RepoItem {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string | null;
  url: string;
  platform: "github" | "gitlab";
}

export interface AnalysisStatus {
  id: string;
  project_id: string;
  status: "queued" | "running" | "complete" | "failed";
  health_score: number | null;
  security_score: number | null;
  scalability_score: number | null;
  quality_score: number | null;
  docs_score: number | null;
  language_breakdown: Record<string, number> | null;
  third_party_services: { services: string[] } | null;
  stats: {
    total_files: number;
    total_lines: number;
    total_endpoints: number;
    total_dependencies: number;
    env_vars_count: number;
  } | null;
  key_findings: string[] | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  selected_reports?: string[] | null;
  snapshot_number?: number | null;
  commit_sha?: string | null;
  commit_message?: string | null;
  commit_author?: string | null;
  trigger_source?: string | null;
}

export interface Project {
  id: string;
  repo_name: string;
  repo_url: string;
  platform: "github" | "gitlab";
  default_branch: string;
  last_synced_at: string | null;
  created_at: string;
  latest_analysis: AnalysisStatus | null;
  webhook_connected: boolean;
}

export interface Report {
  id: string;
  analysis_id: string;
  report_type: string;
  content_markdown: string;
  content_json: Record<string, unknown>;
  share_token: string | null;
  share_enabled: boolean;
  created_at: string;
}

// ── v3.0 + v3.1 Types ─────────────────────────────────────

export interface ActionItem {
  id: string;
  project_id: string;
  analysis_id: string;
  category: "security" | "tech_debt" | "scalability" | "quality" | "docs";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string | null;
  effort_level: "quick-win" | "moderate" | "complex" | "architectural" | null;
  status: "open" | "in_progress" | "resolved" | "ignored";
  ai_prompt: string | null;
  file_paths: string[] | null;
  first_detected_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  snapshot_number: number | null;
  status: string;
  health_score: number | null;
  security_score: number | null;
  scalability_score: number | null;
  quality_score: number | null;
  docs_score: number | null;
  commit_sha: string | null;
  commit_message: string | null;
  commit_author: string | null;
  trigger_source: string | null;
  created_at: string;
  completed_at: string | null;
  selected_reports: string[] | null;
  diff_id: string | null;
  verdict: "improved" | "regressed" | "mixed" | "no_change" | null;
  score_deltas: Record<string, number> | null;
}

export interface AnalysisDiff {
  id: string;
  project_id: string;
  from_analysis_id: string | null;
  to_analysis_id: string;
  score_deltas: Record<string, number>;
  resolved_findings: SlimFinding[];
  new_findings: SlimFinding[];
  unchanged_findings: SlimFinding[];
  verdict: "improved" | "regressed" | "mixed" | "no_change";
  summary_markdown: string | null;
  created_at: string;
}

export interface SlimFinding {
  id: string;
  title: string;
  category: string;
  severity: string;
  effort_level: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  referenced_action_items: string[] | null;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  best_for: string;
  estimated_tokens: number;
  is_default: boolean;
  is_recommended: boolean;
  display_order: number;
}

export interface WebhookStatus {
  status: "enabled" | "disabled" | "already_active";
  webhook_connection_id?: string;
  platform?: string;
  receiver_url?: string;
}

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  // ── Repos ──────────────────────────────────────────
  listGithubRepos: (token: string) =>
    apiFetch<RepoItem[]>("/api/v1/github/repos", token),

  listGitlabRepos: (token: string) =>
    apiFetch<RepoItem[]>("/api/v1/gitlab/repos", token),

  // ── Projects ────────────────────────────────────────
  createProject: (
    token: string,
    body: {
      vcs_connection_id: string;
      repo_id: string;
      repo_name: string;
      repo_url: string;
      platform: string;
      default_branch: string;
    }
  ) =>
    apiFetch<Project>("/api/v1/projects", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listProjects: (token: string) =>
    apiFetch<Project[]>("/api/v1/projects", token),

  getProject: (token: string, id: string) =>
    apiFetch<Project>(`/api/v1/projects/${id}`, token),

  deleteProject: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/projects/${id}`, token, { method: "DELETE" }),

  triggerAnalysis: (token: string, projectId: string) =>
    apiFetch<AnalysisStatus>(`/api/v1/projects/${projectId}/analyze`, token, {
      method: "POST",
    }),

  // ── Analyses ────────────────────────────────────────
  getAnalysis: (token: string, analysisId: string) =>
    apiFetch<AnalysisStatus>(`/api/v1/analyses/${analysisId}`, token),

  getReport: (token: string, analysisId: string, reportType: string) =>
    apiFetch<Report>(
      `/api/v1/analyses/${analysisId}/reports/${reportType}`,
      token
    ),

  listReports: (token: string, analysisId: string) =>
    apiFetch<{ id: string; report_type: string; created_at: string }[]>(
      `/api/v1/analyses/${analysisId}/reports`,
      token
    ),

  // ── Reports (Phase 5/6) ──────────────────────────────
  simplifyReport: (token: string, reportId: string, text: string) =>
    apiFetch<{ simplified_text: string }>(`/api/v1/reports/${reportId}/simplify`, token, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  toggleShare: (token: string, reportId: string, enabled: boolean) =>
    apiFetch<{ share_token: string | null }>(`/api/v1/reports/${reportId}/share`, token, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  getSharedReport: (token: string) =>
    apiFetch<{
      id: string;
      report_type: string;
      content_markdown: string;
      content_json: Record<string, unknown>;
      repo_name: string;
    }>(`/api/v1/share/${token}`, ""), // No auth required for public share

  listProjectAnalyses: (token: string, projectId: string) =>
    apiFetch<AnalysisStatus[]>(`/api/v1/projects/${projectId}/analyses`, token),

  // ── Settings ─────────────────────────────────────────
  listVcsConnections: (token: string) =>
    apiFetch<{ id: string; platform: string; platform_username: string | null; created_at: string }[]>("/api/v1/vcs", token),

  getProfile: (token: string) =>
    apiFetch<{
      id: string;
      full_name: string | null;
      company_name: string | null;
      role: string | null;
      primary_goal: string | null;
      plan: string;
      is_admin: boolean;
      created_at: string;
    }>("/api/v1/profile", token),

  disconnectVcs: (token: string, connectionId: string) =>
    apiFetch<void>(`/api/v1/vcs/${connectionId}`, token, { method: "DELETE" }),

  // ── Checkout & Access ──────────────────────────────
  createCheckoutSession: (token: string, projectId: string) =>
    apiFetch<{ checkout_url: string }>("/api/v1/checkout/create-session", token, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId }),
    }),

  getAccessLevel: (token: string, projectId: string) =>
    apiFetch<{ access: "basic" | "full" }>(`/api/v1/projects/${projectId}/access-level`, token),

  // ── Trixon Share ───────────────────────────────────
  createTrixonShare: (token: string, analysisId: string, founderMessage?: string) =>
    apiFetch<{ session_id: string; status: string }>("/api/v1/trixon-share", token, {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, founder_message: founderMessage || null }),
    }),

  getTrixonShareStatus: (token: string, sessionId: string) =>
    apiFetch<{ id: string; status: string; created_at: string }>(`/api/v1/trixon-share/${sessionId}`, token),

  // ── Purchases ──────────────────────────────────────
  listPurchases: (token: string) =>
    apiFetch<{
      id: string;
      project_id: string;
      amount_cents: number;
      status: string;
      purchased_at: string | null;
      created_at: string;
    }[]>("/api/v1/checkout/purchases", token),

  triggerAnalysisWithReports: (token: string, projectId: string, reportTypes: string[]) =>
    apiFetch<AnalysisStatus>(`/api/v1/projects/${projectId}/analyze`, token, {
      method: "POST",
      body: JSON.stringify({ report_types: reportTypes }),
    }),

  // ── v3.0: Action Items ────────────────────────────────────
  getActionItems: (
    token: string,
    projectId: string,
    filters?: {
      status?: string;
      severity?: string;
      category?: string;
      effort?: string;
      analysis_id?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.effort) params.set("effort", filters.effort);
    if (filters?.analysis_id) params.set("analysis_id", filters.analysis_id);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<{ items: ActionItem[]; total: number }>(
      `/api/v1/projects/${projectId}/action-items${qs}`,
      token
    );
  },

  updateActionItemStatus: (
    token: string,
    itemId: string,
    status: "open" | "in_progress" | "resolved" | "ignored"
  ) =>
    apiFetch<ActionItem>(`/api/v1/action-items/${itemId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getActionItemPrompt: (token: string, itemId: string) =>
    apiFetch<{ item_id: string; title: string; prompt: string }>(
      `/api/v1/action-items/${itemId}/prompt`,
      token
    ),

  // ── v3.0: Timeline & Diffs ───────────────────────────────
  getProjectTimeline: (token: string, projectId: string) =>
    apiFetch<{ timeline: TimelineEntry[]; total: number }>(
      `/api/v1/projects/${projectId}/timeline`,
      token
    ),

  getAnalysisDiff: (token: string, analysisId: string) =>
    apiFetch<AnalysisDiff>(`/api/v1/analyses/${analysisId}/diff`, token),

  getDiffDetail: (token: string, projectId: string, diffId: string) =>
    apiFetch<AnalysisDiff>(`/api/v1/projects/${projectId}/diffs/${diffId}`, token),

  // ── v3.0: Chat ────────────────────────────────────────────
  getChatHistory: (token: string, projectId: string, page = 1) =>
    apiFetch<{ messages: ChatMessage[]; page: number; total: number }>(
      `/api/v1/projects/${projectId}/chat?page=${page}`,
      token
    ),

  /** Returns a fetch Response for SSE streaming — use response.body directly */
  sendChatMessage: (token: string, projectId: string, message: string) =>
    fetch(`${API_URL}/api/v1/projects/${projectId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    }),

  // ── v3.0: Webhooks ────────────────────────────────────────
  enableWebhook: (token: string, projectId: string, platform = "github") =>
    apiFetch<WebhookStatus>(`/api/v1/projects/${projectId}/webhook/enable`, token, {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),

  disableWebhook: (token: string, projectId: string) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/v1/projects/${projectId}/webhook/disable`,
      token,
      { method: "POST" }
    ),

  // ── v3.1: Report Catalog ──────────────────────────────────
  getReportCatalog: (token: string) =>
    apiFetch<{ catalog: CatalogItem[]; primary_goal: string | null }>(
      `/api/v1/report-catalog`,
      token
    ),

  addReports: (token: string, projectId: string, reportTypes: string[]) =>
    apiFetch<{ status: string; analysis_id: string; adding_reports: string[] }>(
      `/api/v1/projects/${projectId}/reports/add`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ report_types: reportTypes }),
      }
    ),

  triggerAnalysisWithSelectedReports: (
    token: string,
    projectId: string,
    selectedReports: string[],
    opts?: { commitSha?: string; commitMessage?: string; commitAuthor?: string }
  ) =>
    apiFetch<AnalysisStatus>(`/api/v1/projects/${projectId}/analyze`, token, {
      method: "POST",
      body: JSON.stringify({
        selected_reports: selectedReports,
        commit_sha: opts?.commitSha,
        commit_message: opts?.commitMessage,
        commit_author: opts?.commitAuthor,
      }),
    }),

  // ── Admin Metrics ─────────────────────────────────────────
  getAdminOverview: (token: string) =>
    apiFetch<any>(`/api/v1/admin/metrics/overview`, token),
    
  getAdminSignupsTimeseries: (token: string, days = 30) =>
    apiFetch<any[]>(`/api/v1/admin/metrics/signups-timeseries?days=${days}`, token),
    
  getAdminFeatureAdoption: (token: string) =>
    apiFetch<any>(`/api/v1/admin/metrics/feature-adoption`, token),
    
  getAdminMostViewedReports: (token: string) =>
    apiFetch<any[]>(`/api/v1/admin/metrics/most-viewed-reports`, token),
    
  getAdminHealthScoreDistribution: (token: string) =>
    apiFetch<any[]>(`/api/v1/admin/metrics/health-score-distribution`, token),
    
  getAdminRecentActivity: (token: string, limit = 50) =>
    apiFetch<any[]>(`/api/v1/admin/metrics/recent-activity?limit=${limit}`, token),
    
  // ── Usage Analytics ───────────────────────────────────────
  trackEvent: (token: string, event_type: string, project_id?: string, properties?: Record<string, any>) =>
    apiFetch<{ status: string }>(`/api/v1/analytics/event`, token, {
      method: "POST",
      body: JSON.stringify({ event_type, project_id, properties }),
    }).catch(e => console.error("Tracking failed", e)),
};

