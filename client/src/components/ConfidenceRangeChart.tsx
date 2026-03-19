/**
 * ConfidenceRangeChart
 *
 * Visualizes 80% confidence ranges for projection dates using horizontal timeline bars.
 * Shows P10 (lower bound), P50 (median), and P90 (upper bound) with a visual bar.
 */

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

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-200">{item.label}</p>
              <p className="text-xs text-slate-400">{fmtDate(item.p50)}</p>
            </div>

            {/* Timeline container */}
            <div className="relative h-6 bg-slate-700/50 rounded border border-slate-600 overflow-hidden">
              {/* 80% range bar */}
              <div
                className="absolute h-full bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 border-l border-r border-emerald-400/60"
                style={{
                  left: `${p10Pos}%`,
                  width: `${barWidth}%`,
                }}
              />

              {/* P50 median marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-emerald-300 shadow-lg"
                style={{ left: `${p50Pos}%` }}
                title={`Median: ${fmtDate(item.p50)}`}
              />
            </div>

            {/* Range labels */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{fmtDate(item.p10)}</span>
              <span className="text-emerald-300 font-semibold">80% range</span>
              <span>{fmtDate(item.p90)}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-600 flex items-center gap-4 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 rounded border border-emerald-400/60" />
          <span>80% confidence range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 bg-emerald-300" />
          <span>Median (P50)</span>
        </div>
      </div>
    </div>
  );
}
