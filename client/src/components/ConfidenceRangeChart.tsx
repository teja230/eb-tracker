/**
 * ConfidenceRangeChart
 *
 * Visualizes 80% confidence ranges for projection dates using horizontal timeline bars.
 * Shows P10 (lower bound), P50 (median), and P90 (upper bound) with interactive tooltips.
 */

import { useState } from 'react';
import { fmtDate } from '@/lib/trackerUtils';

interface RangeData {
  label: string;
  p10: Date;
  p50: Date;
  p90: Date;
}

interface ConfidenceRangeChartProps {
  data: RangeData[];
  minDate: Date;
  maxDate: Date;
}

export function ConfidenceRangeChart({ data, minDate, maxDate }: ConfidenceRangeChartProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const totalDays = maxDate.getTime() - minDate.getTime();

  const getPosition = (date: Date): number => {
    const daysFromStart = date.getTime() - minDate.getTime();
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
  };

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const p10Pos = getPosition(item.p10);
        const p50Pos = getPosition(item.p50);
        const p90Pos = getPosition(item.p90);
        const barWidth = p90Pos - p10Pos;
        const isHovered = hoveredBar === item.label;

        return (
          <div key={item.label} className="space-y-2">
            {/* Label */}
            <p className="text-sm font-semibold text-slate-100">{item.label}</p>

            {/* Timeline container with hover tooltip */}
            <div
              className="relative h-8 bg-slate-700/50 rounded border border-slate-600 overflow-visible cursor-pointer transition-all"
              onMouseEnter={() => setHoveredBar(item.label)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* 80% range bar */}
              <div
                className={`absolute h-full bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 border-l border-r border-emerald-400/60 rounded transition-all ${
                  isHovered ? 'from-emerald-500/60 to-emerald-400/60 shadow-lg shadow-emerald-500/20' : ''
                }`}
                style={{
                  left: `${p10Pos}%`,
                  width: `${barWidth}%`,
                }}
              />

              {/* P50 median marker */}
              <div
                className={`absolute top-0 bottom-0 w-1.5 bg-emerald-300 shadow-lg transition-all ${
                  isHovered ? 'w-2 shadow-emerald-400/50' : ''
                }`}
                style={{ left: `${p50Pos}%`, transform: 'translateX(-50%)' }}
              />

              {/* Hover tooltip */}
              {isHovered && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 whitespace-nowrap shadow-xl z-10 pointer-events-none">
                  <p className="font-semibold text-emerald-300">{fmtDate(item.p50)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    80% range: {fmtDate(item.p10)} to {fmtDate(item.p90)}
                  </p>
                </div>
              )}
            </div>

            {/* Compact range indicator below bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{fmtDate(item.p10)}</span>
              <span className="text-emerald-400 font-semibold">80% confidence</span>
              <span>{fmtDate(item.p90)}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-5 pt-3 border-t border-slate-600 flex items-center gap-4 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 rounded border border-emerald-400/60" />
          <span>Possible range (80%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-3 bg-emerald-300" />
          <span>Most likely date (median)</span>
        </div>
      </div>
    </div>
  );
}
