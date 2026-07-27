import type { Dispatch, SetStateAction } from "react";

import { Card } from "@/components/ui/card";
import { CURRENT_BULLETIN } from "@/data/trackerData";
import {
  fmtBulletinMonthLabel,
  fmtCompactMonthYear,
  parseDateStr,
} from "@/lib/trackerUtils";
import {
  ARCHIVE_HISTORY_WINDOW,
  DEFAULT_HISTORY_WINDOW,
  bulletinUrl,
  type HistoricalChartPoint,
  type HomeHistoryWindow,
  type TrackerCategory,
} from "@/pages/homeShared";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

type HistoricalChartCardProps = {
  cat: TrackerCategory;
  isMobile: boolean;
  accelZone: { x1: string; x2: string } | null | undefined;
  fyBoundaries: string[];
  historicalChartData: HistoricalChartPoint[];
  fullHistoricalChartData: HistoricalChartPoint[];
  historicalXAxisTicks: string[];
  historicalYAxisTicks: number[];
  chartYDomain: [number, number];
  activeHistoricalPoint: HistoricalChartPoint | null;
  setActiveHistoricalPoint: Dispatch<
    SetStateAction<HistoricalChartPoint | null>
  >;
  activeHistoricalInsight:
    | {
        month: string;
        fadDate: Date;
        dofDate: Date;
        fadLabel: string;
        dofLabel: string;
        targetStatus: string;
        dofLead: number;
      }
    | null
    | undefined;
  historyWindowSummary:
    | { startLabel: string; endLabel: string; count: number }
    | null
    | undefined;
  isRecentHistoryWindow: boolean;
  isArchiveHistoryWindow: boolean;
  isFullHistoryWindow: boolean;
  setHistoryWindow: Dispatch<SetStateAction<HomeHistoryWindow>>;
  targetDate: string;
};

export function HistoricalChartCard({
  cat,
  isMobile,
  accelZone,
  fyBoundaries,
  historicalChartData,
  fullHistoricalChartData,
  historicalXAxisTicks,
  historicalYAxisTicks,
  chartYDomain,
  activeHistoricalPoint,
  setActiveHistoricalPoint,
  activeHistoricalInsight,
  historyWindowSummary,
  isRecentHistoryWindow,
  isArchiveHistoryWindow,
  isFullHistoryWindow,
  setHistoryWindow,
  targetDate,
}: HistoricalChartCardProps) {
  return (
    <Card className="overflow-hidden gap-0 border-slate-200 bg-white p-0 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 md:text-base">
            {cat.label} India priority date movement
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Source:{" "}
            <a
              href={bulletinUrl(CURRENT_BULLETIN.month)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              DOS Visa Bulletin
            </a>{" "}
            · {isMobile ? "Tap" : "Click"} any point to view its official
            bulletin
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="inline-block h-0.5 w-5 rounded-full bg-blue-700" />
            Final Action Date
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="inline-block w-5 border-b-2 border-dashed border-cyan-500" />
            Dates for Filing
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="inline-block w-5 border-b-2 border-dashed border-amber-500" />
            PD {fmtCompactMonthYear(targetDate)}
          </span>
          {accelZone && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {fmtBulletinMonthLabel(accelZone.x1)} to{" "}
              {fmtBulletinMonthLabel(accelZone.x2)}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 md:p-4">
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              History Range
            </p>
            {historyWindowSummary && (
              <p className="mt-1 text-xs text-slate-500">
                Showing {historyWindowSummary.startLabel} to{" "}
                {historyWindowSummary.endLabel} · {historyWindowSummary.count}{" "}
                bulletins
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setHistoryWindow(DEFAULT_HISTORY_WINDOW)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isRecentHistoryWindow
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setHistoryWindow(ARCHIVE_HISTORY_WINDOW)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isArchiveHistoryWindow
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              FY2020-2022
            </button>
            <button
              onClick={() =>
                setHistoryWindow({
                  start: 0,
                  end: fullHistoricalChartData.length - 1,
                })
              }
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isFullHistoryWindow
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Full history
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-2 md:p-3">
          <div
            className="h-[330px] md:h-[390px]"
            role="img"
            aria-label={`${cat.label} India historical Final Action Date and Dates for Filing movement chart`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historicalChartData}
                margin={{
                  top: 18,
                  right: isMobile ? 10 : 18,
                  left: isMobile ? 0 : 8,
                  bottom: 6,
                }}
                onMouseMove={(state: any) => {
                  const point = state?.activePayload?.[0]?.payload;
                  if (point) setActiveHistoricalPoint(point);
                }}
                onMouseLeave={() =>
                  setActiveHistoricalPoint(
                    historicalChartData[historicalChartData.length - 1] ?? null
                  )
                }
                style={{ cursor: "pointer" }}
                onClick={(state: any) => {
                  const point = state?.activePayload?.[0]?.payload;
                  if (point) {
                    setActiveHistoricalPoint(point);
                    window.open(
                      bulletinUrl(point.month),
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }
                }}
              >
                <defs>
                  <linearGradient id="fadGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.7} />
                    <stop offset="70%" stopColor="#1d4ed8" stopOpacity={0.92} />
                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="fadAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop
                      offset="100%"
                      stopColor="#3b82f6"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />

                {accelZone && (
                  <ReferenceArea
                    x1={accelZone.x1}
                    x2={accelZone.x2}
                    fill="#10b981"
                    fillOpacity={0.08}
                    stroke="#10b981"
                    strokeOpacity={0.14}
                    strokeDasharray="6 6"
                  />
                )}

                {fyBoundaries.map(m => (
                  <ReferenceLine
                    key={m}
                    x={m}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))}

                <XAxis
                  dataKey="month"
                  ticks={historicalXAxisTicks}
                  tick={{
                    fontSize: isMobile ? 10 : 11,
                    fill: "#64748b",
                  }}
                  tickFormatter={fmtBulletinMonthLabel}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                  interval={0}
                  minTickGap={isMobile ? 16 : 24}
                  tickMargin={isMobile ? 8 : 12}
                  height={isMobile ? 28 : 34}
                />
                <YAxis
                  ticks={historicalYAxisTicks}
                  tick={{
                    fontSize: isMobile ? 10 : 11,
                    fill: "#64748b",
                  }}
                  tickFormatter={(v: number) =>
                    String(new Date(v).getFullYear())
                  }
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  domain={chartYDomain}
                  width={isMobile ? 40 : 52}
                />

                {activeHistoricalPoint && (
                  <ReferenceLine
                    x={activeHistoricalPoint.month}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                  />
                )}

                <ReferenceLine
                  y={parseDateStr(targetDate).getTime()}
                  stroke="#f59e0b"
                  strokeDasharray="6 5"
                  strokeWidth={isMobile ? 1.25 : 1.5}
                  strokeOpacity={0.85}
                />

                <Area
                  type="monotone"
                  dataKey="fad"
                  fill="url(#fadAreaGrad)"
                  stroke="none"
                />

                {activeHistoricalPoint && (
                  <>
                    <ReferenceDot
                      x={activeHistoricalPoint.month}
                      y={activeHistoricalPoint.fad}
                      r={5.5}
                      fill="#1d4ed8"
                      stroke="#fff"
                      strokeWidth={2.5}
                      isFront
                    />
                    <ReferenceDot
                      x={activeHistoricalPoint.month}
                      y={activeHistoricalPoint.dof}
                      r={4.5}
                      fill="#06b6d4"
                      stroke="#fff"
                      strokeWidth={2}
                      isFront
                    />
                  </>
                )}

                <Line
                  type="monotone"
                  dataKey="dof"
                  name="dof"
                  stroke="#06b6d4"
                  strokeWidth={2.25}
                  strokeDasharray="7 5"
                  strokeOpacity={0.92}
                  dot={false}
                  activeDot={{
                    r: 4.5,
                    fill: "#06b6d4",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="fad"
                  name="fad"
                  stroke="url(#fadGrad)"
                  strokeWidth={3}
                  dot={({ cx, cy, index }: any) => {
                    if (index !== historicalChartData.length - 1)
                      return <g key={index} />;
                    return (
                      <g key={index}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill="#dbeafe"
                          opacity={0.8}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4.5}
                          fill="#1d4ed8"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }}
                  activeDot={{
                    r: 5.5,
                    fill: "#1d4ed8",
                    stroke: "#fff",
                    strokeWidth: 2.5,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {activeHistoricalInsight && (
            <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Selected Bulletin
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {activeHistoricalInsight.month}
                  </p>
                  {activeHistoricalPoint?.month ===
                    historicalChartData[historicalChartData.length - 1]
                      ?.month && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Latest
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isMobile ? "Tap" : "Click"} any point to open that month's
                  official visa bulletin.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  FAD
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeHistoricalInsight.fadLabel}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  DoF
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeHistoricalInsight.dofLabel}
                </p>
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Status vs your PD
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeHistoricalInsight.targetStatus}
                </p>
                <p className="mt-1 text-[11px] text-amber-800/80">
                  DoF lead: {activeHistoricalInsight.dofLead} mo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
