// Design: lead the detailed tables with a source-backed, plain-language monthly briefing.
import type { RefObject } from "react";

import {
  BulletinTable,
  TrackerPaceSummary,
} from "@/components/BulletinTrackerTables";
import { BulletinBriefing } from "@/components/BulletinBriefing";
import { DataFreshnessPanel } from "@/components/TrackerEnhancements";
import {
  BULLETIN_TRACKER_HISTORY,
  CURRENT_BULLETIN,
  DATA_FRESHNESS,
  HISTORICAL_BULLETINS,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import { bulletinUrl, type TrackerCategory } from "@/pages/homeShared";
import type { UseForecastDataResult } from "@/hooks/useForecastData";

type TrackerTabProps = Pick<UseForecastDataResult, "trackerSourceLinks"> & {
  cat: TrackerCategory;
  dofStarRowRef: RefObject<HTMLTableRowElement | null>;
  expandedDofFYs: Set<string>;
  expandedFadFYs: Set<string>;
  fadStarRowRef: RefObject<HTMLTableRowElement | null>;
  onExpandDofFY: (fy: string) => void;
  onExpandFadFY: (fy: string) => void;
  selectedCategory: TrackerCategoryKey;
  targetDate: string;
  toggleDofFY: (fy: string) => void;
  toggleFadFY: (fy: string) => void;
};

export function TrackerTab({
  cat,
  dofStarRowRef,
  expandedDofFYs,
  expandedFadFYs,
  fadStarRowRef,
  onExpandDofFY,
  onExpandFadFY,
  selectedCategory,
  targetDate,
  toggleDofFY,
  toggleFadFY,
  trackerSourceLinks,
}: TrackerTabProps) {
  return (
    <div className="space-y-6">
      <TrackerPaceSummary
        category={selectedCategory}
        categoryLabel={cat.label}
        rows={HISTORICAL_BULLETINS}
      />

      <BulletinBriefing
        category={selectedCategory}
        categoryLabel={cat.label}
        rows={HISTORICAL_BULLETINS}
        bulletinUrl={bulletinUrl(CURRENT_BULLETIN.month)}
      />

      <BulletinTable
        kind="fad"
        category={selectedCategory}
        categoryLabel={cat.label}
        targetDate={targetDate}
        rows={BULLETIN_TRACKER_HISTORY}
        expandedFYs={expandedFadFYs}
        onToggleFY={toggleFadFY}
        onExpandFY={onExpandFadFY}
        starRowRef={fadStarRowRef}
      />

      <BulletinTable
        kind="dof"
        category={selectedCategory}
        categoryLabel={cat.label}
        targetDate={targetDate}
        rows={BULLETIN_TRACKER_HISTORY}
        expandedFYs={expandedDofFYs}
        onToggleFY={toggleDofFY}
        onExpandFY={onExpandDofFY}
        starRowRef={dofStarRowRef}
      />

      <DataFreshnessPanel
        currentMonth={CURRENT_BULLETIN.month}
        currentBulletinUrl={bulletinUrl(CURRENT_BULLETIN.month)}
        modelVersion={DATA_FRESHNESS.modelVersion}
        lastVerified={DATA_FRESHNESS.lastVerified}
        currentBulletinPublished={DATA_FRESHNESS.currentBulletinPublished}
        nextExpectedUpdate={DATA_FRESHNESS.nextExpectedUpdate}
        adjustmentChartNote={DATA_FRESHNESS.adjustmentChartNote}
        modelHistoryCount={HISTORICAL_BULLETINS.length}
        trackerHistoryCount={BULLETIN_TRACKER_HISTORY.length}
        sourceLinks={trackerSourceLinks}
      />
    </div>
  );
}
