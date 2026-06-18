"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

interface TimelinePoint {
  id: string;
  snapshot_number: number | null;
  health_score: number | null;
  verdict: "improved" | "regressed" | "mixed" | "no_change" | null;
  created_at: string;
  diff_id: string | null;
  commit_message?: string | null;
}

interface TimelineChartProps {
  points: TimelinePoint[];
  onPointClick?: (diffId: string) => void;
}

export function TimelineChart({ points, onPointClick }: TimelineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter out any points with missing health score
  const validPoints = points
    .filter((p): p is TimelinePoint & { health_score: number; snapshot_number: number } => 
      p.health_score !== null && p.snapshot_number !== null
    )
    .sort((a, b) => a.snapshot_number - b.snapshot_number);

  if (validPoints.length === 0) {
    return (
      <div className="bg-paper-raised border border-paper-sunken rounded-xl p-8 text-center text-xs text-ash">
        No trend data available yet.
      </div>
    );
  }

  // Chart configuration dimensions
  const width = 600;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Max score is 100, min is 0
  const maxScore = 100;
  const minScore = 0;

  // Map database coordinates to SVG points
  const svgPoints = validPoints.map((point, index) => {
    const x =
      validPoints.length > 1
        ? paddingLeft + (index / (validPoints.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2;
    const y =
      paddingTop +
      chartHeight -
      ((point.health_score - minScore) / (maxScore - minScore)) * chartHeight;
    return { x, y, point };
  });

  // Build the path string for the line
  let pathD = "";
  if (svgPoints.length > 1) {
    pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
    }
  }

  const handlePointClick = (point: typeof svgPoints[0]) => {
    if (point.point.diff_id && onPointClick) {
      onPointClick(point.point.diff_id);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "var(--color-obsidian)";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="bg-paper-raised border border-paper-sunken rounded-xl p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-ash uppercase tracking-wider">
          Health Score Trend
        </h3>
        <div className="flex gap-3 text-[10px] text-ash">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-obsidian" /> Excellent (≥75)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Warning (50-74)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Critical (&lt;50)
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map((score) => {
              const y = paddingTop + chartHeight - (score / 100) * chartHeight;
              return (
                <g key={score}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--color-paper-sunken)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] font-medium fill-[#837e80]"
                  >
                    {score}
                  </text>
                </g>
              );
            })}

            {/* Line Path */}
            {svgPoints.length > 1 && (
              <path
                d={pathD}
                fill="none"
                stroke="var(--color-obsidian)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-75"
              />
            )}

            {/* Data Dots */}
            {svgPoints.map((pt, idx) => {
              const color = getScoreColor(pt.point.health_score);
              const isHovered = hoveredIndex === idx;

              return (
                <g key={pt.point.id}>
                  {/* Invisible larger hover target */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    className="fill-transparent cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handlePointClick(pt)}
                  />
                  {/* Visible outer circle for hover */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 4.5}
                    fill={color}
                    className="transition-all duration-150 cursor-pointer stroke-white stroke-2"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handlePointClick(pt)}
                  />
                  {/* Axis label at bottom */}
                  <text
                    x={pt.x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[9px] fill-[#c0baba] font-semibold"
                  >
                    #{pt.point.snapshot_number}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Interactive Tooltip Card overlay on hover */}
      {hoveredIndex !== null && svgPoints[hoveredIndex] && (
        <div 
          className="absolute bg-paper-raised border border-paper-sunken rounded-xl shadow-lg p-3 z-10 w-48 pointer-events-none transition-all duration-100 animate-in fade-in zoom-in-95"
          style={{
            left: `${Math.min(
              width - 200,
              Math.max(
                10,
                (svgPoints[hoveredIndex].x / width) * 100 - 15
              )
            )}%`,
            top: "5px",
          }}
        >
          <div className="flex items-center justify-between mb-1.5 border-b border-[#F6F4F4] pb-1">
            <span className="text-xs font-bold text-obsidian">
              Snapshot #{svgPoints[hoveredIndex].point.snapshot_number}
            </span>
            <span 
              className="text-xs font-extrabold px-1.5 py-0.5 rounded"
              style={{ 
                color: getScoreColor(svgPoints[hoveredIndex].point.health_score),
                backgroundColor: `${getScoreColor(svgPoints[hoveredIndex].point.health_score)}15`
              }}
            >
              {svgPoints[hoveredIndex].point.health_score}
            </span>
          </div>

          <div className="space-y-1 text-[10px] text-ash">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-ash/70" />
              <span>
                {new Date(svgPoints[hoveredIndex].point.created_at).toLocaleDateString()}
              </span>
            </div>

            {svgPoints[hoveredIndex].point.verdict && (
              <div className="flex items-center gap-1 capitalize">
                {svgPoints[hoveredIndex].point.verdict === "improved" && (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                )}
                {svgPoints[hoveredIndex].point.verdict === "regressed" && (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                {(svgPoints[hoveredIndex].point.verdict === "mixed" || svgPoints[hoveredIndex].point.verdict === "no_change") && (
                  <Minus className="w-3 h-3 text-slate-500" />
                )}
                <span className="font-semibold text-[#5a5458]">
                  Verdict: {svgPoints[hoveredIndex].point.verdict.replace("_", " ")}
                </span>
              </div>
            )}

            {svgPoints[hoveredIndex].point.commit_message && (
              <div className="border-t border-[#F6F4F4] pt-1 mt-1 font-mono text-[9px] truncate text-ash">
                &quot;{svgPoints[hoveredIndex].point.commit_message}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
