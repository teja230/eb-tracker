import type { TrackerCategoryKey } from "@/data/trackerData";
import type { MovementInfo } from "@/lib/trackerUtils";

import type { CategoryComparisonRow } from "./trackerTypes";

export function CategoryComparison({
  rows,
  onSelectCategory,
  currentBulletinLabel,
  targetDateLabel,
}: {
  rows: CategoryComparisonRow[];
  onSelectCategory: (cat: TrackerCategoryKey) => void;
  currentBulletinLabel: string;
  targetDateLabel: string;
}) {
  const prevBulletinLabel = rows[0]?.prevBulletinLabel ?? "prior bulletin";

  function MoveBadge({ move }: { move: MovementInfo | null }) {
    if (!move) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          No date delta
        </span>
      );
    }
    if (move.type === "stable") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          ─ No change
        </span>
      );
    }
    if (move.type === "retrogression") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
          ▼ {move.label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        ▲ {move.label}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            EB Category Snapshot
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {currentBulletinLabel} cutoffs · movement vs {prevBulletinLabel} ·
            base-case FAD for PD {targetDateLabel}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map(row => (
          <button
            key={row.category}
            onClick={() => onSelectCategory(row.category)}
            aria-pressed={row.isSelected}
            aria-label={`${row.label} India snapshot. Current FAD ${row.currentFadLabel}, current DoF ${row.currentDofLabel}, base-case FAD estimate ${row.fadEstLabel}. ${row.isSelected ? "Selected category." : "Select this category."}`}
            className={`text-left rounded-xl border p-4 transition-all hover:shadow-md ${
              row.isSelected
                ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            {/* Category name */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p
                  className={`text-sm font-bold ${row.isSelected ? "text-white" : "text-slate-900"}`}
                >
                  {row.label} India
                </p>
                <p
                  className={`text-[11px] ${row.isSelected ? "text-slate-300" : "text-slate-400"}`}
                >
                  {row.name}
                </p>
              </div>
              {row.isSelected && (
                <span className="rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Selected
                </span>
              )}
            </div>

            {/* FAD row */}
            <div
              className={`rounded-lg p-3 mb-2 ${row.isSelected ? "bg-white/10" : "bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${row.isSelected ? "text-slate-300" : "text-slate-500"}`}
                >
                  Final Action Date
                </p>
                <MoveBadge move={row.fadMove} />
              </div>
              <p
                className={`mt-1 font-mono text-base font-bold ${row.isSelected ? "text-white" : "text-slate-900"}`}
              >
                {row.currentFadLabel}
              </p>
            </div>

            {/* DoF row */}
            <div
              className={`rounded-lg p-3 mb-3 ${row.isSelected ? "bg-white/10" : "bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${row.isSelected ? "text-slate-300" : "text-slate-500"}`}
                >
                  Dates for Filing
                </p>
                <MoveBadge move={row.dofMove} />
              </div>
              <p
                className={`mt-1 font-mono text-sm font-semibold ${row.isSelected ? "text-slate-100" : "text-slate-700"}`}
              >
                {row.currentDofLabel}
              </p>
            </div>

            {/* Gap + estimate footer */}
            <div
              className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                row.isSelected
                  ? "border-white/15 text-slate-300"
                  : "border-slate-100 text-slate-500"
              }`}
            >
              <span>
                Gap to your PD:{" "}
                <span className="font-semibold">{row.gapLabel}</span>
              </span>
              <span title="Base-case FAD estimate for your priority date">
                Est. FAD:{" "}
                <span className="font-semibold font-mono">
                  {row.fadEstLabel}
                </span>
              </span>
            </div>

            {/* Prev bulletin label */}
            <p
              className={`text-[10px] mt-1.5 ${row.isSelected ? "text-slate-400" : "text-slate-400"}`}
            >
              Movement shown vs. {row.prevBulletinLabel} bulletin. Click to
              switch active category.
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
