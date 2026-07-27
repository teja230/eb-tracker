import type { RefObject } from "react";

import type {
  HistoricalBulletinRow,
  TrackerCategoryKey,
} from "@/data/trackerData";
import {
  rowCutoffDateLabel,
  rowCutoffMovement,
  rowCutoffStatus,
} from "@/lib/bulletinStatus";
import {
  areConsecutiveBulletinMonths,
  movementLabel,
  parseDateStr,
} from "@/lib/trackerUtils";

type DateKind = "fad" | "dof";
type CategoryDateKey =
  | "eb1_fad"
  | "eb1_dof"
  | "eb2_fad"
  | "eb2_dof"
  | "eb3_fad"
  | "eb3_dof";

const DAY_MS = 86400000;

function selectedColumn(category: TrackerCategoryKey): number {
  if (category === "EB1") return 0;
  if (category === "EB3") return 2;
  return 1;
}

function categoryDateKey(
  category: TrackerCategoryKey,
  kind: DateKind
): CategoryDateKey {
  if (category === "EB1") return kind === "fad" ? "eb1_fad" : "eb1_dof";
  if (category === "EB3") return kind === "fad" ? "eb3_fad" : "eb3_dof";
  return kind === "fad" ? "eb2_fad" : "eb2_dof";
}

function fiscalYear(month: string): string {
  const parts = month.split(" ");
  const year = Number(parts[parts.length - 1]);
  const monthLabel = parts[0];
  return `FY${["Oct", "Nov", "Dec"].includes(monthLabel) ? year + 1 : year}`;
}

function groupByFiscalYear(rows: HistoricalBulletinRow[]) {
  const groups: { fy: string; indices: number[] }[] = [];
  rows.forEach((row, index) => {
    const fy = fiscalYear(row.month);
    const group = groups.find(item => item.fy === fy);
    if (group) group.indices.push(index);
    else groups.push({ fy, indices: [index] });
  });
  return groups;
}

function movementClass(move: ReturnType<typeof movementLabel> | null): string {
  if (move?.type === "advancement") return "text-emerald-600 font-semibold";
  if (move?.type === "retrogression") return "text-red-600 font-semibold";
  return "text-slate-400";
}

function average(values: number[], count: number): number | null {
  if (values.length < count) return null;
  return Math.round(
    values.slice(0, count).reduce((sum, value) => sum + value, 0) / count
  );
}

function paceColor(value: number): string {
  if (value > 10) return "text-emerald-600";
  if (value < -10) return "text-red-600";
  return "text-amber-600";
}

function paceLabel(value: number): string {
  return value > 0 ? `+${value}d/mo` : `${value}d/mo`;
}

function PaceTile({
  label,
  v6,
  v12,
  categoryLabel,
}: {
  label: string;
  v6: number | null;
  v12: number | null;
  categoryLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
        {label}
      </p>
      {v6 !== null && (
        <p className={`mt-0.5 text-base font-bold font-mono ${paceColor(v6)}`}>
          6mo: {paceLabel(v6)}
          {v12 !== null && (
            <span className={`ml-2 text-sm font-normal ${paceColor(v12)}`}>
              · 12mo: {paceLabel(v12)}
            </span>
          )}
        </p>
      )}
      <p className="text-xs text-slate-400">{categoryLabel} avg</p>
    </div>
  );
}

export function TrackerPaceSummary({
  category,
  categoryLabel,
  rows,
}: {
  category: TrackerCategoryKey;
  categoryLabel: string;
  rows: HistoricalBulletinRow[];
}) {
  const fadKey = categoryDateKey(category, "fad");
  const dofKey = categoryDateKey(category, "dof");
  const fadDeltas: number[] = [];
  const dofDeltas: number[] = [];

  for (let index = 0; index < Math.min(12, rows.length - 1); index++) {
    const current = rows[index];
    const previous = rows[index + 1];
    if (
      rowCutoffStatus(current, category, "fad") !== "unavailable" &&
      rowCutoffStatus(previous, category, "fad") !== "unavailable"
    ) {
      fadDeltas.push(
        Math.round(
          (parseDateStr(current[fadKey]).getTime() -
            parseDateStr(previous[fadKey]).getTime()) /
            DAY_MS
        )
      );
    }
    if (
      rowCutoffStatus(current, category, "dof") !== "unavailable" &&
      rowCutoffStatus(previous, category, "dof") !== "unavailable"
    ) {
      dofDeltas.push(
        Math.round(
          (parseDateStr(current[dofKey]).getTime() -
            parseDateStr(previous[dofKey]).getTime()) /
            DAY_MS
        )
      );
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 flex-1 text-sm text-slate-600">
        Historical visa bulletins for India. Δ columns show month-over-month
        movement.
        <span className="text-emerald-600 font-semibold">
          {" "}
          Green = advancement
        </span>
        ,
        <span className="text-red-600 font-semibold"> Red = retrogression</span>
        .
        <span className="block text-xs text-slate-500 mt-1">
          Tracker tables now run continuously from Oct 2019 through the latest
          bulletin, including archived FY2020-FY2022 rows. Forecasts, charts,
          and backtests remain calibrated on the contiguous Oct 2022–August 2026
          series.
        </span>
      </div>
      <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[320px]">
        <PaceTile
          label="FAD Pace"
          v6={average(fadDeltas, 6)}
          v12={average(fadDeltas, 12)}
          categoryLabel={categoryLabel}
        />
        <PaceTile
          label="DoF Pace"
          v6={average(dofDeltas, 6)}
          v12={average(dofDeltas, 12)}
          categoryLabel={categoryLabel}
        />
      </div>
    </div>
  );
}

export function BulletinTable({
  kind,
  category,
  categoryLabel,
  targetDate,
  rows,
  expandedFYs,
  onToggleFY,
  onExpandFY,
  starRowRef,
}: {
  kind: DateKind;
  category: TrackerCategoryKey;
  categoryLabel: string;
  targetDate: string;
  rows: HistoricalBulletinRow[];
  expandedFYs: Set<string>;
  onToggleFY: (fy: string) => void;
  onExpandFY: (fy: string) => void;
  starRowRef: RefObject<HTMLTableRowElement | null>;
}) {
  const selectedKey = categoryDateKey(category, kind);
  const selectedCol = selectedColumn(category);
  const target = parseDateStr(targetDate);
  const groups = groupByFiscalYear(rows);
  const isFad = kind === "fad";

  let firstCurrentIndex: number | null = null;
  for (let index = rows.length - 1; index >= 0; index--) {
    if (
      rowCutoffStatus(rows[index], category, kind) !== "unavailable" &&
      parseDateStr(rows[index][selectedKey]) >= target
    ) {
      firstCurrentIndex = index;
      break;
    }
  }

  const headerSelectedClass = isFad ? "bg-slate-600" : "bg-slate-500";
  const groupOpenClass = isFad ? "bg-slate-800" : "bg-slate-700";
  const tableHeaderClass = isFad ? "bg-slate-700" : "bg-slate-600";
  const title = isFad ? "Final Action Dates (FAD)" : "Dates for Filing (DoF)";
  const starLabel = isFad ? "first current" : "first fileable";

  const hdrCellCls = (colIndex: number) =>
    colIndex === selectedCol
      ? `px-4 py-3 text-left font-bold ${headerSelectedClass} text-white`
      : "px-4 py-3 text-left font-semibold text-slate-300";
  const hdrDeltaCls = (colIndex: number) =>
    colIndex === selectedCol
      ? `px-4 py-3 text-center font-bold ${headerSelectedClass} text-white`
      : "px-4 py-3 text-center font-semibold text-slate-300";

  const cell = (colIndex: number, value: string) =>
    colIndex === selectedCol ? (
      <td className="px-4 py-2 font-mono font-bold text-slate-900 bg-white/60">
        {value}
      </td>
    ) : (
      <td className="px-4 py-2 font-mono text-slate-400">{value}</td>
    );
  const delta = (
    colIndex: number,
    move: ReturnType<typeof movementLabel> | null
  ) =>
    colIndex === selectedCol ? (
      <td className={`px-4 py-2 text-center font-mono ${movementClass(move)}`}>
        {move?.label ?? "—"}
      </td>
    ) : (
      <td className="px-4 py-2 text-center font-mono text-slate-300">
        {move?.label ?? "—"}
      </td>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-3">
          {firstCurrentIndex !== null && (
            <button
              onClick={() => {
                onExpandFY(fiscalYear(rows[firstCurrentIndex!].month));
                setTimeout(
                  () =>
                    starRowRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    }),
                  100
                );
              }}
              className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 hover:bg-amber-100 transition-colors font-semibold"
            >
              <span>★</span> Jump to your row
            </button>
          )}
          <span className="text-xs text-slate-500">
            Highlighted:{" "}
            <span className="font-semibold text-slate-700">
              {categoryLabel}
            </span>
            {firstCurrentIndex !== null && (
              <span className="ml-2 text-amber-600">★ = {starLabel}</span>
            )}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {groups.map(({ fy, indices }) => {
          const isOpen = expandedFYs.has(fy);
          const startMonth = rows[indices[indices.length - 1]].month;
          const endMonth = rows[indices[0]].month;
          const hasStarRow =
            firstCurrentIndex !== null && indices.includes(firstCurrentIndex);

          return (
            <div
              key={fy}
              className="rounded-lg border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => onToggleFY(fy)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isOpen ? `${groupOpenClass} text-white` : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">{fy}</span>
                  <span
                    className={`text-xs ${isOpen ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {startMonth} – {endMonth} · {indices.length} bulletins
                  </span>
                  {hasStarRow && (
                    <span className="text-amber-400 text-xs font-semibold">
                      ★ your row
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-bold transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <caption className="sr-only">
                      {fy} {isFad ? "Final Action Dates" : "Dates for Filing"}{" "}
                      for EB India categories
                    </caption>
                    <thead>
                      <tr className={`${tableHeaderClass} text-white`}>
                        <th className="px-4 py-2.5 text-left font-semibold">
                          Month
                        </th>
                        <th className={hdrCellCls(0)}>EB-1</th>
                        <th className={hdrDeltaCls(0)}>Δ</th>
                        <th className={hdrCellCls(1)}>EB-2</th>
                        <th className={hdrDeltaCls(1)}>Δ</th>
                        <th className={hdrCellCls(2)}>EB-3</th>
                        <th className={hdrDeltaCls(2)}>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indices.map(index => {
                        const row = rows[index];
                        const previous =
                          index < rows.length - 1 &&
                          areConsecutiveBulletinMonths(
                            row.month,
                            rows[index + 1].month
                          )
                            ? rows[index + 1]
                            : null;
                        const eb1Move = rowCutoffMovement(
                          previous,
                          row,
                          "EB1",
                          kind
                        );
                        const eb2Move = rowCutoffMovement(
                          previous,
                          row,
                          "EB2",
                          kind
                        );
                        const eb3Move = rowCutoffMovement(
                          previous,
                          row,
                          "EB3",
                          kind
                        );
                        const isFirstCurrent = index === firstCurrentIndex;
                        const isLatest = index === 0;
                        const rowClass = isFirstCurrent
                          ? "bg-amber-50 border-b border-amber-200"
                          : isLatest
                            ? "bg-blue-50 border-b border-slate-100"
                            : "border-b border-slate-100 hover:bg-slate-50";

                        return (
                          <tr
                            key={row.month}
                            className={rowClass}
                            ref={isFirstCurrent ? starRowRef : undefined}
                          >
                            <td className="px-4 py-2 font-mono font-semibold text-slate-800">
                              {isFirstCurrent && (
                                <span className="mr-1 text-amber-500">★</span>
                              )}
                              {row.month}
                              {isLatest && (
                                <span className="ml-1 text-blue-600 text-xs">
                                  (latest)
                                </span>
                              )}
                            </td>
                            {cell(0, rowCutoffDateLabel(row, "EB1", kind))}
                            {delta(0, eb1Move)}
                            {cell(1, rowCutoffDateLabel(row, "EB2", kind))}
                            {delta(1, eb2Move)}
                            {cell(2, rowCutoffDateLabel(row, "EB3", kind))}
                            {delta(2, eb3Move)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
