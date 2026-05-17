import {
  useMemo,
  useState,
  useDeferredValue,
  useEffect,
  useCallback,
} from "react";

import {
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  Calendar,
  Copy,
  Check,
} from "lucide-react";

import PriorityDatePicker from "@/components/PriorityDatePicker";
import { Card } from "@/components/ui/card";
import type { TrackerCategoryKey } from "@/data/trackerData";
import {
  type ForecastContext,
  type ForecastPolicy,
  type ForecastProjection,
  forecastScenario,
} from "@/lib/forecast";
import { fmtDate } from "@/lib/trackerUtils";
import {
  fmtProjectionDate,
  fmtProjectionDateRange,
  TODAY,
  type ScenarioKey,
  type TrackerCategory,
} from "@/pages/homeShared";

const SCENARIO_LABELS: Record<string, string> = {
  optimistic: "Optimistic",
  base: "Base",
  conservative: "Conservative",
};
const SHOWN_SCENARIOS: ScenarioKey[] = ["optimistic", "base", "conservative"];

type Props = {
  primaryDate: string;
  cat: TrackerCategory;
  selectedCategory: TrackerCategoryKey;
  forecastContext: ForecastContext;
  forecastStartMonthIndex: number;
  forecastPolicies: Record<ScenarioKey, ForecastPolicy>;
  adjustedRates: Record<ScenarioKey, number>;
};

function runProjection(
  targetDate: string,
  cat: TrackerCategory,
  forecastContext: ForecastContext,
  forecastStartMonthIndex: number,
  forecastPolicies: Record<ScenarioKey, ForecastPolicy>,
  adjustedRates: Record<ScenarioKey, number>,
  scenario: ScenarioKey
): ForecastProjection {
  return forecastScenario({
    context: forecastContext,
    today: TODAY,
    currentFad: cat.currentFAD,
    currentDof: cat.currentDoF,
    targetDate,
    baseFadRate: adjustedRates[scenario],
    gcLagMonths: cat.gcLagMonths,
    seasonalityStartMonth: forecastStartMonthIndex,
    policy: forecastPolicies[scenario],
    paths: 500,
    maxMonths: 240,
    seed: `compare-${scenario}-${targetDate}`,
  });
}

function monthsDiff(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

function fmtDelta(months: number): { text: string; cls: string; sub: string } {
  if (months === 0)
    return { text: "Same", cls: "text-slate-500", sub: "identical" };
  const abs = Math.abs(months);
  const years = Math.floor(abs / 12);
  const remainingMonths = abs % 12;

  let timeStr = "";
  if (years > 0) {
    timeStr += `${years}y`;
    if (remainingMonths > 0) timeStr += ` ${remainingMonths}mo`;
  } else {
    timeStr += `${remainingMonths}mo`;
  }

  if (months > 0)
    return {
      text: `+${timeStr}`,
      cls: "text-rose-600 dark:text-rose-400",
      sub: "later",
    };
  return {
    text: `-${timeStr}`,
    cls: "text-emerald-600 dark:text-emerald-400",
    sub: "earlier",
  };
}

function fmtProjectionDateSafe(
  proj: ForecastProjection,
  field: "fad" | "dof" | "gc"
): { text: string; capped: boolean } {
  if (proj.isAlreadyCurrent) return { text: "Already current", capped: false };
  const horizon = proj.horizon;
  const capped =
    field === "fad"
      ? horizon.fadP50Capped
      : field === "dof"
        ? horizon.dofP50Capped
        : horizon.gcP50Capped;
  const date =
    field === "fad"
      ? proj.fadDate
      : field === "dof"
        ? proj.dofDate
        : proj.gcDate;
  return { text: fmtProjectionDate(date, capped), capped };
}

function getDate(
  proj: ForecastProjection,
  field: "fad" | "dof" | "gc"
): Date | null {
  if (proj.isAlreadyCurrent) return null;
  return field === "fad"
    ? proj.fadDate
    : field === "dof"
      ? proj.dofDate
      : proj.gcDate;
}

function getRangeText(
  proj: ForecastProjection,
  field: "fad" | "dof" | "gc"
): string | null {
  if (proj.isAlreadyCurrent) return null;
  const range =
    field === "fad"
      ? proj.fadRange
      : field === "dof"
        ? proj.dofRange
        : proj.gcRange;
  const p90Capped =
    field === "fad"
      ? proj.horizon.fadP90Capped
      : field === "dof"
        ? proj.horizon.dofP90Capped
        : proj.horizon.gcP90Capped;
  return fmtProjectionDateRange(range.p10, range.p90, p90Capped);
}

function addMonthsToYMD(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateComparisonPanel({
  primaryDate,
  cat,
  selectedCategory,
  forecastContext,
  forecastStartMonthIndex,
  forecastPolicies,
  adjustedRates,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [compareDate, setCompareDate] = useState<string>(() => {
    return addMonthsToYMD(primaryDate, 24);
  });
  const deferredCompareDate = useDeferredValue(compareDate);
  const isCalculating = compareDate !== deferredCompareDate;

  // Keep compareDate in sync when the user changes their primary date
  useEffect(() => {
    setCompareDate(prev => {
      // Preserve the user's chosen offset from the new primaryDate
      const oldGap = monthsDiff(
        parseDateFromYMD(primaryDate),
        parseDateFromYMD(prev)
      );
      return addMonthsToYMD(primaryDate, Math.max(0, oldGap));
    });
  }, [primaryDate]);

  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("base");
  const [copied, setCopied] = useState(false);

  // Raw priority-date gap (not projection-based) for the header summary
  const rawDateGap = useMemo(() => {
    const p = parseDateFromYMD(primaryDate);
    const c = parseDateFromYMD(deferredCompareDate);
    return monthsDiff(p, c);
  }, [primaryDate, deferredCompareDate]);

  const projections = useMemo(() => {
    const run = (date: string) =>
      runProjection(
        date,
        cat,
        forecastContext,
        forecastStartMonthIndex,
        forecastPolicies,
        adjustedRates,
        activeScenario
      );
    return { primary: run(primaryDate), compare: run(deferredCompareDate) };
  }, [
    primaryDate,
    deferredCompareDate,
    cat,
    forecastContext,
    forecastStartMonthIndex,
    forecastPolicies,
    adjustedRates,
    activeScenario,
    selectedCategory,
  ]);

  const rows: Array<{
    label: string;
    field: "fad" | "dof" | "gc";
    tooltip: string;
  }> = [
    {
      label: "Final Action Date",
      field: "fad",
      tooltip: "When your priority date becomes current",
    },
    {
      label: "Date for Filing",
      field: "dof",
      tooltip: "When you may file I-485",
    },
    {
      label: "GC Approval",
      field: "gc",
      tooltip: "Estimated green card approval",
    },
  ];

  const shortcuts = [
    { label: "Same", months: 0 },
    { label: "-2yr", months: -24 },
    { label: "-1yr", months: -12 },
    { label: "+1yr", months: 12 },
    { label: "+2yr", months: 24 },
    { label: "+5yr", months: 60 },
  ];

  const copyComparison = useCallback(() => {
    const FIELDS: Array<{ label: string; field: "fad" | "dof" | "gc" }> = [
      { label: "Final Action Date", field: "fad" },
      { label: "Date for Filing", field: "dof" },
      { label: "GC Approval", field: "gc" },
    ];
    const lines = [
      `EB Tracker: Priority Date Comparison (${SCENARIO_LABELS[activeScenario]} scenario)`,
      `Your Date: ${fmtDate(parseDateFromYMD(primaryDate))}  |  Compare: ${fmtDate(parseDateFromYMD(deferredCompareDate))}`,
      "",
      ...FIELDS.map(({ label, field }) => {
        const pd = fmtProjectionDateSafe(projections.primary, field).text;
        const cd = fmtProjectionDateSafe(projections.compare, field).text;
        const p = getDate(projections.primary, field);
        const c = getDate(projections.compare, field);
        const d = p && c ? fmtDelta(monthsDiff(p, c)).text : "N/A";
        return `${label.padEnd(22)} | ${pd.padEnd(14)} | ${cd.padEnd(14)} | Δ ${d}`;
      }),
      "",
      `Source: eb-tracker`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [primaryDate, deferredCompareDate, projections, activeScenario]);

  return (
    <Card className="overflow-hidden border-slate-200 shadow-md">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <GitCompareArrows className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-none">
              Side-by-Side Comparison
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              Comparing priority dates for {cat.label} India
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-5 space-y-6">
          {/* Copy button row */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={copyComparison}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md border transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Copy comparison to clipboard"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? "Copied!" : "Copy comparison"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Date (Read-only reference) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Your Primary Date
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 leading-none">
                    {fmtDate(parseDateFromYMD(primaryDate))}
                  </p>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/50 mt-1 font-bold">
                    ESTIMATE BASELINE
                  </p>
                </div>
                {rawDateGap !== 0 && (
                  <div
                    className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                      rawDateGap > 0
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}
                  >
                    {fmtDelta(rawDateGap).text} priority gap
                  </div>
                )}
              </div>
            </div>

            {/* Compare Date Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Compare With
                </div>
                <div className="flex items-center gap-1">
                  {shortcuts.map(s => (
                    <button
                      key={s.label}
                      onClick={() =>
                        setCompareDate(addMonthsToYMD(primaryDate, s.months))
                      }
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors border ${
                        compareDate === addMonthsToYMD(primaryDate, s.months)
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-blue-500 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative group">
                <PriorityDatePicker
                  value={compareDate}
                  onChange={setCompareDate}
                />
                <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-widest">
                    Adjustable
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scenario Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <div className="max-w-md">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-1">
                Forecast Scenario
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {activeScenario === "optimistic"
                  ? "Optimistic case: Assumes high spillover, rapid ban reversal, and minimal processing wastage."
                  : activeScenario === "conservative"
                    ? "Conservative case: Assumes low spillover, sustained ban, and moderate processing delays."
                    : "Base case: Our median expectation based on current policy and historical movement patterns."}
              </p>
            </div>
            <div className="flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm shrink-0">
              {SHOWN_SCENARIOS.map(s => (
                <button
                  key={s}
                  onClick={() => setActiveScenario(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeScenario === s
                      ? "bg-slate-900 text-white shadow-lg scale-105"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Result Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm relative">
            {isCalculating && (
              <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold text-[10px] shadow-sm uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                  Recalculating 500 paths...
                </div>
              </div>
            )}
            <table
              aria-live="polite"
              aria-busy={isCalculating}
              className={`w-full text-sm border-collapse min-w-[500px] transition-opacity ${isCalculating ? "opacity-50" : "opacity-100"}`}
            >
              <caption className="sr-only">
                Side-by-side priority date comparison:{" "}
                {fmtDate(parseDateFromYMD(primaryDate))} vs{" "}
                {fmtDate(parseDateFromYMD(deferredCompareDate))} under{" "}
                {SCENARIO_LABELS[activeScenario]} scenario
              </caption>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] font-black border-b border-slate-200 dark:border-slate-700">
                  <th scope="col" className="text-left px-4 py-3 font-black">
                    Milestone
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-black">
                    Your Date
                  </th>
                  <th scope="col" className="text-center px-4 py-3 font-black">
                    Compare
                  </th>
                  <th scope="col" className="text-right px-4 py-3 font-black">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map(({ label, field, tooltip }) => {
                  const primary = fmtProjectionDateSafe(
                    projections.primary,
                    field
                  );
                  const compare = fmtProjectionDateSafe(
                    projections.compare,
                    field
                  );
                  const pd = getDate(projections.primary, field);
                  const cd = getDate(projections.compare, field);
                  const delta = pd && cd ? monthsDiff(pd, cd) : null;
                  const d = delta != null ? fmtDelta(delta) : null;
                  const primaryRange = getRangeText(projections.primary, field);
                  const compareRange = getRangeText(projections.compare, field);

                  return (
                    <tr
                      key={field}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                      title={tooltip}
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {label}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">
                          {tooltip}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p
                          className={`font-black font-mono text-base whitespace-nowrap ${primary.capped ? "text-slate-400" : "text-slate-800 dark:text-slate-100"}`}
                        >
                          {primary.text}
                        </p>
                        {primaryRange && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap font-mono">
                            {primaryRange}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p
                          className={`font-black font-mono text-base whitespace-nowrap ${compare.capped ? "text-slate-400" : "text-blue-600 dark:text-blue-400"}`}
                        >
                          {compare.text}
                        </p>
                        {compareRange && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap font-mono">
                            {compareRange}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {d ? (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2">
                              {delta != null && delta !== 0 && (
                                <div className="h-1.5 w-12 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex justify-end">
                                  <div
                                    className={`h-full ${delta > 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                                    style={{
                                      width: `${Math.min(100, (Math.abs(delta) / 60) * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}
                              <span
                                className={`text-sm font-black font-mono whitespace-nowrap ${d.cls}`}
                              >
                                {d.text}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              {d.sub}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 font-bold uppercase tracking-wider">
              Simulation Data: {SCENARIO_LABELS[activeScenario]} assumptions ·
              500 paths · Updated live
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function parseDateFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
