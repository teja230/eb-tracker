import type { Dispatch, SetStateAction } from "react";

import { TrustAndLimitationsPanel } from "@/components/TrackerEnhancements";
import type { SourceLink } from "@/components/trackerTypes";
import { HISTORICAL_BULLETINS } from "@/data/trackerData";
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
      <button
        onClick={() => setShowMethodology(v => !v)}
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
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800">
            Probabilistic Dual-Cutoff Simulator (v8)
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
            <strong>USCIS I-485 pending inventory</strong> (Oct 2025) where
            available and falls back to <strong>I-140 approval counts</strong>{" "}
            (FY2025 Q3) beyond inventory coverage. The fallback is scaled using
            the <strong>median overlap ratio</strong>, and demand ratios are
            clipped before applying the square-root slowdown.
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
