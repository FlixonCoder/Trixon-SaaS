import React from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, AlertCircle, Calendar, Users, Building } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { ReportActions } from "@/components/report-actions";
import { ExplainSimply } from "@/components/explain-simply";
import { StickyEngageBar } from "@/components/sticky-engage-bar";

interface PageProps {
  params: Promise<{ id: string; type: string }>;
  searchParams: Promise<{ analysis?: string }>;
}

const REPORT_LABELS: Record<string, string> = {
  executive_summary: "What You Built",
  architecture: "How It All Connects",
  tech_debt: "What's Messy & Risky",
  security: "Security Risk Scan",
  scalability: "Can It Handle Growth?",
  onboarding: "Dev Onboarding Guide",
  investor: "Investor Technical Summary",
  team_readiness: "Team Readiness Report",
};

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "#";

const EFFORT_COLORS: Record<string, { bg: string; text: string }> = {
  "quick-win": { bg: "bg-zinc-100", text: "text-zinc-800" },
  moderate: { bg: "bg-blue-50", text: "text-blue-700" },
  complex: { bg: "bg-amber-50", text: "text-amber-700" },
  architectural: { bg: "bg-red-50", text: "text-red-700" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    Critical: { label: "Critical", cls: "bg-red-500/10 text-red-500 border-[#E53E3E]/20", icon: AlertTriangle },
    High: { label: "High", cls: "bg-red-500/10 text-red-500 border-[#E53E3E]/20", icon: AlertTriangle },
    Medium: { label: "Medium", cls: "bg-amber-500/10 text-amber-500 border-[#F59E0B]/20", icon: AlertCircle },
    Low: { label: "Low", cls: "bg-zinc-100 text-zinc-800 border-zinc-200", icon: CheckCircle },
  };
  const s = map[severity] ?? map.Low;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function EffortBadge({ effort }: { effort: Record<string, string> }) {
  const level = effort.effort_level || "moderate";
  const colors = EFFORT_COLORS[level] || EFFORT_COLORS.moderate;
  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit ${colors.bg} ${colors.text}`}>
        {level}
      </span>
      {effort.effort_description && (
        <p className="text-[13px] text-ash">{effort.effort_description}</p>
      )}
    </div>
  );
}

// Render issues list for reports that have severity items
function IssueList({ items, type, reportId, token }: { items: Record<string, any>[]; type: string; reportId: string; token: string }) {
  const severityKey = "severity";
  const titleKey = "title";
  const descKey = "description";
  const impactKey = type === "security" ? "business_impact" : "impact";
  const recKey = "recommendation";

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5 relative">
          <ExplainSimply text={item[descKey]} reportId={reportId} token={token} />
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-obsidian text-sm">{item[titleKey]}</h3>
            <SeverityBadge severity={item[severityKey]} />
          </div>
          <p className="text-sm text-ash mb-3 pr-4">{item[descKey]}</p>

          {/* Effort badge (tech_debt reports) */}
          {type === "tech_debt" && item.effort && (
            <EffortBadge effort={item.effort} />
          )}

          {item[impactKey] && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-2 mt-2">
              <span className="font-medium">Business Impact:</span> {item[impactKey]}
            </div>
          )}
          {item[recKey] && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700">
              <span className="font-medium">Recommendation:</span> {item[recKey]}
            </div>
          )}

          {/* Trixon CTA for high-severity tech_debt findings */}
          {type === "tech_debt" && (item[severityKey] === "High" || item[severityKey] === "Critical") && item.effort?.trixon_timeline && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600">
                Trixon addresses this in <span className="font-semibold">{item.effort.trixon_timeline}</span>. Book a call to discuss.
              </p>
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-zinc-300 text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors flex-shrink-0"
              >
                <Calendar className="w-3 h-3" />
                Book a call →
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id, type } = await params;
  const sp = await searchParams;

  if (!REPORT_LABELS[type]) notFound();

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Get the latest analysis for this project if not passed
  let analysisId = sp.analysis;
  if (!analysisId) {
    try {
      const project = await api.getProject(session.access_token, id);
      analysisId = project.latest_analysis?.id;
    } catch {
      redirect("/dashboard");
    }
  }

  if (!analysisId) redirect(`/projects/${id}`);

  let report;
  let isLocked = false;
  let reportMissing = false;
  try {
    report = await api.getReport(session.access_token, analysisId, type);
  } catch (e: any) {
    // Check if it's a 402 (payment required)
    if (e.message?.includes("full_audit_required")) {
      isLocked = true;
    } else if (e.message?.includes("not found") || e.message?.includes("404")) {
      // Report wasn't generated (analysis failed for this type, or still running)
      reportMissing = true;
    } else {
      notFound();
    }
  }

  // Report wasn't generated — show friendly message instead of 404
  if (reportMissing) {
    return (
      <div className="min-h-screen bg-paper-sunken">
        <main className="max-w-3xl mx-auto px-6 py-10">
          <Link
            href={`/projects/${id}/reports`}
            className="inline-flex items-center gap-2 text-sm text-ash hover:text-obsidian transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            All Reports
          </Link>
          <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-obsidian mb-2">
              {REPORT_LABELS[type]} wasn&apos;t generated
            </h2>
            <p className="text-sm text-ash leading-relaxed max-w-md mx-auto mb-6">
              This report may have failed during analysis, or the analysis is still running.
              Try re-running the analysis from your project dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/projects/${id}`}
                className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Go to Project
              </Link>
              <Link
                href={`/projects/${id}/reports`}
                className="inline-flex items-center justify-center gap-2 border border-paper-sunken text-obsidian px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-paper-raised transition-colors"
              >
                View Other Reports
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Locked report — show paywall
  if (isLocked || !report) {
    return (
      <div className="min-h-screen bg-paper-sunken">
        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex justify-between items-start mb-6">
            <Link
              href={`/projects/${id}`}
              className="inline-flex items-center gap-2 text-sm text-ash hover:text-obsidian transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project
            </Link>
          </div>

          <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-8 mb-6">
            <h1 className="text-2xl font-bold text-obsidian mb-2">{REPORT_LABELS[type]}</h1>
          </div>

          {/* Blurred placeholder content */}
          <div className="relative min-h-[400px]">
            <div className="space-y-4 filter blur-sm select-none pointer-events-none">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                  <div className="h-4 bg-paper-sunken rounded w-3/4 mb-3" />
                  <div className="h-3 bg-paper-sunken rounded w-full mb-2" />
                  <div className="h-3 bg-paper-sunken rounded w-5/6" />
                </div>
              ))}
            </div>

            {/* Paywall card overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-paper-raised rounded-2xl border border-paper-sunken shadow-xl p-8 max-w-sm w-full text-center">
                <div className="w-14 h-14 bg-paper-sunken rounded-full flex items-center justify-center mx-auto mb-5 border border-paper-sunken">
                  <Building className="w-7 h-7 text-ash" />
                </div>
                <h2 className="text-lg font-bold text-obsidian mb-2">
                  This report is part of the Full Audit
                </h2>
                <p className="text-sm text-ash leading-relaxed mb-2">
                  Get all 8 reports including Investor Summary, Team Readiness, and detailed Tech Debt analysis.
                </p>
                <p className="text-2xl font-bold text-obsidian mb-6">
                  $497{" "}
                  <span className="text-sm font-normal text-ash">
                    one-time, no subscription
                  </span>
                </p>
                <Link
                  href="/pricing"
                  className="block w-full bg-zinc-900 text-paper-raised px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors mb-3"
                >
                  Unlock full audit →
                </Link>
                <p className="text-xs text-ash">
                  Or{" "}
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium hover:underline">
                    book a call
                  </a>{" "}
                  and let us walk you through it
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const json = report.content_json as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-paper-sunken pb-16 md:pb-20">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 print:max-w-none print:p-0">
        {/* Back link */}
        <div className="flex justify-between items-start mb-6 print:hidden">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-2 text-sm text-ash hover:text-obsidian transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </Link>
          <ReportActions 
            reportId={report.id} 
            token={session.access_token} 
            isShared={report.share_enabled} 
            shareToken={report.share_token}
            analysisId={analysisId}
          />
        </div>

        {/* Investor callout */}
        {type === "investor" && (
          <div className="bg-zinc-50 border-l-[3px] border-zinc-800 rounded-r-xl p-5 mb-6 flex items-start gap-3 print:hidden">
            <Building className="w-5 h-5 text-zinc-800 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-zinc-700 leading-relaxed">
                This report was generated by Trixon&apos;s AI analysis engine. For a live technical walkthrough you can present to your VC — with a Trixon engineer on the call —{" "}
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline text-zinc-950">
                  book a discovery session →
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="bg-paper-raised border border-paper-sunken rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-obsidian">{REPORT_LABELS[type]}</h1>
            {(() => {
              const findingsKey = { tech_debt: 'issues', security: 'risks', scalability: 'bottlenecks' }[type as keyof typeof REPORT_LABELS];
              const hasFindings = findingsKey && Array.isArray(json?.[findingsKey]) && (json[findingsKey] as any[]).length > 0;
              if (hasFindings) {
                return (
                  <span className="text-xs text-ash print:hidden">
                    Analyzed by Trixon ·{" "}
                    <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium hover:underline">
                      Fix these issues →
                    </a>
                  </span>
                );
              }
              return null;
            })()}
          </div>
          {typeof json.one_liner === "string" && (
            <p className="text-zinc-700 font-medium text-sm">{json.one_liner}</p>
          )}
          {typeof json.headline === "string" && (
            <p className="text-zinc-700 font-medium text-sm">{json.headline}</p>
          )}
          {typeof json.score === "number" && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-ash">Score:</span>
              <span
                className={`text-lg font-bold ${
                  json.score >= 80 ? "text-zinc-900" : json.score >= 60 ? "text-amber-500" : "text-red-500"
                }`}
              >
                {json.score}/100
              </span>
            </div>
          )}
        </div>

        {/* Executive Summary — paragraphs & key findings */}
        {type === "executive_summary" && (
          <div className="space-y-6 mb-6">
            {Array.isArray(json.paragraphs) && (
              <div className="space-y-4">
                {(json.paragraphs as string[])
                  .filter(p => typeof p === 'string' && !['key_findings', ':', 'score', '{', '}'].includes(p.trim()) && !p.trim().match(/^:\d+$/))
                  .map((p, i) => (
                    <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-6 text-sm text-obsidian leading-relaxed">
                      {p}
                    </div>
                  ))}
              </div>
            )}
            {Array.isArray(json.key_findings) && (json.key_findings as string[]).length > 0 && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                <h3 className="font-semibold text-sm text-obsidian mb-3">Key Findings</h3>
                <ul className="space-y-2">
                  {(json.key_findings as string[]).map((kf, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ash">
                      <CheckCircle className="w-4 h-4 text-zinc-800 mt-0.5 flex-shrink-0" />
                      {kf}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Architecture — components */}
        {type === "architecture" && (
          <div className="space-y-4 mb-6">
            {typeof json.overview === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6 text-sm text-obsidian leading-relaxed">
                {json.overview}
              </div>
            )}
            {Array.isArray(json.components) && (
              <div className="space-y-3">
                {(json.components as Record<string, string>[]).map((comp, i) => (
                  <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-obsidian">{comp.name}</h3>
                      <span className="text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">{comp.technology}</span>
                    </div>
                    <p className="text-sm text-ash">{comp.role}</p>
                  </div>
                ))}
              </div>
            )}
            {typeof json.data_flow === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                <h3 className="font-semibold text-sm text-obsidian mb-2">Data Flow</h3>
                <p className="text-sm text-ash">{json.data_flow}</p>
              </div>
            )}
          </div>
        )}

        {/* Tech Debt + Security + Scalability — issue lists */}
        {(type === "tech_debt" || type === "security" || type === "scalability") && (
          <div className="space-y-4 mb-6">
            {typeof json.summary === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6 text-sm text-obsidian leading-relaxed">
                {json.summary}
              </div>
            )}
            {type === "scalability" && typeof json.current_capacity === "string" && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h3 className="font-semibold text-sm text-blue-900 mb-1">Current Capacity</h3>
                <p className="text-sm text-blue-800">{json.current_capacity}</p>
              </div>
            )}
            {Array.isArray(json.issues) && (
              <IssueList items={json.issues as Record<string, string>[]} type={type} reportId={report.id} token={session.access_token} />
            )}
            {Array.isArray(json.risks) && (
              <IssueList items={json.risks as Record<string, string>[]} type={type} reportId={report.id} token={session.access_token} />
            )}
            {Array.isArray(json.bottlenecks) && (
              <IssueList items={json.bottlenecks as Record<string, string>[]} type={type} reportId={report.id} token={session.access_token} />
            )}
            {type === "scalability" && Array.isArray(json.positives) && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                <h3 className="font-semibold text-sm text-zinc-900 mb-3">What Scales Well</h3>
                <ul className="space-y-1.5">
                  {(json.positives as string[]).map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-obsidian">
                      <CheckCircle className="w-4 h-4 text-zinc-800 mt-0.5 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Developer Onboarding */}
        {type === "onboarding" && (
          <div className="space-y-4 mb-6">
            {typeof json.overview === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6 text-sm text-obsidian">
                {json.overview}
              </div>
            )}
            {Array.isArray(json.setup_steps) && (
              <div className="space-y-3">
                <h2 className="font-semibold text-obsidian">Setup Steps</h2>
                {(json.setup_steps as Record<string, string>[]).map((step, i) => (
                  <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                    <h3 className="font-semibold text-sm text-obsidian mb-1">
                      Step {i + 1}: {step.step}
                    </h3>
                    <p className="text-sm text-ash mb-2">{step.description}</p>
                    {step.command && (
                      <pre className="bg-obsidian text-[#e4e4e7] text-xs px-4 py-3 rounded-lg overflow-x-auto font-mono border border-zinc-800">
                        {step.command}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(json.gotchas) && (json.gotchas as string[]).length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <h3 className="font-semibold text-sm text-amber-900 mb-3">⚠ Watch out for</h3>
                <ul className="space-y-1.5">
                  {(json.gotchas as string[]).map((g, i) => (
                    <li key={i} className="text-sm text-amber-800">{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Investor Summary */}
        {type === "investor" && (
          <div className="space-y-4 mb-6">
            {typeof json.maturity_level === "string" && (
              <div className="flex gap-3">
                <div className="flex-1 bg-paper-raised border border-paper-sunken rounded-xl p-4 text-center">
                  <div className="text-xs text-ash mb-1">Maturity</div>
                  <div className="font-semibold text-obsidian text-sm">{json.maturity_level}</div>
                </div>
                <div className={`flex-1 border rounded-xl p-4 text-center ${
                  json.technical_risk === "Low" ? "bg-zinc-50 border-zinc-200" :
                  json.technical_risk === "High" ? "bg-[#E53E3E]/5 border-[#E53E3E]/20" :
                  "bg-amber-50 border-amber-100"
                }`}>
                  <div className="text-xs text-ash mb-1">Technical Risk</div>
                  <div className={`font-semibold text-sm ${
                    json.technical_risk === "Low" ? "text-zinc-800" :
                    json.technical_risk === "High" ? "text-red-500" : "text-amber-700"
                  }`}>{typeof json.technical_risk === "string" ? json.technical_risk : ""}</div>
                </div>
              </div>
            )}
            {Array.isArray(json.strengths) && (
              <div className="space-y-3">
                <h2 className="font-semibold text-obsidian">Technical Strengths</h2>
                {(json.strengths as Record<string, string>[]).map((s, i) => (
                  <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                    <h3 className="font-semibold text-sm text-obsidian mb-1">{s.title}</h3>
                    <p className="text-sm text-ash">{s.description}</p>
                  </div>
                ))}
              </div>
            )}
            {typeof json.scalability_outlook === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                <h3 className="font-semibold text-sm text-obsidian mb-2">Scalability Outlook</h3>
                <p className="text-sm text-ash">{json.scalability_outlook}</p>
              </div>
            )}
            {typeof json.risk_notes === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                <h3 className="font-semibold text-sm text-obsidian mb-2">Risk Notes</h3>
                <p className="text-sm text-ash">{json.risk_notes}</p>
              </div>
            )}
            {Array.isArray(json.recommended_next_hires) && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                <h3 className="font-semibold text-sm text-obsidian mb-3">Recommended Next Hires</h3>
                <div className="flex flex-wrap gap-2">
                  {(json.recommended_next_hires as string[]).map((role, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-paper-sunken text-obsidian rounded-lg border border-paper-sunken">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Readiness */}
        {type === "team_readiness" && (
          <div className="space-y-4 mb-6">
            {typeof json.codebase_origin === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                <h2 className="font-semibold text-obsidian mb-2">What your codebase tells us about who built it</h2>
                <p className="text-sm text-ash leading-relaxed">{json.codebase_origin}</p>
              </div>
            )}

            {Array.isArray(json.immediate_hires) && (json.immediate_hires as any[]).length > 0 && (
              <div>
                <h2 className="font-semibold text-obsidian mb-3">Hires you need in the next 0–3 months</h2>
                <div className="space-y-3">
                  {(json.immediate_hires as any[]).map((hire, i) => (
                    <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                      <h3 className="font-semibold text-sm text-obsidian mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-zinc-600" />
                        {hire.role}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-obsidian">Why you need them:</span> <span className="text-ash">{hire.why_needed}</span></p>
                        <p><span className="font-medium text-obsidian">What to look for:</span> <span className="text-ash">{(hire.skills_to_look_for || []).join(", ")}</span></p>
                        <p><span className="font-medium text-obsidian">Red flags:</span> <span className="text-ash">{(hire.red_flags || []).join(", ")}</span></p>
                        <p><span className="font-medium text-obsidian">Market rate:</span> <span className="text-zinc-800 font-semibold">{hire.market_rate}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(json.future_hires) && (json.future_hires as any[]).length > 0 && (
              <div>
                <h2 className="font-semibold text-obsidian mb-3">Hires you&apos;ll need in 3–12 months</h2>
                <div className="space-y-3">
                  {(json.future_hires as any[]).map((hire, i) => (
                    <div key={i} className="bg-paper-raised border border-paper-sunken rounded-xl p-5">
                      <h3 className="font-semibold text-sm text-obsidian mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-ash" />
                        {hire.role}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-obsidian">Why you need them:</span> <span className="text-ash">{hire.why_needed}</span></p>
                        <p><span className="font-medium text-obsidian">What to look for:</span> <span className="text-ash">{(hire.skills_to_look_for || []).join(", ")}</span></p>
                        <p><span className="font-medium text-obsidian">Red flags:</span> <span className="text-ash">{(hire.red_flags || []).join(", ")}</span></p>
                        <p><span className="font-medium text-obsidian">Market rate:</span> <span className="text-zinc-800 font-semibold">{hire.market_rate}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {typeof json.team_structure === "string" && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                <h2 className="font-semibold text-obsidian mb-2">How your team should be structured</h2>
                <p className="text-sm text-ash leading-relaxed whitespace-pre-line">{json.team_structure}</p>
              </div>
            )}

            {Array.isArray(json.hiring_order) && (
              <div className="bg-paper-raised border border-paper-sunken rounded-xl p-6">
                <h2 className="font-semibold text-obsidian mb-3">Hiring order and why</h2>
                <ol className="space-y-2">
                  {(json.hiring_order as any[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="w-6 h-6 bg-zinc-100 text-zinc-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {item.order || i + 1}
                      </span>
                      <span>
                        <span className="font-medium text-obsidian">{item.role}</span>
                        {" — "}
                        <span className="text-ash">{item.consequence}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Inline BOT Explainer */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-800 mb-2">A note from Trixon</h3>
              <p className="text-sm text-zinc-600 leading-relaxed mb-4">
                {typeof json.trixon_note === "string" ? json.trixon_note : "Building and vetting a technical team is one of the hardest things a non-technical founder does alone. Trixon's Build-Operate-Transfer model was designed for exactly this: we hire, install, and manage your engineering team — then formally hand it over to you."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-paper-raised px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Book a free scoping call
                </a>
                <Link
                  href="/engage"
                  className="inline-flex items-center justify-center gap-2 text-zinc-900 text-sm font-medium hover:underline"
                >
                  See full details →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Markdown fallback */}
        {report.content_markdown && Object.keys(json).length === 0 && (
          <div className="bg-paper-raised border border-paper-sunken rounded-xl p-8 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-obsidian font-sans">
              {report.content_markdown}
            </pre>
          </div>
        )}

        {/* Sticky engage bar */}
        <StickyEngageBar />
      </main>
    </div>
  );
}
