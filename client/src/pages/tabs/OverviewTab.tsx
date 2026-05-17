import type { Dispatch, SetStateAction } from "react";

import { Card } from "@/components/ui/card";
import { ConfidenceRangeChart } from "@/components/ConfidenceRangeChart";
import {
  CategoryComparison,
  TrustAndLimitationsPanel,
  WatchlistPanel,
} from "@/components/TrackerEnhancements";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
} from "lucide-react";

import {
  CURRENT_BULLETIN,
  HISTORICAL_BULLETINS,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import {
  fmtBulletinMonthLabel,
  fmtCompactMonthYear,
  fmtDate,
  fmtDateStr,
  fmtDuration,
  parseDateStr,
} from "@/lib/trackerUtils";
import type { UseForecastDataResult } from "@/hooks/useForecastData";
import {
  ARCHIVE_HISTORY_WINDOW,
  DEFAULT_HISTORY_WINDOW,
  bulletinUrl,
  fmtProjectionDate,
  fmtProjectionDateRange,
  fmtProjectionDuration,
  type HistoricalChartPoint,
  type HomeHistoryWindow,
  type TrackerCategory,
} from "@/pages/homeShared";

type OverviewTabProps = Pick<
  UseForecastDataResult,
  | "accelZone"
  | "activeHistoricalInsight"
  | "backtestResult"
  | "categoryComparisonRows"
  | "chartYDomain"
  | "currentCutoffs"
  | "demandDensityData"
  | "fullHistoricalChartData"
  | "fyBoundaries"
  | "historicalChartData"
  | "historicalXAxisTicks"
  | "historicalYAxisTicks"
  | "historyWindowSummary"
  | "isArchiveHistoryWindow"
  | "isFullHistoryWindow"
  | "isRecentHistoryWindow"
  | "overviewAssumptionSummary"
  | "overviewProjection"
  | "pendingInventoryTotal"
  | "projections"
  | "recentPaceInsight"
  | "trackerSourceLinks"
> & {
  activeHistoricalPoint: HistoricalChartPoint | null;
  cat: TrackerCategory;
  generateShareUrl: () => string;
  isMobile: boolean;
  selectedCategory: TrackerCategoryKey;
  setActiveHistoricalPoint: Dispatch<
    SetStateAction<HistoricalChartPoint | null>
  >;
  setHistoryWindow: Dispatch<SetStateAction<HomeHistoryWindow>>;
  setShowMethodology: Dispatch<SetStateAction<boolean>>;
  showMethodology: boolean;
  targetDate: string;
  updateSelectedCategory: (category: TrackerCategoryKey) => void;
};

export function OverviewTab({
  accelZone,
  activeHistoricalInsight,
  activeHistoricalPoint,
  backtestResult,
  cat,
  categoryComparisonRows,
  chartYDomain,
  currentCutoffs,
  demandDensityData,
  fullHistoricalChartData,
  generateShareUrl,
  historicalChartData,
  historicalXAxisTicks,
  historicalYAxisTicks,
  historyWindowSummary,
  isArchiveHistoryWindow,
  isFullHistoryWindow,
  isMobile,
  isRecentHistoryWindow,
  overviewAssumptionSummary,
  overviewProjection,
  pendingInventoryTotal,
  projections,
  recentPaceInsight,
  selectedCategory,
  setActiveHistoricalPoint,
  setHistoryWindow,
  setShowMethodology,
  showMethodology,
  targetDate,
  trackerSourceLinks,
  updateSelectedCategory,
  fyBoundaries,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {overviewProjection.isAlreadyCurrent ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-emerald-700">Already Current!</p>
          <p className="text-sm text-slate-600 mt-1">
            {fmtDateStr(targetDate)} is already current as of the{" "}
            {CURRENT_BULLETIN.month} bulletin.
          </p>
        </div>
      ) : (
        <div className="relative -mt-2 overflow-hidden rounded-xl border border-slate-600/80 border-l-4 border-l-emerald-400 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 p-6 text-white md:-mt-0">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-1">
            Your Projection
          </h2>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-mono text-slate-300">
              {fmtDateStr(targetDate)}
            </span>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100">
              Best Case
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
                Filing Date (DoF)
              </p>
              <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
                {fmtProjectionDate(
                  overviewProjection.dofDate,
                  overviewProjection.horizon.dofP50Capped
                )}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
              <p className="mt-1 text-[11px] text-slate-300">
                80% range:{" "}
                {fmtProjectionDateRange(
                  overviewProjection.dofRange.p10,
                  overviewProjection.dofRange.p90,
                  overviewProjection.horizon.dofP90Capped
                )}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
                Final Action Date
              </p>
              <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
                {fmtProjectionDate(
                  overviewProjection.fadDate,
                  overviewProjection.horizon.fadP50Capped
                )}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
              <p className="mt-1 text-[11px] text-slate-300">
                80% range:{" "}
                {fmtProjectionDateRange(
                  overviewProjection.fadRange.p10,
                  overviewProjection.fadRange.p90,
                  overviewProjection.horizon.fadP90Capped
                )}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
                GC Receipt Est.
              </p>
              <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
                {fmtProjectionDate(
                  overviewProjection.gcDate,
                  overviewProjection.horizon.gcP50Capped
                )}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
              <p className="mt-1 text-[11px] text-slate-300">
                80% range:{" "}
                {fmtProjectionDateRange(
                  overviewProjection.gcRange.p10,
                  overviewProjection.gcRange.p90,
                  overviewProjection.horizon.gcP90Capped
                )}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">
                Time to FAD
              </p>
              <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">
                {fmtProjectionDuration(
                  overviewProjection.monthsFromToday,
                  overviewProjection.horizon.fadP50Capped
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">Best case median</p>
              <p className="mt-1 text-[11px] text-slate-300">
                80% range:{" "}
                {fmtDuration(Math.round(overviewProjection.fadMonths.p10))} -{" "}
                {fmtProjectionDuration(
                  Math.round(overviewProjection.fadMonths.p90),
                  overviewProjection.horizon.fadP90Capped
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-600">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-300">
              80% Confidence Timeline
            </p>
            <ConfidenceRangeChart
              data={[
                {
                  label: "Filing Date (DoF)",
                  p10: overviewProjection.dofRange.p10,
                  p50: overviewProjection.dofDate,
                  p90: overviewProjection.dofRange.p90,
                },
                {
                  label: "Final Action Date (FAD)",
                  p10: overviewProjection.fadRange.p10,
                  p50: overviewProjection.fadDate,
                  p90: overviewProjection.fadRange.p90,
                },
                {
                  label: "GC Receipt Estimate",
                  p10: overviewProjection.gcRange.p10,
                  p50: overviewProjection.gcDate,
                  p90: overviewProjection.gcRange.p90,
                },
              ]}
              minDate={overviewProjection.dofRange.p10}
              maxDate={overviewProjection.gcRange.p90}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-slate-600 pt-3 text-xs text-slate-300 md:flex-row md:items-center md:justify-between">
            <p>
              Best case uses the optimistic scenario with{" "}
              {overviewAssumptionSummary}. See Scenarios tab for the full range.
            </p>
            <div className="flex items-center gap-3 text-[10px] shrink-0">
              {backtestResult.predictions > 0 && (
                <span
                  className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
                  title={`6-month backtest on ${backtestResult.predictions} rolling windows`}
                >
                  <Info className="w-3 h-3" />
                  MAE: ±{backtestResult.mae} mo
                </span>
              )}
              {backtestResult.predictions > 0 && (
                <span
                  className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
                  title="Share of 6-month backtest windows where the actual FAD landed inside the model's 80% interval"
                >
                  80% hit: {Math.round(backtestResult.coverage80 * 100)}%
                </span>
              )}
              <span
                className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
                title="Share of simulated paths with a near-term stall, unavailability, or bounded retrogression event in the next 12 bulletin months"
              >
                Near-term risk:{" "}
                {Math.round(overviewProjection.nearTermRisk * 100)}%
              </span>
              <span
                className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200"
                title="Share of simulated paths with a bounded one-time backward FAD movement"
              >
                Retro shock:{" "}
                {Math.round(overviewProjection.retrogressionRisk * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <CategoryComparison
        rows={categoryComparisonRows}
        currentBulletinLabel={CURRENT_BULLETIN.month}
        targetDateLabel={fmtDateStr(targetDate)}
        onSelectCategory={updateSelectedCategory}
      />

      <WatchlistPanel
        category={selectedCategory}
        categoryLabel={cat.label}
        targetDate={targetDate}
        assumptionsSummary={overviewAssumptionSummary}
        projection={projections.base}
        currentCutoffs={currentCutoffs}
        shareUrl={generateShareUrl()}
      />

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
                      historicalChartData[historicalChartData.length - 1] ??
                        null
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
                      <stop
                        offset="70%"
                        stopColor="#1d4ed8"
                        stopOpacity={0.92}
                      />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient
                      id="fadAreaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#3b82f6"
                        stopOpacity={0.18}
                      />
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
                    {fmtDate(activeHistoricalInsight.fadDate)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    DoF
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {fmtDate(activeHistoricalInsight.dofDate)}
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

      {demandDensityData.length > 0 && (
        <Card className="p-5 pb-3 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-700">
              Queue Depth by Priority Date Year
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600" />{" "}
                I-485 inventory
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-300" />{" "}
                I-140 (scaled)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Pending applications the FAD must clear through each year. Your PD
            year highlighted.
          </p>
          <div
            role="img"
            aria-label={`${cat.label} India queue depth by priority date year`}
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={demandDensityData}
                margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "none",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                    padding: "10px 14px",
                    fontSize: 12,
                  }}
                  formatter={(v: number, _name: string, props: any) => [
                    `${v.toLocaleString()} pending`,
                    props.payload.source,
                  ]}
                  labelFormatter={(label: string) => `PD Year ${label}`}
                  cursor={{ fill: "#f1f5f9" }}
                />
                <Bar dataKey="pending" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {demandDensityData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.isTarget
                          ? "#f59e0b"
                          : entry.source === "I-485"
                            ? "#2563eb"
                            : "#93c5fd"
                      }
                      stroke={entry.isTarget ? "#d97706" : "none"}
                      strokeWidth={entry.isTarget ? 2 : 0}
                    />
                  ))}
                </Bar>
                <ReferenceLine
                  x={String(parseDateStr(cat.currentFAD).getFullYear())}
                  stroke="#10b981"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{
                    value: "FAD",
                    position: "top",
                    fill: "#10b981",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                />
                <ReferenceLine
                  x={String(parseDateStr(targetDate).getFullYear())}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{
                    value: "Your PD",
                    position: "top",
                    fill: "#d97706",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Source: USCIS I-485 Pending Inventory (Oct 2025) · I-140 Performance
            Data (FY2025 Q3)
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Recent Pace
              </p>
              <p className="text-sm font-bold text-slate-900">
                {recentPaceInsight?.headline ?? "Waiting for data"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {recentPaceInsight?.detail ??
                  "Need at least two bulletin rows to compute a monthly movement."}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Pending Inventory
              </p>
              <p className="text-sm font-bold text-slate-900">
                {pendingInventoryTotal.toLocaleString()} I-485s
              </p>
              <p className="text-xs text-slate-500 mt-1">
                USCIS Oct 2025 filed I-485 inventory used by the demand model.
                This does not include future demand that has not yet reached the
                filing stage.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Key Risk
              </p>
              <p className="text-sm font-bold text-slate-900">
                Retrogression possible
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {CURRENT_BULLETIN.month} bulletin notes that retrogression may
                be necessary later in the fiscal year.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setShowMethodology(v => !v)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {showMethodology ? "Hide" : "Show"} methodology
          {showMethodology ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        {showMethodology && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800">
              Probabilistic Dual-Cutoff Simulator (v8)
            </p>
            <p>
              Simulates both <strong>FAD and DoF month by month</strong>. Each
              future bulletin month samples from historical movement patterns
              instead of assuming one smooth, fixed rate.
            </p>
            <p>
              For each simulated month:{" "}
              <code className="bg-slate-200 px-1 rounded">
                delta = base_rate × (seasonality + residual sample) ÷ √(demand ÷
                ref)
              </code>
            </p>
            <p>
              <strong>Demand curve:</strong> Uses{" "}
              <strong>USCIS I-485 pending inventory</strong> (Oct 2025) where
              available and falls back to <strong>I-140 approval counts</strong>{" "}
              (FY2025 Q3) beyond inventory coverage. The fallback is scaled
              using the <strong>median overlap ratio</strong>, and demand ratios
              are clipped before applying the square-root slowdown.
            </p>
            <p>
              <strong>Seasonality and volatility:</strong> Derived from{" "}
              {HISTORICAL_BULLETINS.length} months of verified bulletin data.
              Each FY-month has its own bucket of historical residuals, which
              means the live model can simulate both surges and retrogression.
            </p>
            <p>
              <strong>DoF model:</strong> Independent — DoF is simulated from
              its own historical movement series instead of being forced to
              equal FAD minus a fixed offset.
            </p>
            <p>
              Scenario assumptions in the Scenarios tab are unchanged. They
              still scale the base FAD rate through spillover, ban duration, and
              wastage multipliers before the simulator runs.
            </p>
            <p>
              Forecast cards show the <strong>median (P50)</strong> date plus an{" "}
              <strong>80% interval</strong>. The backtest badge reports 6-month
              FAD MAE and how often the actual bulletin landed inside the
              model's 80% interval.
            </p>
            <p className="text-slate-400">
              Disclaimer: Estimates are probabilistic and may change with policy
              shifts, retrogression, or legislative action.
            </p>
          </div>
        )}
        <TrustAndLimitationsPanel sourceLinks={trackerSourceLinks} />
      </div>
    </div>
  );
}
