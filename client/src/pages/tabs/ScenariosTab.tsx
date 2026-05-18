import { Card } from "@/components/ui/card";
import { Download, ChevronDown } from "lucide-react";

import { SCENARIOS, type TrackerCategoryKey } from "@/data/trackerData";
import type { BacktestSummary } from "@/lib/forecast";
import { fmtDateStr } from "@/lib/trackerUtils";
import type { UseForecastDataResult } from "@/hooks/useForecastData";
import {
  fmtProjectionDate,
  fmtProjectionDateRange,
  fmtProjectionDuration,
  fmtSensitivityDelta,
  type TrackerCategory,
} from "@/pages/homeShared";

type ScenariosTabProps = Pick<
  UseForecastDataResult,
  | "adjustedRates"
  | "overviewAssumptionSummary"
  | "projections"
  | "sensitivityByOption"
  | "sensitivityRows"
> & {
  backtestResult: BacktestSummary;
  banContinues: "2027" | "2028" | "2029";
  cat: TrackerCategory;
  generateExport: () => Promise<void> | void;
  isAssumptionPending: boolean;
  selectedCategory: TrackerCategoryKey;
  spilloverLevel: "low" | "moderate" | "high";
  targetDate: string;
  updateBanContinues: (value: "2027" | "2028" | "2029") => void;
  updateSpilloverLevel: (value: "low" | "moderate" | "high") => void;
  updateWastageLevel: (value: "low" | "moderate" | "high") => void;
  wastageLevel: "low" | "moderate" | "high";
};

export function ScenariosTab({
  adjustedRates,
  banContinues,
  cat,
  generateExport,
  projections,
  sensitivityByOption,
  spilloverLevel,
  targetDate,
  updateBanContinues,
  updateSpilloverLevel,
  updateWastageLevel,
  wastageLevel,
}: ScenariosTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="text-base">&#9881;&#65039;</span>
              Assumptions &amp; Scenario Projections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tune policy controls, inspect base-case sensitivity, and compare
              scenario results in one view.
            </p>
          </div>
          <button
            onClick={generateExport}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 border border-slate-800 rounded-lg shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Spillover Level
              </label>
              <div className="space-y-2">
                {[
                  {
                    val: "low" as const,
                    sensitivity: "Low",
                    label: "Low (~30k extra EB visas)",
                    sub: "Partial ban, limited spillover",
                  },
                  {
                    val: "moderate" as const,
                    sensitivity: "Moderate",
                    label: "Moderate (~50k extra)",
                    sub: "Base case assumption",
                  },
                  {
                    val: "high" as const,
                    sensitivity: "High",
                    label: "High (~70k+ extra)",
                    sub: "Full ban, max spillover",
                  },
                ].map(o => {
                  const selected = spilloverLevel === o.val;
                  const sensitivity = sensitivityByOption.get(
                    `Spillover:${o.sensitivity}`
                  );
                  return (
                    <button
                      key={o.val}
                      onClick={() => updateSpilloverLevel(o.val)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    >
                      <div className="font-semibold">{o.label}</div>
                      <div
                        className={
                          selected ? "text-slate-300" : "text-slate-400"
                        }
                      >
                        {o.sub}
                      </div>
                      {sensitivity && (
                        <div
                          className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? "border-white/15" : "border-slate-100"}`}
                        >
                          <span
                            className={`font-mono text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}
                          >
                            FAD {sensitivity.dateLabel}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/15 text-white" : sensitivity.deltaMonths <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {fmtSensitivityDelta(sensitivity.deltaMonths)}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Ban Duration
              </label>
              <div className="space-y-2">
                {[
                  {
                    val: "2027" as const,
                    sensitivity: "Through 2027",
                    label: "Ends Oct 2027 (1 FY)",
                    sub: "Court reversal (CLINIC v. Rubio pending)",
                  },
                  {
                    val: "2028" as const,
                    sensitivity: "Through 2028",
                    label: "Through Sept 2028 (2 FY)",
                    sub: "Base case — sustained policy",
                  },
                  {
                    val: "2029" as const,
                    sensitivity: "Through 2029",
                    label: "Through Sept 2029 (3 FY)",
                    sub: "Full term continuation",
                  },
                ].map(o => {
                  const selected = banContinues === o.val;
                  const sensitivity = sensitivityByOption.get(
                    `Ban duration:${o.sensitivity}`
                  );
                  return (
                    <button
                      key={o.val}
                      onClick={() => updateBanContinues(o.val)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    >
                      <div className="font-semibold">{o.label}</div>
                      <div
                        className={
                          selected ? "text-slate-300" : "text-slate-400"
                        }
                      >
                        {o.sub}
                      </div>
                      {sensitivity && (
                        <div
                          className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? "border-white/15" : "border-slate-100"}`}
                        >
                          <span
                            className={`font-mono text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}
                          >
                            FAD {sensitivity.dateLabel}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/15 text-white" : sensitivity.deltaMonths <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {fmtSensitivityDelta(sensitivity.deltaMonths)}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                GC Wastage Level
              </label>
              <div className="space-y-2">
                {[
                  {
                    val: "low" as const,
                    sensitivity: "Low",
                    label: "Low (5–10%)",
                    sub: "Efficient consular processing",
                  },
                  {
                    val: "moderate" as const,
                    sensitivity: "Moderate",
                    label: "Moderate (15–20%)",
                    sub: "Typical processing friction",
                  },
                  {
                    val: "high" as const,
                    sensitivity: "High",
                    label: "High (25–30%)",
                    sub: "Systemic delays (as in FY2021)",
                  },
                ].map(o => {
                  const selected = wastageLevel === o.val;
                  const sensitivity = sensitivityByOption.get(
                    `Wastage:${o.sensitivity}`
                  );
                  return (
                    <button
                      key={o.val}
                      onClick={() => updateWastageLevel(o.val)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    >
                      <div className="font-semibold">{o.label}</div>
                      <div
                        className={
                          selected ? "text-slate-300" : "text-slate-400"
                        }
                      >
                        {o.sub}
                      </div>
                      {sensitivity && (
                        <div
                          className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? "border-white/15" : "border-slate-100"}`}
                        >
                          <span
                            className={`font-mono text-[11px] ${selected ? "text-slate-200" : "text-slate-500"}`}
                          >
                            FAD {sensitivity.dateLabel}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/15 text-white" : sensitivity.deltaMonths <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {fmtSensitivityDelta(sensitivity.deltaMonths)}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 list-none select-none">
              <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
              About these assumptions
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-800 mb-1">
                  75-Country Visa Ban
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Proclamations 10949 & 10998 (Jan 2026) indefinitely paused
                  immigrant visas for 75+ countries. India is{" "}
                  <strong>exempt</strong>. Unused family-based visas spill over
                  to EB categories under INA §201(d). Challenged in{" "}
                  <em>CLINIC v. Rubio</em> (SDNY, Feb 2026).
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Est. FY2027 spillover:{" "}
                  <span className="font-semibold text-slate-700">
                    50k–70k extra EB visas
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-800 mb-1">
                  Green Card Wastage
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Visas go unused due to processing friction — medical exams,
                  security clearances, or interview windows. FY2021: 25% wastage
                  (66k of 262k). FY2022: near 0% after USCIS reforms.
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Higher supply + processing gaps ={" "}
                  <span className="font-semibold text-amber-600">
                    more wastage risk
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-800 mb-1">
                  How the Model Works
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Runs 500 simulated bulletin paths per scenario. Each month
                  samples historical movement, then adjusts for demand density
                  before applying the same spillover, ban-duration, and wastage
                  controls shown above.
                </p>
                <div className="mt-2 text-xs text-slate-500 font-mono bg-white rounded px-2 py-1 leading-relaxed">
                  each month: rate × (season + residual sample) × assumptions ÷
                  sqrt(density)
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/70">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Results — {cat.label} India · PD {fmtDateStr(targetDate)}
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              Object.entries(SCENARIOS) as Array<
                [
                  keyof typeof SCENARIOS,
                  (typeof SCENARIOS)[keyof typeof SCENARIOS],
                ]
              >
            ).map(([key, s]) => {
              const p = projections[key];
              return (
                <div
                  key={key}
                  className="rounded-xl border-l-4 border border-slate-200 bg-slate-50/50 p-5"
                  style={{ borderLeftColor: s.color }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{s.label}</h3>
                      <p className="text-xs text-slate-500">
                        {s.probability} probability
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                      {adjustedRates[key]} PD-mo/mo
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">{s.description}</p>
                  <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500 mb-0.5">DoF P50</p>
                      <p className="font-bold font-mono text-slate-900">
                        {p.isAlreadyCurrent
                          ? "Current"
                          : fmtProjectionDate(
                              p.dofDate,
                              p.horizon.dofP50Capped
                            )}
                      </p>
                      {!p.isAlreadyCurrent && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {fmtProjectionDateRange(
                            p.dofRange.p10,
                            p.dofRange.p90,
                            p.horizon.dofP90Capped
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">FAD P50</p>
                      <p className="font-bold font-mono text-slate-900">
                        {p.isAlreadyCurrent
                          ? "Current"
                          : fmtProjectionDate(
                              p.fadDate,
                              p.horizon.fadP50Capped
                            )}
                      </p>
                      {!p.isAlreadyCurrent && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {fmtProjectionDateRange(
                            p.fadRange.p10,
                            p.fadRange.p90,
                            p.horizon.fadP90Capped
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">GC P50</p>
                      <p className="font-bold font-mono text-slate-900">
                        {p.isAlreadyCurrent
                          ? "Current"
                          : fmtProjectionDate(p.gcDate, p.horizon.gcP50Capped)}
                      </p>
                      {!p.isAlreadyCurrent && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {fmtProjectionDateRange(
                            p.gcRange.p10,
                            p.gcRange.p90,
                            p.horizon.gcP90Capped
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 flex items-center justify-between gap-2">
                    <span>
                      {p.isAlreadyCurrent
                        ? "Already current"
                        : `FAD median in ${fmtProjectionDuration(p.monthsFromToday, p.horizon.fadP50Capped)}`}
                    </span>
                    <span>
                      Near-term risk {Math.round(p.nearTermRisk * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Model Ranges (80% interval)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">
              {cat.label} India forecast date ranges by scenario
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Scenario
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  DoF Range
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  FAD Range
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  GC Range
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Near-Term Risk
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Retro Shock
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Probability
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                Object.entries(SCENARIOS) as Array<
                  [
                    keyof typeof SCENARIOS,
                    (typeof SCENARIOS)[keyof typeof SCENARIOS],
                  ]
                >
              ).map(([key, s]) => {
                const p = projections[key];
                return (
                  <tr
                    key={key}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td
                      className="px-3 py-2 font-semibold"
                      style={{ color: s.color }}
                    >
                      {s.label}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {p.isAlreadyCurrent
                        ? "Current"
                        : fmtProjectionDateRange(
                            p.dofRange.p10,
                            p.dofRange.p90,
                            p.horizon.dofP90Capped
                          )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {p.isAlreadyCurrent
                        ? "Current"
                        : fmtProjectionDateRange(
                            p.fadRange.p10,
                            p.fadRange.p90,
                            p.horizon.fadP90Capped
                          )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {p.isAlreadyCurrent
                        ? "Current"
                        : fmtProjectionDateRange(
                            p.gcRange.p10,
                            p.gcRange.p90,
                            p.horizon.gcP90Capped
                          )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {Math.round(p.nearTermRisk * 100)}%
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {Math.round(p.retrogressionRisk * 100)}%
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {s.probability}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Ranges are generated from 500 simulated bulletin paths per scenario
          using the same engine used in the live forecast cards.
        </p>
      </Card>
    </div>
  );
}
