import { Database, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";

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
  return (
    <Card className="overflow-hidden border-slate-200 bg-white p-0 shadow-sm">
      <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-bold">Data Freshness</h3>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Current source state, model version, and update cadence.
            </p>
          </div>
          <a
            href={currentBulletinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
          >
            Official bulletin
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-5">
        {[
          {
            label: "Latest Bulletin",
            value: currentMonth,
            detail: `Published ${currentBulletinPublished}`,
          },
          {
            label: "Model Version",
            value: modelVersion,
            detail: `${modelHistoryCount} model rows`,
          },
          {
            label: "Tracker History",
            value: `${trackerHistoryCount} rows`,
            detail: "Includes archive rows",
          },
          {
            label: "Last Verified",
            value: lastVerified,
            detail: `Next check ${nextExpectedUpdate}`,
          },
          {
            label: "I-485 Filing Chart",
            value: "USCIS",
            detail: adjustmentChartNote,
          },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-900">
              {item.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {sourceLinks.map(source => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
              title={source.detail}
            >
              {source.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}
