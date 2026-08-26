// Design: turn a user’s date into four calm, action-oriented milestones.
import { CheckCircle2, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { CutoffStatus } from "@/data/trackerData";
import type { ForecastProjection } from "@/lib/forecast";
import {
  fmtDate,
  fmtDateStr,
  fmtDuration,
  parseDateStr,
} from "@/lib/trackerUtils";

function isOnOrPast(cutoff: string, targetDate: string) {
  return parseDateStr(cutoff).getTime() >= parseDateStr(targetDate).getTime();
}

function projectionDateLabel(date: Date, capped: boolean) {
  if (capped) {
    const year = new Date().getFullYear() + 20;
    return `>${year}`;
  }
  return fmtDate(date);
}

export function PersonalTimeline({
  categoryLabel,
  targetDate,
  currentFad,
  currentFadStatus = "available",
  currentDof,
  currentDofStatus = "available",
  projection,
  gcLagMonths,
}: {
  categoryLabel: string;
  targetDate: string;
  currentFad: string;
  currentFadStatus?: CutoffStatus;
  currentDof: string;
  currentDofStatus?: CutoffStatus;
  projection: ForecastProjection;
  gcLagMonths: number;
}) {
  const dofUnavailable = currentDofStatus === "unavailable";
  const fadUnavailable = currentFadStatus === "unavailable";
  const steps = [
    {
      label: "Priority date set",
      date: fmtDateStr(targetDate),
      done: true,
      detail: `${categoryLabel} India case anchor.`,
    },
    {
      label: "DoF reaches your PD",
      date: dofUnavailable
        ? "Unavailable now"
        : isOnOrPast(currentDof, targetDate)
        ? "Already fileable"
        : projectionDateLabel(
            projection.dofDate,
            projection.horizon.dofP50Capped
          ),
      done: !dofUnavailable && isOnOrPast(currentDof, targetDate),
      detail: dofUnavailable
        ? "The filing chart is unavailable in the current bulletin; revisit the official guidance with the next update."
        : "Earliest filing chart milestone, subject to USCIS chart selection.",
    },
    {
      label: "FAD reaches your PD",
      date: fadUnavailable
        ? "Unavailable now"
        : isOnOrPast(currentFad, targetDate)
        ? "Already current"
        : projectionDateLabel(
            projection.fadDate,
            projection.horizon.fadP50Capped
          ),
      done: !fadUnavailable && isOnOrPast(currentFad, targetDate),
      detail: fadUnavailable
        ? "No visa numbers are currently available in this category. The forecast resumes only after availability returns."
        : "Visa availability milestone used by the estimate.",
    },
    {
      label: "Green card receipt estimate",
      date: projectionDateLabel(
        projection.gcDate,
        projection.horizon.gcP50Capped
      ),
      done: false,
      detail: `Modeled as roughly ${fmtDuration(gcLagMonths)} after FAD.`,
    },
  ];

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-slate-900">Personal Timeline</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="relative rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">
              {step.label}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-700">
              {step.date}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {step.detail}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
