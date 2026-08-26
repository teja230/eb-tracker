// Design: summarize verified monthly cutoff changes as a concise, source-linked civic-data briefing.
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  FileWarning,
  Minus,
} from "lucide-react";

import type {
  HistoricalBulletinRow,
  TrackerCategoryKey,
} from "@/data/trackerData";
import {
  categoryDateKey,
  rowCutoffDateLabel,
  rowCutoffStatus,
  type DateKind,
} from "@/lib/bulletinStatus";
import { fmtDateStr, movementLabel } from "@/lib/trackerUtils";

type BriefTone = "positive" | "caution" | "risk" | "neutral";

export type BulletinBriefItem = {
  label: string;
  value: string;
  detail: string;
  tone: BriefTone;
};

function buildCutoffBrief(
  current: HistoricalBulletinRow,
  previous: HistoricalBulletinRow | undefined,
  category: TrackerCategoryKey,
  kind: DateKind
): BulletinBriefItem {
  const label = kind === "fad" ? "Final Action Date" : "Dates for Filing";
  const currentStatus = rowCutoffStatus(current, category, kind);
  const previousStatus = previous
    ? rowCutoffStatus(previous, category, kind)
    : "available";
  const currentLabel = rowCutoffDateLabel(current, category, kind);

  if (currentStatus === "unavailable") {
    return {
      label,
      value:
        previousStatus === "unavailable"
          ? "Remains unavailable"
          : "Now unavailable",
      detail:
        "The Department of State has not made visa numbers available in this category for the current bulletin.",
      tone: "caution",
    };
  }

  if (previousStatus === "unavailable") {
    return {
      label,
      value: `Available again: ${currentLabel}`,
      detail:
        "A dated cutoff is published again after the prior bulletin showed the category as unavailable.",
      tone: "positive",
    };
  }

  if (!previous) {
    return {
      label,
      value: currentLabel,
      detail: "This is the first tracked bulletin in the current history window.",
      tone: "neutral",
    };
  }

  const dateKey = categoryDateKey(category, kind);
  const movement = movementLabel(previous[dateKey], current[dateKey]);

  if (movement.type === "stable") {
    return {
      label,
      value: `Held at ${currentLabel}`,
      detail: "No material movement from the previous bulletin.",
      tone: "neutral",
    };
  }

  const direction =
    movement.type === "advancement" ? "Advanced" : "Retrogressed";
  return {
    label,
    value: `${direction} ${movement.label}`,
    detail: `Current cutoff: ${currentLabel}.`,
    tone: movement.type === "advancement" ? "positive" : "risk",
  };
}

export function buildBulletinBriefing(
  category: TrackerCategoryKey,
  rows: HistoricalBulletinRow[]
) {
  const [current, previous] = rows;
  if (!current) return null;

  return {
    currentMonth: current.month,
    previousMonth: previous?.month ?? null,
    items: [
      buildCutoffBrief(current, previous, category, "fad"),
      buildCutoffBrief(current, previous, category, "dof"),
    ],
  };
}

const toneClasses: Record<BriefTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  caution: "border-amber-200 bg-amber-50 text-amber-900",
  risk: "border-red-200 bg-red-50 text-red-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-900",
};

function BriefIcon({ tone }: { tone: BriefTone }) {
  const className = "h-4 w-4 shrink-0";
  if (tone === "positive") return <ArrowUpRight className={className} />;
  if (tone === "risk") return <ArrowDownLeft className={className} />;
  if (tone === "caution") return <FileWarning className={className} />;
  return <Minus className={className} />;
}

export function BulletinBriefing({
  category,
  categoryLabel,
  rows,
  bulletinUrl,
}: {
  category: TrackerCategoryKey;
  categoryLabel: string;
  rows: HistoricalBulletinRow[];
  bulletinUrl: string;
}) {
  const briefing = buildBulletinBriefing(category, rows);
  if (!briefing) return null;

  return (
    <section
      aria-labelledby="monthly-briefing-heading"
      className="rounded-lg border border-slate-300 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 border-l-4 border-l-slate-700 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Latest bulletin briefing
          </p>
          <h2
            id="monthly-briefing-heading"
            className="mt-0.5 text-sm font-semibold text-slate-900"
          >
            What changed this month?
          </h2>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {briefing.currentMonth}
          {briefing.previousMonth ? ` vs ${briefing.previousMonth}` : ""}
        </span>
      </div>

      <div className="p-4">
        <p className="text-xs leading-5 text-slate-600">
          Verified change for <strong className="text-slate-900">{categoryLabel} India</strong>. This summarizes the published cutoffs; it is not a forecast or filing determination.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {briefing.items.map(item => (
            <div
              key={item.label}
              className={`rounded-md border px-3 py-3 ${toneClasses[item.tone]}`}
            >
              <div className="flex items-start gap-2">
                <BriefIcon tone={item.tone} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <a
          href={bulletinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
        >
          Read the official {briefing.currentMonth} bulletin
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </section>
  );
}
