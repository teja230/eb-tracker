import { CheckCircle2, Info, SlidersHorizontal } from "lucide-react";

import { ConfidenceRangeChart } from "@/components/ConfidenceRangeChart";
import { CURRENT_BULLETIN } from "@/data/trackerData";
import type { BacktestSummary, ForecastProjection } from "@/lib/forecast";
import { fmtDateStr, fmtDuration } from "@/lib/trackerUtils";
import {
  fmtProjectionDate,
  fmtProjectionDateRange,
  fmtProjectionDuration,
} from "@/pages/homeShared";

type ProjectionHeroCardProps = {
  overviewProjection: ForecastProjection;
  backtestResult: BacktestSummary;
  targetDate: string;
  overviewAssumptionSummary: string;
  onCompare?: () => void;
  onAdjustAssumptions?: () => void;
};

export function ProjectionHeroCard({
  overviewProjection,
  backtestResult,
  targetDate,
  overviewAssumptionSummary,
  onCompare,
  onAdjustAssumptions,
}: ProjectionHeroCardProps) {
  if (overviewProjection.isAlreadyCurrent) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
        <p className="text-xl font-bold text-emerald-700">Already Current!</p>
        <p className="text-sm text-slate-600 mt-1">
          {fmtDateStr(targetDate)} is already current as of the{" "}
          {CURRENT_BULLETIN.month} bulletin.
        </p>
      </div>
    );
  }

  return (
    <div className="relative -mt-2 overflow-hidden rounded-xl border border-slate-600/80 border-l-4 border-l-emerald-400 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 p-6 text-white md:-mt-0">
      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
          Your Projection
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {onCompare && (
            <button
              onClick={onCompare}
              className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:text-emerald-200"
            >
              ⚖️ Compare dates
            </button>
          )}
          {onAdjustAssumptions && (
            <button
              onClick={onAdjustAssumptions}
              className="inline-flex items-center gap-1.5 rounded border border-slate-400/40 bg-white/8 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:border-slate-300/60 hover:text-white"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Adjust assumptions
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-mono text-slate-300">
          {fmtDateStr(targetDate)}
        </span>
        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100">
          Best Case
        </span>
      </div>
      {overviewProjection.isCurrentlyUnavailable && (
        <div className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          Current FAD is unavailable; this forecast holds FAD movement for{" "}
          {overviewProjection.currentUnavailabilityHoldMonths} bulletin month
          {overviewProjection.currentUnavailabilityHoldMonths === 1
            ? ""
            : "s"}{" "}
          before modeling FY2027 recovery.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
            Filing Date (DoF)
          </p>
          <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
            {fmtProjectionDate(
              overviewProjection.dofDate,
              overviewProjection.horizon.dofP50Capped
            )}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
          <p className="mt-1 text-[11px] text-slate-300">
            80% range:{" "}
            {fmtProjectionDateRange(
              overviewProjection.dofRange.p10,
              overviewProjection.dofRange.p90,
              overviewProjection.horizon.dofP90Capped
            )}
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
            Final Action Date
          </p>
          <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
            {fmtProjectionDate(
              overviewProjection.fadDate,
              overviewProjection.horizon.fadP50Capped
            )}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
          <p className="mt-1 text-[11px] text-slate-300">
            80% range:{" "}
            {fmtProjectionDateRange(
              overviewProjection.fadRange.p10,
              overviewProjection.fadRange.p90,
              overviewProjection.horizon.fadP90Capped
            )}
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
            GC Receipt Est.
          </p>
          <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
            {fmtProjectionDate(
              overviewProjection.gcDate,
              overviewProjection.horizon.gcP50Capped
            )}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
          <p className="mt-1 text-[11px] text-slate-300">
            80% range:{" "}
            {fmtProjectionDateRange(
              overviewProjection.gcRange.p10,
              overviewProjection.gcRange.p90,
              overviewProjection.horizon.gcP90Capped
            )}
          </p>
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
            Time to FAD
          </p>
          <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
            {fmtProjectionDuration(
              overviewProjection.monthsFromToday,
              overviewProjection.horizon.fadP50Capped
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">Best case median</p>
          <p className="mt-1 text-[11px] text-slate-300">
            80% range:{" "}
            {fmtDuration(Math.round(overviewProjection.fadMonths.p10))} -{" "}
            {fmtProjectionDuration(
              Math.round(overviewProjection.fadMonths.p90),
              overviewProjection.horizon.fadP90Capped
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-600">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-300">
          80% Confidence Timeline
        </p>
        <ConfidenceRangeChart
          data={[
            {
              label: "Filing Date (DoF)",
              p10: overviewProjection.dofRange.p10,
              p50: overviewProjection.dofDate,
              p90: overviewProjection.dofRange.p90,
            },
            {
              label: "Final Action Date (FAD)",
              p10: overviewProjection.fadRange.p10,
              p50: overviewProjection.fadDate,
              p90: overviewProjection.fadRange.p90,
            },
            {
              label: "GC Receipt Estimate",
              p10: overviewProjection.gcRange.p10,
              p50: overviewProjection.gcDate,
              p90: overviewProjection.gcRange.p90,
            },
          ]}
          minDate={overviewProjection.dofRange.p10}
          maxDate={overviewProjection.gcRange.p90}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-slate-600 pt-3 text-xs text-slate-300 md:flex-row md:items-center md:justify-between">
        <p>
          Best case uses the optimistic scenario with{" "}
          {overviewAssumptionSummary}. See Scenarios tab for the full range.
        </p>
        <div className="flex items-center gap-3 text-[10px] shrink-0">
          {backtestResult.predictions > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
              title={`6-month backtest on ${backtestResult.predictions} rolling windows`}
            >
              <Info className="w-3 h-3" />
              MAE: ±{backtestResult.mae} mo
            </span>
          )}
          {backtestResult.predictions > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
              title="Share of 6-month backtest windows where the actual FAD landed inside the model's 80% interval"
            >
              80% hit: {Math.round(backtestResult.coverage80 * 100)}%
            </span>
          )}
          <span
            className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
            title="Share of simulated paths with a near-term stall, unavailability, or bounded retrogression event in the next 12 bulletin months"
          >
            Near-term risk: {Math.round(overviewProjection.nearTermRisk * 100)}%
          </span>
          <span
            className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
            title="Share of simulated paths with a bounded one-time backward FAD movement"
          >
            Retro shock:{" "}
            {Math.round(overviewProjection.retrogressionRisk * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
