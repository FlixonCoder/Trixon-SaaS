import React from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

interface PageProps {
  params: Promise<{ token: string }>;
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

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    Critical: { label: "Critical", cls: "bg-[#E53E3E]/10 text-[#E53E3E] border-[#E53E3E]/20", icon: AlertTriangle },
    High: { label: "High", cls: "bg-[#E53E3E]/10 text-[#E53E3E] border-[#E53E3E]/20", icon: AlertTriangle },
    Medium: { label: "Medium", cls: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20", icon: AlertCircle },
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

// Render issues list for reports that have severity items
function IssueList({ items, type }: { items: Record<string, string>[]; type: string }) {
  const severityKey = "severity";
  const titleKey = "title";
  const descKey = "description";
  const impactKey = type === "security" ? "business_impact" : "impact";
  const recKey = "recommendation";

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="bg-white border border-[#e0dada] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-[#1e1b1b] text-sm">{item[titleKey]}</h3>
            <SeverityBadge severity={item[severityKey]} />
          </div>
          <p className="text-sm text-[#837e80] mb-3">{item[descKey]}</p>
          {item[impactKey] && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-2">
              <span className="font-medium">Business Impact:</span> {item[impactKey]}
            </div>
          )}
          {item[recKey] && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700">
              <span className="font-medium">Recommendation:</span> {item[recKey]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function PublicReportPage({ params }: PageProps) {
  const { token } = await params;

  let report;
  try {
    report = await api.getSharedReport(token);
  } catch {
    notFound();
  }

  const type = report.report_type;
  const json = report.content_json as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-[#F6F4F4]">
      {/* Public Header */}
      <header className="bg-white border-b border-[#e0dada] py-4 px-6 sticky top-0 z-50 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1e1b1b] rounded flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-[#1e1b1b] tracking-tight">
              Trixon
            </span>
          </div>
          <div className="text-sm font-medium text-[#837e80]">
            Shared Analysis for <span className="text-[#1e1b1b]">{report.repo_name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 print:max-w-none print:p-0">
        {/* Title */}
        <div className="bg-white border border-[#e0dada] rounded-2xl p-8 mb-6">
          <h1 className="text-2xl font-bold text-[#1e1b1b] mb-2">{REPORT_LABELS[type] || "Report"}</h1>
          {typeof json.one_liner === "string" && (
            <p className="text-zinc-700 font-medium text-sm">{json.one_liner}</p>
          )}
          {typeof json.headline === "string" && (
            <p className="text-zinc-700 font-medium text-sm">{json.headline}</p>
          )}
          {typeof json.score === "number" && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-[#837e80]">Score:</span>
              <span
                className={`text-lg font-bold ${
                  json.score >= 80 ? "text-zinc-900" : json.score >= 60 ? "text-[#F59E0B]" : "text-[#E53E3E]"
                }`}
              >
                {json.score}/100
              </span>
            </div>
          )}
        </div>

        {/* Executive Summary — paragraphs */}
        {type === "executive_summary" && Array.isArray(json.paragraphs) && (
          <div className="space-y-4 mb-6">
            {(json.paragraphs as string[]).map((p, i) => (
              <div key={i} className="bg-white border border-[#e0dada] rounded-xl p-6 text-sm text-[#1e1b1b] leading-relaxed">
                {p}
              </div>
            ))}
          </div>
        )}

        {/* Architecture — components */}
        {type === "architecture" && (
          <div className="space-y-4 mb-6">
            {typeof json.overview === "string" && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-6 text-sm text-[#1e1b1b] leading-relaxed">
                {json.overview}
              </div>
            )}
            {Array.isArray(json.components) && (
              <div className="space-y-3">
                {(json.components as Record<string, string>[]).map((comp, i) => (
                  <div key={i} className="bg-white border border-[#e0dada] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-[#1e1b1b]">{comp.name}</h3>
                      <span className="text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">{comp.technology}</span>
                    </div>
                    <p className="text-sm text-[#837e80]">{comp.role}</p>
                  </div>
                ))}
              </div>
            )}
            {typeof json.data_flow === "string" && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-6">
                <h3 className="font-semibold text-sm text-[#1e1b1b] mb-2">Data Flow</h3>
                <p className="text-sm text-[#837e80]">{json.data_flow}</p>
              </div>
            )}
          </div>
        )}

        {/* Tech Debt + Security + Scalability — issue lists */}
        {(type === "tech_debt" || type === "security" || type === "scalability") && (
          <div className="space-y-4 mb-6">
            {typeof json.summary === "string" && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-6 text-sm text-[#1e1b1b] leading-relaxed">
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
              <IssueList items={json.issues as Record<string, string>[]} type={type} />
            )}
            {Array.isArray(json.risks) && (
              <IssueList items={json.risks as Record<string, string>[]} type={type} />
            )}
            {Array.isArray(json.bottlenecks) && (
              <IssueList items={json.bottlenecks as Record<string, string>[]} type={type} />
            )}
            {type === "scalability" && Array.isArray(json.positives) && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-5">
                <h3 className="font-semibold text-sm text-zinc-900 mb-3">What Scales Well</h3>
                <ul className="space-y-1.5">
                  {(json.positives as string[]).map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#1e1b1b]">
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
              <div className="bg-white border border-[#e0dada] rounded-xl p-6 text-sm text-[#1e1b1b]">
                {json.overview}
              </div>
            )}
            {Array.isArray(json.setup_steps) && (
              <div className="space-y-3">
                <h2 className="font-semibold text-[#1e1b1b]">Setup Steps</h2>
                {(json.setup_steps as Record<string, string>[]).map((step, i) => (
                  <div key={i} className="bg-white border border-[#e0dada] rounded-xl p-5">
                    <h3 className="font-semibold text-sm text-[#1e1b1b] mb-1">
                      Step {i + 1}: {step.step}
                    </h3>
                    <p className="text-sm text-[#837e80] mb-2">{step.description}</p>
                    {step.command && (
                      <pre className="bg-[#18181b] text-[#e4e4e7] text-xs px-4 py-3 rounded-lg overflow-x-auto font-mono border border-zinc-800">
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
                <div className="flex-1 bg-white border border-[#e0dada] rounded-xl p-4 text-center">
                  <div className="text-xs text-[#837e80] mb-1">Maturity</div>
                  <div className="font-semibold text-[#1e1b1b] text-sm">{json.maturity_level}</div>
                </div>
                <div className={`flex-1 border rounded-xl p-4 text-center ${
                  json.technical_risk === "Low" ? "bg-zinc-50 border-zinc-200" :
                  json.technical_risk === "High" ? "bg-[#E53E3E]/5 border-[#E53E3E]/20" :
                  "bg-amber-50 border-amber-100"
                }`}>
                  <div className="text-xs text-[#837e80] mb-1">Technical Risk</div>
                  <div className={`font-semibold text-sm ${
                    json.technical_risk === "Low" ? "text-zinc-800" :
                    json.technical_risk === "High" ? "text-[#E53E3E]" : "text-amber-700"
                  }`}>{typeof json.technical_risk === "string" ? json.technical_risk : ""}</div>
                </div>
              </div>
            )}
            {Array.isArray(json.strengths) && (
              <div className="space-y-3">
                <h2 className="font-semibold text-[#1e1b1b]">Technical Strengths</h2>
                {(json.strengths as Record<string, string>[]).map((s, i) => (
                  <div key={i} className="bg-white border border-[#e0dada] rounded-xl p-5">
                    <h3 className="font-semibold text-sm text-[#1e1b1b] mb-1">{s.title}</h3>
                    <p className="text-sm text-[#837e80]">{s.description}</p>
                  </div>
                ))}
              </div>
            )}
            {typeof json.scalability_outlook === "string" && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-5">
                <h3 className="font-semibold text-sm text-[#1e1b1b] mb-2">Scalability Outlook</h3>
                <p className="text-sm text-[#837e80]">{json.scalability_outlook}</p>
              </div>
            )}
            {typeof json.risk_notes === "string" && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-5">
                <h3 className="font-semibold text-sm text-[#1e1b1b] mb-2">Risk Notes</h3>
                <p className="text-sm text-[#837e80]">{json.risk_notes}</p>
              </div>
            )}
            {Array.isArray(json.recommended_next_hires) && (
              <div className="bg-white border border-[#e0dada] rounded-xl p-5">
                <h3 className="font-semibold text-sm text-[#1e1b1b] mb-3">Recommended Next Hires</h3>
                <div className="flex flex-wrap gap-2">
                  {(json.recommended_next_hires as string[]).map((role, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-[#F6F4F4] text-[#1e1b1b] rounded-lg border border-[#e0dada]">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Markdown fallback */}
        {report.content_markdown && Object.keys(json).length === 0 && (
          <div className="bg-white border border-[#e0dada] rounded-xl p-8 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-[#1e1b1b] font-sans">
              {report.content_markdown}
            </pre>
          </div>
        )}
      </main>

      {/* Trixon CTA Footer */}
      <footer className="border-t border-[#e0dada] bg-white py-8 px-6 mt-8 print:hidden">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#1e1b1b]">
              This report was generated by Trixon
            </p>
            <p className="text-xs text-[#837e80] mt-0.5">
              AI-powered technical intelligence for non-technical founders
            </p>
          </div>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Analyse your own codebase →
          </a>
        </div>
      </footer>
    </div>
  );
}
