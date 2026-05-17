import { DateComparisonPanel } from "@/components/DateComparisonPanel";
import type { TrackerCategoryKey } from "@/data/trackerData";
import type { UseForecastDataResult } from "@/hooks/useForecastData";
import type { TrackerCategory } from "@/pages/homeShared";

type CompareTabProps = Pick<
  UseForecastDataResult,
  | "adjustedRates"
  | "forecastContext"
  | "forecastPolicies"
  | "forecastStartMonthIndex"
> & {
  cat: TrackerCategory;
  selectedCategory: TrackerCategoryKey;
  targetDate: string;
};

export function CompareTab({
  adjustedRates,
  cat,
  forecastContext,
  forecastPolicies,
  forecastStartMonthIndex,
  selectedCategory,
  targetDate,
}: CompareTabProps) {
  return (
    <div className="space-y-6">
      <DateComparisonPanel
        primaryDate={targetDate}
        cat={cat}
        selectedCategory={selectedCategory}
        forecastContext={forecastContext}
        forecastStartMonthIndex={forecastStartMonthIndex}
        forecastPolicies={forecastPolicies}
        adjustedRates={adjustedRates}
      />

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="text-xs font-bold text-blue-800 mb-1">How to use</h3>
        <ul className="text-[11px] text-blue-700 space-y-1 list-disc pl-4">
          <li>
            Select a second date or use the <strong>shortcuts</strong> (+1yr,
            +2yr) to quickly shift the comparison.
          </li>
          <li>
            Toggle between <strong>scenarios</strong> (Optimistic, Base,
            Conservative) to see how policy shifts affect both dates.
          </li>
          <li>
            The <strong>Δ column</strong> shows the projected time difference
            between the two dates for FAD, DoF, and GC approval.
          </li>
          <li>
            A <strong>magnitude bar</strong> next to the difference indicates
            the scale of the gap relative to a 5-year window.
          </li>
        </ul>
      </div>
    </div>
  );
}
