import { Fragment } from "react";

import { Database, ExternalLink } from "lucide-react";

import type { SourceLink } from "./trackerTypes";

export function DataFreshnessPanel({
  currentMonth,
  currentBulletinUrl,
  modelVersion,
  lastVerified,
  currentBulletinPublished,
  nextExpectedUpdate,
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
  const dot = <span className="text-slate-300">·</span>;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">
      {/* Row 1: stats */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Database className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>{currentMonth}</span>
        {dot}
        <span>Published {currentBulletinPublished}</span>
        {dot}
        <span>Verified {lastVerified}</span>
        {dot}
        <span>Next {nextExpectedUpdate}</span>
        {dot}
        <span>Model {modelVersion}</span>
      </div>

      {/* Row 2: links */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <a
          href={currentBulletinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:underline"
        >
          Official Bulletin <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {sourceLinks.map(source => (
          <Fragment key={source.href}>
            {dot}
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-slate-700 hover:underline"
              title={source.detail}
            >
              {source.label} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
