import { useEffect } from "react";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";

import { Card } from "@/components/ui/card";
import {
  BULLETIN_TRACKER_HISTORY,
  CURRENT_BULLETIN,
  DATA_FRESHNESS,
  EB_CATEGORIES,
  TRACKER_SOURCE_LINKS,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import {
  cutoffDateLabel,
  rowCutoffDateLabel,
  rowCutoffMovement,
} from "@/lib/bulletinStatus";

type SeoPageKind = "category" | "methodology" | "history";

export function SeoPage({
  kind,
  category,
}: {
  kind: SeoPageKind;
  category?: TrackerCategoryKey;
}) {
  const cat = category ? EB_CATEGORIES[category] : null;
  const title =
    kind === "category" && cat
      ? `${cat.label} India Priority Date Tracker`
      : kind === "methodology"
        ? "EBTracker Forecast Methodology"
        : "Visa Bulletin History for EB India";

  const description =
    kind === "category" && cat
      ? `Track ${cat.label} India priority date movement, current FAD/DoF cutoffs, and forecast estimates. Updated with the ${CURRENT_BULLETIN.month} visa bulletin.`
      : kind === "methodology"
        ? "How the EB Priority Date Tracker forecasts visa bulletin movement using dual-cutoff simulation, demand density, and backtested scenario modeling."
        : "Historical visa bulletin data for EB-1, EB-2, and EB-3 India employment-based green card categories, including Final Action Dates and Dates for Filing.";

  useEffect(() => {
    document.title = `${title} | EB Priority Date Tracker`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
  }, [title, description]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tracker
          </Link>
          <div className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-black leading-none tracking-[0.15em] text-white">
            EB
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            EB Priority Date Tracker
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 md:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Current bulletin: {CURRENT_BULLETIN.month}. Data verified{" "}
            {DATA_FRESHNESS.lastVerified}. Estimates are informational and are
            not legal advice.
          </p>
        </section>

        {kind === "category" && cat && <CategoryGuide category={category!} />}
        {kind === "methodology" && <MethodologyGuide />}
        {kind === "history" && <HistoryGuide />}

        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Primary Sources</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TRACKER_SOURCE_LINKS.map(source => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
              >
                {source.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}

function CategoryGuide({ category }: { category: TrackerCategoryKey }) {
  const cat = EB_CATEGORIES[category];
  const latest = BULLETIN_TRACKER_HISTORY[0];
  const previous = BULLETIN_TRACKER_HISTORY[1];
  const fadMove = previous
    ? rowCutoffMovement(previous, latest, category, "fad")
    : null;
  const dofMove = previous
    ? rowCutoffMovement(previous, latest, category, "dof")
    : null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Current FAD
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-slate-900">
            {cutoffDateLabel(cat.currentFAD, cat.currentFADStatus)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fadMove
              ? `Latest movement: ${fadMove.label}`
              : "Latest movement unavailable"}
          </p>
        </Card>
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Current DoF
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-slate-900">
            {cutoffDateLabel(cat.currentDoF, cat.currentDoFStatus)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {dofMove
              ? `Latest movement: ${dofMove.label}`
              : "Latest movement unavailable"}
          </p>
        </Card>
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Model Pace
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-slate-900">
            {cat.rates.base} PD-mo/mo
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Base scenario before live assumption controls.
          </p>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          About {cat.label} India
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {cat.notes}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The interactive tracker lets you enter a priority date, compare
          optimistic/base/conservative/pessimistic scenarios, inspect queue
          depth, and export a personalized estimate.
        </p>
        <Link
          href={`/?cat=${category}`}
          className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Open interactive tracker
        </Link>
      </Card>
    </>
  );
}

function MethodologyGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        {
          title: "Dual-cutoff simulator",
          body: "The model simulates Final Action Dates and Dates for Filing month by month instead of applying one fixed wait-time formula.",
        },
        {
          title: "Demand density",
          body: "Filed I-485 inventory is used where available. Scaled I-140 approval data is used beyond inventory coverage to estimate future demand pressure.",
        },
        {
          title: "Scenario controls",
          body: "Spillover, ban duration, and green card wastage controls scale scenario rates and policy-event risk in the forecast engine.",
        },
        {
          title: "Backtesting",
          body: "The tracker reports rolling six-month forecast error and 80% interval hit rate to keep model quality visible.",
        },
      ].map(item => (
        <Card
          key={item.title}
          className="border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {item.body}
          </p>
        </Card>
      ))}
    </div>
  );
}

function HistoryGuide() {
  const rows = BULLETIN_TRACKER_HISTORY.slice(0, 12);

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">
        Recent EB India Bulletin History
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">Bulletin</th>
              <th className="px-3 py-2 font-semibold">EB-1 FAD</th>
              <th className="px-3 py-2 font-semibold">EB-2 FAD</th>
              <th className="px-3 py-2 font-semibold">EB-3 FAD</th>
              <th className="px-3 py-2 font-semibold">EB-1 DoF</th>
              <th className="px-3 py-2 font-semibold">EB-2 DoF</th>
              <th className="px-3 py-2 font-semibold">EB-3 DoF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.month}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {row.month}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB1", "fad")}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB2", "fad")}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB3", "fad")}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB1", "dof")}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB2", "dof")}
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">
                  {rowCutoffDateLabel(row, "EB3", "dof")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
