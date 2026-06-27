import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle, GitBranch, Calendar, Layers } from "lucide-react";
import { api } from "@/lib/api";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { projectId } = await params;

  try {
    const data = await api.getPublicProject(projectId);
    const name = data.project_name;
    const score = data.health_score;

    return {
      title: `${name} — Trixon Health Score`,
      description: `${name} has a Trixon health score of ${score}/100. Powered by Trixon continuous codebase intelligence.`,
      openGraph: {
        title: `${name}: ${score}/100 on Trixon`,
        description: "Real-time codebase health, security, and scalability tracking.",
        siteName: "Trixon",
      },
      twitter: {
        card: "summary",
        title: `${name}: ${score}/100 on Trixon`,
        description: "Real-time codebase health, security, and scalability tracking.",
      },
    };
  } catch {
    return { title: "Trixon — Codebase Health Score" };
  }
}

function ScoreRing({
  score,
  label,
  size = 80,
}: {
  score: number | null;
  label: string;
  size?: number;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayScore = score ?? 0;
  const dashOffset =
    score !== null
      ? circumference - (displayScore / 100) * circumference
      : circumference;
  const color =
    score === null
      ? "#efeeec"
      : score >= 75
      ? "#039a85"
      : score >= 50
      ? "#F59E0B"
      : "#E53E3E";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#efeeec"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-lg font-bold font-mono"
            style={{ color: score === null ? "#837e80" : color }}
          >
            {score !== null ? score : "—"}
          </span>
        </div>
      </div>
      <span className="text-xs text-[#837e80] text-center leading-tight">{label}</span>
    </div>
  );
}

function Sparkline({
  data,
}: {
  data: { snapshot: number; score: number }[];
}) {
  if (data.length < 2) return null;

  const width = 140;
  const height = 40;
  const padding = 6;
  const scores = data.map((d) => d.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const points = scores
    .map((val, idx) => {
      const x = padding + (idx / (scores.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (val - minScore) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastScore = scores[scores.length - 1];
  const firstScore = scores[0];
  const trend =
    lastScore > firstScore ? "up" : lastScore < firstScore ? "down" : "flat";
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-[#039a85]"
      : trend === "down"
      ? "text-[#E53E3E]"
      : "text-[#837e80]";
  const trendLabel =
    trend === "up"
      ? "Improving over time"
      : trend === "down"
      ? "Declining"
      : "Stable";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={width}
        height={height}
        className="overflow-visible opacity-80"
      >
        <polyline
          fill="none"
          stroke="#039a85"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {scores.map((val, idx) => {
          const x =
            padding + (idx / (scores.length - 1)) * (width - padding * 2);
          const y =
            padding +
            (1 - (val - minScore) / range) * (height - padding * 2);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === scores.length - 1 ? 3 : 2}
              fill={idx === scores.length - 1 ? "#039a85" : "#e0dada"}
            />
          );
        })}
      </svg>
      <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="w-3.5 h-3.5" />
        {trendLabel}
      </div>
    </div>
  );
}

function LanguageBar({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const LANG_COLORS: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f7df1e",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#dea584",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    Ruby: "#701516",
    PHP: "#4F5D95",
    CSS: "#563d7c",
    HTML: "#e34c26",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Shell: "#89e051",
    Vue: "#41b883",
    Dockerfile: "#384d54",
  };

  const entries = Object.entries(breakdown)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {entries.map(([lang, pct]) => (
          <div
            key={lang}
            style={{
              width: `${pct}%`,
              backgroundColor: LANG_COLORS[lang] || "#837e80",
            }}
            title={`${lang}: ${pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {entries.map(([lang, pct]) => (
          <div key={lang} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: LANG_COLORS[lang] || "#837e80" }}
            />
            <span className="text-xs text-[#1e1b1b] font-medium">{lang}</span>
            <span className="text-xs text-[#837e80]">{pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PublicProjectPage({ params }: PageProps) {
  const { projectId } = await params;

  let data;
  try {
    data = await api.getPublicProject(projectId);
  } catch {
    notFound();
  }

  const hasMultipleSnapshots = data.snapshot_trend.length > 1;
  const formattedDate = data.analyzed_at
    ? new Date(data.analyzed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Top nav bar */}
      <div className="bg-[#1e1b1b] px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#039a85] rounded-md" />
          <span className="text-white font-bold text-sm tracking-tight">Trixon</span>
        </Link>
        <Link
          href="https://trixon.cloud"
          className="text-xs text-[#837e80] hover:text-white transition-colors"
        >
          trixon.cloud
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ── Section 1: Header ── */}
        <div className="bg-white border border-[#e0dada] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold bg-[#039a85]/10 text-[#039a85] px-2 py-0.5 rounded-full border border-[#039a85]/20">
                  Analyzed by Trixon
                </span>
                {data.snapshot_number && (
                  <span className="text-xs text-[#837e80]">
                    Snapshot #{data.snapshot_number}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-[#1e1b1b] mt-2">
                {data.project_name}
              </h1>
              <p className="text-sm text-[#837e80] mt-0.5">{data.repo_name}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={data.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1e1b1b] border border-[#e0dada] bg-[#f9f9f8] px-3 py-1.5 rounded-lg hover:bg-[#efeeec] transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5" />
                View on GitHub
                <ExternalLink className="w-3 h-3 text-[#837e80]" />
              </Link>
              {formattedDate && (
                <div className="flex items-center gap-1.5 text-xs text-[#837e80]">
                  <Calendar className="w-3.5 h-3.5" />
                  Last analyzed {formattedDate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Health Scores ── */}
        <div className="bg-white border border-[#e0dada] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-[#1e1b1b]">Health Scores</h2>
            <span className="text-xs text-[#837e80]">0–100</span>
          </div>
          <div className="flex items-center justify-around flex-wrap gap-8">
            <ScoreRing score={data.health_score} label="Overall Health" size={100} />
            <ScoreRing score={data.security_score} label="Security" />
            <ScoreRing score={data.scalability_score} label="Scalability" />
            <ScoreRing score={data.quality_score} label="Code Quality" />
            <ScoreRing score={data.docs_score} label="Documentation" />
          </div>
        </div>

        {/* ── Section 3: Score Trend Sparkline ── */}
        {hasMultipleSnapshots && (
          <div className="bg-white border border-[#e0dada] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[#1e1b1b]">Score Trend</h2>
              <span className="text-xs text-[#837e80]">
                Last {data.snapshot_trend.length} snapshots
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <Sparkline data={data.snapshot_trend} />
              <div className="flex gap-6">
                {data.snapshot_trend.map((point) => (
                  <div key={point.snapshot} className="flex flex-col items-center gap-0.5">
                    <span className="text-base font-bold font-mono text-[#1e1b1b]">
                      {point.score}
                    </span>
                    <span className="text-xs text-[#837e80]">#{point.snapshot}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Section 4: Tech Stack ── */}
        {(Object.keys(data.language_breakdown).length > 0 ||
          data.frameworks.length > 0 ||
          data.third_party_services.length > 0) && (
          <div className="bg-white border border-[#e0dada] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#837e80]" />
              <h2 className="text-sm font-semibold text-[#1e1b1b]">Tech Stack</h2>
            </div>

            {Object.keys(data.language_breakdown).length > 0 && (
              <div>
                <p className="text-xs text-[#837e80] mb-2 font-medium uppercase tracking-wide">
                  Languages
                </p>
                <LanguageBar breakdown={data.language_breakdown} />
              </div>
            )}

            {data.frameworks.length > 0 && (
              <div>
                <p className="text-xs text-[#837e80] mb-2 font-medium uppercase tracking-wide">
                  Frameworks
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.frameworks.map((fw) => (
                    <span
                      key={fw}
                      className="text-xs bg-[#f9f9f8] border border-[#e0dada] text-[#1e1b1b] px-2.5 py-1 rounded-lg font-medium"
                    >
                      {fw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.third_party_services.length > 0 && (
              <div>
                <p className="text-xs text-[#837e80] mb-2 font-medium uppercase tracking-wide">
                  Third-party Services
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.third_party_services.map((svc) => (
                    <span
                      key={svc}
                      className="text-xs bg-purple-50 border border-purple-100 text-purple-800 px-2.5 py-1 rounded-lg font-medium"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section 5: Action Items Count ── */}
        {data.open_action_items_count > 0 && (
          <div className="bg-white border border-[#e0dada] rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1e1b1b]">
                  {data.open_action_items_count} open finding
                  {data.open_action_items_count !== 1 ? "s" : ""} being tracked
                </p>
                <p className="text-xs text-[#837e80] mt-0.5">
                  Trixon is actively helping this team prioritise and resolve technical debt, security issues, and scalability risks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Section 6: Powered by Trixon CTA ── */}
        <div className="bg-[#1e1b1b] rounded-2xl p-7 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-5 h-5 bg-[#039a85] rounded-md" />
            <span className="text-white font-bold text-sm">Trixon</span>
          </div>
          <h2 className="text-white text-lg font-bold mb-2">
            Powered by Trixon
          </h2>
          <p className="text-[#837e80] text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            Want continuous intelligence for your own codebase? Trixon tracks every commit automatically — health scores, security scans, action items, and more.
          </p>
          <Link
            href="https://trixon.cloud/signup"
            className="inline-flex items-center gap-2 bg-[#039a85] hover:bg-[#02897a] text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            Start free →
          </Link>
          <p className="text-xs text-[#837e80]/60 mt-4">
            No credit card required. Free plan available.
          </p>
        </div>
      </div>
    </div>
  );
}
