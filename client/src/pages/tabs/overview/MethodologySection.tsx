import type { Dispatch, SetStateAction } from "react";

import { TrustAndLimitationsPanel } from "@/components/TrackerEnhancements";
import type { SourceLink } from "@/components/trackerTypes";
import {
  DATA_FRESHNESS,
  HISTORICAL_BULLETINS,
  I140_Q3_RECEIPTS_INDIA,
  I485_INVENTORY,
  I485_PERFORMANCE,
} from "@/data/trackerData";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

type MethodologySectionProps = {
  showMethodology: boolean;
  setShowMethodology: Dispatch<SetStateAction<boolean>>;
  trackerSourceLinks: SourceLink[];
};

export function MethodologySection({
  showMethodology,
  setShowMethodology,
  trackerSourceLinks,
}: MethodologySectionProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">
          India I-140 receipt flow · {I140_Q3_RECEIPTS_INDIA.period}
        </p>
        <p className="mt-1">
          EB-1: {I140_Q3_RECEIPTS_INDIA.eb1.toLocaleString()} · EB-2:{" "}
          {I140_Q3_RECEIPTS_INDIA.eb2.toLocaleString()} · EB-3:{" "}
          {I140_Q3_RECEIPTS_INDIA.eb3.toLocaleString()}
          {" · "}Other workers (EW3): {I140_Q3_RECEIPTS_INDIA.ew3}
        </p>
        <p className="mt-1">
          {I140_Q3_RECEIPTS_INDIA.total.toLocaleString()} petitions received in
          Apr–Jun 2026. This measures new petition flow. It has no priority-date
          distribution and does not directly change the queue or forecast.{" "}
          <a
            className="text-blue-700 underline"
            href={I140_Q3_RECEIPTS_INDIA.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            USCIS source
          </a>
        </p>
      </div>
      <button
        onClick={() => setShowMethodology(v => !v)}
        aria-expanded={showMethodology}
        aria-controls="forecast-methodology"
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        {showMethodology ? "Hide" : "Show"} methodology
        {showMethodology ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {showMethodology && (
        <div
          id="forecast-methodology"
          className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2"
        >
          <p className="font-semibold text-slate-800">
            Probabilistic Dual-Cutoff Simulator ({DATA_FRESHNESS.modelVersion})
          </p>
          <p>
            Simulates both <strong>FAD and DoF month by month</strong>. Each
            future bulletin month samples from historical movement patterns
            instead of assuming one smooth, fixed rate.
          </p>
          <p>
            For each simulated month:{" "}
            <code className="bg-slate-200 px-1 rounded">
              delta = base_rate × (seasonality + residual sample) ÷ √(demand ÷
              ref)
            </code>
          </p>
          <p>
            <strong>Demand curve:</strong> Uses{" "}
            <strong>USCIS I-485 pending inventory</strong> (
            {I485_INVENTORY.asOf}) where available and falls back to{" "}
            <strong>I-140 approval counts</strong> (FY2026 Q3, grouped by
            receipt fiscal year) beyond inventory coverage. The fallback is
            scaled using the <strong>median overlap ratio</strong>, and demand
            ratios are clipped before applying the square-root slowdown.
          </p>
          <p>
            <strong>Incomplete inventory:</strong> EB-1 PD-2023 and EB-2/EB-3
            PD-2015 were only partly fileable at the snapshot date. They are
            excluded from overlap calibration and use the larger of filed
            inventory and the full-year proxy. Suppressed cells remain unknown;
            disclosed sums are lower bounds. Fiscal year is an approximate PD
            proxy, and FY2026 approval data covers only Q1–Q3.
          </p>
          <p>
            EB-2 approval counts include NIW petitions. EB-3 uses skilled
            workers and professionals, with other workers (EW3) excluded. The
            model responds to each year’s demand relative to the median, so a
            larger absolute queue does not necessarily move the forecast date.
          </p>
          <p>
            <strong>Green card receipt lag:</strong> The model uses a minimum of{" "}
            {I485_PERFORMANCE.derivedProcessingLagMonths} months from national
            FY2026 Q3 pending workload divided by quarterly completions. This is
            a workload assumption, not a measured India-specific processing
            time.
          </p>
          <p>
            <strong>Seasonality and volatility:</strong> Derived from{" "}
            {HISTORICAL_BULLETINS.length} months of verified bulletin data. Each
            FY-month has its own bucket of historical residuals, which means the
            live model can simulate both surges and retrogression.
          </p>
          <p>
            <strong>DoF model:</strong> Independent — DoF is simulated from its
            own historical movement series instead of being forced to equal FAD
            minus a fixed offset.
          </p>
          <p>
            Scenario assumptions in the Scenarios tab are unchanged. They still
            scale the base FAD rate through spillover, ban duration, and wastage
            multipliers before the simulator runs.
          </p>
          <p>
            Forecast cards show the <strong>median (P50)</strong> date plus an{" "}
            <strong>80% interval</strong>. The backtest badge reports 6-month
            FAD MAE and how often the actual bulletin landed inside the model's
            80% interval.
          </p>
          <p className="text-slate-400">
            Disclaimer: Estimates are probabilistic and may change with policy
            shifts, retrogression, or legislative action.
          </p>
        </div>
      )}
      <TrustAndLimitationsPanel sourceLinks={trackerSourceLinks} />
    </div>
  );
}
