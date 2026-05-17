import { Database, ExternalLink } from "lucide-react";

import type { SourceLink } from "./trackerTypes";

export function DataFreshnessPanel({
  currentMonth,
  currentBulletinUrl,
  modelVersion,
  lastVerified,
  currentBulletinPublished,
  nextExpectedUpdate,
  adjustmentChartNote,
  modelHistoryCount,
  trackerHistoryCount,
  sourceLinks,
}: {
  currentMonth: string;
  currentBulletinUrl: string;
  modelVersion: string;
  lastVerified: string;
  currentBulletinPublished: string;
  nextExpectedUpdate: string;
  adjustmentChartNote: string;
  modelHistoryCount: number;
  trackerHistoryCount: number;
  sourceLinks: SourceLink[];
}) {
  const stats = [
    { label: "Bulletin", value: currentMonth },
    { label: "Published", value: currentBulletinPublished },
    { label: "Verified", value: lastVerified },
    { label: "Next update", value: nextExpectedUpdate },
    { label: "Model", value: modelVersion },
    { label: "History", value: `${trackerHistoryCount} rows` },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2.5">
      {/* Top row: label + bulletin link */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          Data Sources
        </div>
        <a
          href={currentBulletinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
        >
          Official Bulletin
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Stats inline */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stats.map(s => (
          <span key={s.label} className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{s.value}</span>{" "}
            <span className="text-slate-400">{s.label}</span>
          </span>
        ))}
        <span className="text-[11px] text-slate-400 italic">
          {adjustmentChartNote}
        </span>
      </div>

      {/* Source links */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {sourceLinks.map(source => (
          <a
            key={source.href}
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-400 hover:text-slate-800 transition-colors"
            title={source.detail}
          >
            {source.label}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ))}
      </div>
    </div>
  );
}
