"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

interface DemoPoint {
  id: string;
  snapshot_number: number;
  health_score: number;
  verdict: "improved" | "regressed" | "mixed" | "no_change";
  created_at: string;
  commit_message: string;
}

const DEMO_DATA: DemoPoint[] = [
  {
    id: "demo-1",
    snapshot_number: 1,
    health_score: 52,
    verdict: "no_change",
    created_at: "2026-05-20T10:00:00Z",
    commit_message: "Initial analysis — fresh clone",
  },
  {
    id: "demo-2",
    snapshot_number: 2,
    health_score: 58,
    verdict: "improved",
    created_at: "2026-05-27T14:30:00Z",
    commit_message: "fix: patched XSS in user input handler",
  },
  {
    id: "demo-3",
    snapshot_number: 3,
    health_score: 55,
    verdict: "regressed",
    created_at: "2026-06-01T09:15:00Z",
    commit_message: "feat: added payment integration",
  },
  {
    id: "demo-4",
    snapshot_number: 4,
    health_score: 67,
    verdict: "improved",
    created_at: "2026-06-05T16:45:00Z",
    commit_message: "refactor: extracted auth into middleware",
  },
  {
    id: "demo-5",
    snapshot_number: 5,
    health_score: 74,
    verdict: "improved",
    created_at: "2026-06-10T11:00:00Z",
    commit_message: "fix: resolved 12 tech debt items",
  },
];

function getScoreColor(score: number) {
  if (score >= 75) return "#039a85";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function DemoTimeline() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 600;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const svgPoints = DEMO_DATA.map((point, index) => {
    const x =
      DEMO_DATA.length > 1
        ? paddingLeft + (index / (DEMO_DATA.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2;
    const y =
      paddingTop + chartHeight - (point.health_score / 100) * chartHeight;
    return { x, y, point };
  });

  let pathD = "";
  if (svgPoints.length > 1) {
    pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
    }
  }

  return (
    <div className="bg-[#272424] border border-white/10 rounded-xl p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-[#a39e9f] uppercase tracking-wider">
          Health Score Trend
        </h3>
        <div className="flex gap-3 text-[10px] text-ash">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#039a85]" />{" "}
            Excellent (≥75)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />{" "}
            Warning (50-74)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />{" "}
            Critical (&lt;50)
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible"
          >
            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map((score) => {
              const y =
                paddingTop + chartHeight - (score / 100) * chartHeight;
              return (
                <g key={score}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] font-mono font-medium"
                    fill="var(--color-ash)"
                  >
                    {score}
                  </text>
                </g>
              );
            })}

            {/* Area fill under the line */}
            {svgPoints.length > 1 && (
              <path
                d={`${pathD} L ${svgPoints[svgPoints.length - 1].x} ${paddingTop + chartHeight} L ${svgPoints[0].x} ${paddingTop + chartHeight} Z`}
                fill="url(#demo-gradient)"
                opacity={0.15}
              />
            )}

            {/* Gradient definition */}
            <defs>
              <linearGradient
                id="demo-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#039a85" />
                <stop offset="100%" stopColor="#039a85" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Line Path */}
            {svgPoints.length > 1 && (
              <path
                d={pathD}
                fill="none"
                stroke="#039a85"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Dots */}
            {svgPoints.map((pt, idx) => {
              const color = getScoreColor(pt.point.health_score);
              const isHovered = hoveredIndex === idx;

              return (
                <g key={pt.point.id}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    className="fill-transparent cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 4.5}
                    fill={color}
                    className="transition-all duration-150 cursor-pointer"
                    stroke="#272424"
                    strokeWidth={2}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  <text
                    x={pt.x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[9px] font-mono font-semibold"
                    fill="#5a5458"
                  >
                    #{pt.point.snapshot_number}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredIndex !== null && svgPoints[hoveredIndex] && (
        <div
          className="absolute bg-obsidian border border-white/10 rounded-xl shadow-lg p-3 z-10 w-52 pointer-events-none transition-all duration-100 animate-in fade-in zoom-in-95"
          style={{
            left: `${Math.min(
              75,
              Math.max(
                5,
                (svgPoints[hoveredIndex].x / width) * 100 - 12
              )
            )}%`,
            top: "5px",
          }}
        >
          <div className="flex items-center justify-between mb-1.5 border-b border-white/10 pb-1">
            <span className="text-xs font-bold text-paper-raised">
              Snapshot #{svgPoints[hoveredIndex].point.snapshot_number}
            </span>
            <span
              className="text-xs font-mono font-extrabold px-1.5 py-0.5 rounded"
              style={{
                color: getScoreColor(
                  svgPoints[hoveredIndex].point.health_score
                ),
                backgroundColor: `${getScoreColor(svgPoints[hoveredIndex].point.health_score)}15`,
              }}
            >
              {svgPoints[hoveredIndex].point.health_score}
            </span>
          </div>

          <div className="space-y-1 text-[10px] text-[#a39e9f]">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#5a5458]" />
              <span>
                {new Date(
                  svgPoints[hoveredIndex].point.created_at
                ).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center gap-1 capitalize">
              {svgPoints[hoveredIndex].point.verdict === "improved" && (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              )}
              {svgPoints[hoveredIndex].point.verdict === "regressed" && (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              {(svgPoints[hoveredIndex].point.verdict === "mixed" ||
                svgPoints[hoveredIndex].point.verdict === "no_change") && (
                <Minus className="w-3 h-3 text-slate-400" />
              )}
              <span className="font-semibold text-[#a39e9f]">
                {svgPoints[hoveredIndex].point.verdict.replace("_", " ")}
              </span>
            </div>

            <div className="border-t border-white/10 pt-1 mt-1 font-mono text-[9px] truncate text-ash">
              &quot;{svgPoints[hoveredIndex].point.commit_message}&quot;
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
