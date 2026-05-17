import type { Dispatch, SetStateAction } from "react";

import {
  CategoryComparison,
  WatchlistPanel,
} from "@/components/TrackerEnhancements";
import { CURRENT_BULLETIN, type TrackerCategoryKey } from "@/data/trackerData";
import type { UseForecastDataResult } from "@/hooks/useForecastData";
import { fmtDateStr } from "@/lib/trackerUtils";
import type {
  HistoricalChartPoint,
  HomeHistoryWindow,
  TrackerCategory,
} from "@/pages/homeShared";
import { HistoricalChartCard } from "./overview/HistoricalChartCard";
import { InsightTiles } from "./overview/InsightTiles";
import { MethodologySection } from "./overview/MethodologySection";
import { ProjectionHeroCard } from "./overview/ProjectionHeroCard";
import { QueueDepthCard } from "./overview/QueueDepthCard";

type OverviewTabProps = Pick<
  UseForecastDataResult,
  | "accelZone"
  | "activeHistoricalInsight"
  | "adjustedRates"
  | "backtestResult"
  | "categoryComparisonRows"
  | "chartYDomain"
  | "currentCutoffs"
  | "demandDensityData"
  | "forecastContext"
  | "forecastPolicies"
  | "forecastStartMonthIndex"
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
  onCompareDate?: () => void;
};

export function OverviewTab({
  accelZone,
  activeHistoricalInsight,
  activeHistoricalPoint,
  adjustedRates,
  backtestResult,
  cat,
  categoryComparisonRows,
  chartYDomain,
  currentCutoffs,
  demandDensityData,
  forecastContext,
  forecastPolicies,
  forecastStartMonthIndex,
  fullHistoricalChartData,
  fyBoundaries,
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
  onCompareDate,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <ProjectionHeroCard
        overviewProjection={overviewProjection}
        backtestResult={backtestResult}
        targetDate={targetDate}
        overviewAssumptionSummary={overviewAssumptionSummary}
        onCompare={onCompareDate}
      />
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
      <HistoricalChartCard
        cat={cat}
        isMobile={isMobile}
        accelZone={accelZone}
        fyBoundaries={fyBoundaries}
        historicalChartData={historicalChartData}
        fullHistoricalChartData={fullHistoricalChartData}
        historicalXAxisTicks={historicalXAxisTicks}
        historicalYAxisTicks={historicalYAxisTicks}
        chartYDomain={chartYDomain as [number, number]}
        activeHistoricalPoint={activeHistoricalPoint}
        setActiveHistoricalPoint={setActiveHistoricalPoint}
        activeHistoricalInsight={activeHistoricalInsight}
        historyWindowSummary={historyWindowSummary}
        isRecentHistoryWindow={isRecentHistoryWindow}
        isArchiveHistoryWindow={isArchiveHistoryWindow}
        isFullHistoryWindow={isFullHistoryWindow}
        setHistoryWindow={setHistoryWindow}
        targetDate={targetDate}
      />
      <QueueDepthCard
        cat={cat}
        targetDate={targetDate}
        demandDensityData={demandDensityData}
      />
      <InsightTiles
        recentPaceInsight={recentPaceInsight}
        pendingInventoryTotal={pendingInventoryTotal}
      />
      <MethodologySection
        showMethodology={showMethodology}
        setShowMethodology={setShowMethodology}
        trackerSourceLinks={trackerSourceLinks}
      />
    </div>
  );
}
