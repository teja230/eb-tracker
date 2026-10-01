import { useEffect, useMemo, useRef, useState } from "react";

import {
  BULLETIN_TRACKER_HISTORY,
  CURRENT_BULLETIN,
  EB_CATEGORIES,
  HISTORICAL_BULLETINS,
  I140_INDIA_APPROVALS,
  I485_PERFORMANCE,
  I485_INDIA_PENDING,
  I485_INVENTORY,
  categoryDemandInputs,
  SCENARIOS,
  TRACKER_SOURCE_LINKS,
  type CutoffStatus,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import {
  cutoffDateLabel,
  rowCutoffMovement,
  rowCutoffStatus,
} from "@/lib/bulletinStatus";
import {
  backtestForecast,
  buildDemandCurve,
  createForecastContext,
  forecastScenario,
  type BacktestSummary,
  type ForecastPolicy,
  type ForecastProjection,
} from "@/lib/forecast";
import {
  fmtBulletinMonthLabel,
  fmtDuration,
  monthsBetween,
  parseBulletinMonth,
  parseDateStr,
} from "@/lib/trackerUtils";
import type {
  CategoryComparisonRow,
  SensitivityRow,
  SourceLink,
} from "@/components/TrackerEnhancements";
import {
  ARCHIVE_HISTORY_WINDOW,
  DEFAULT_HISTORY_WINDOW,
  TODAY,
  applyAssumptionRates,
  buildForecastPolicy,
  buildHistoricalSeries,
  bulletinUrl,
  clipHistoricalSeries,
  fmtProjectionDate,
  fiscalYearRecoveryHoldMonths,
  getHistoricalPointInsight,
  historicalCategoryKeys,
  type BulletinDofKey,
  type BulletinFadKey,
  type HistoricalChartPoint,
  type HomeHistoryWindow,
  type ScenarioKey,
} from "@/pages/homeShared";

export type UseForecastDataParams = {
  selectedCategory: TrackerCategoryKey;
  targetDate: string;
  spilloverLevel: "low" | "moderate" | "high";
  banContinues: "2027" | "2028" | "2029";
  wastageLevel: "low" | "moderate" | "high";
  deferredSpillover: "low" | "moderate" | "high";
  deferredBan: "2027" | "2028" | "2029";
  deferredWastage: "low" | "moderate" | "high";
  historyWindow: HomeHistoryWindow;
  activeHistoricalPoint: HistoricalChartPoint | null;
  isMobile: boolean;
  fadKey: BulletinFadKey;
  dofKey: BulletinDofKey;
};

export type UseForecastDataResult = {
  adjustedRates: Record<ScenarioKey, number>;
  operationalGcLagMonths: number;
  fadKey: BulletinFadKey;
  dofKey: BulletinDofKey;
  categoryBulletins: Array<{
    month: string;
    fad: string;
    dof: string;
    fadUnavailable: boolean;
    dofUnavailable: boolean;
  }>;
  demandInputs: {
    i485: Record<number, number>;
    i140: Record<number, number>;
    partialInventoryYears?: number[];
  };
  forecastContext: ReturnType<typeof createForecastContext>;
  forecastStartMonthIndex: number;
  pendingInventoryTotal: number;
  forecastPolicies: Record<ScenarioKey, ForecastPolicy>;
  projections: Record<string, ForecastProjection>;
  backtestResult: BacktestSummary;
  overviewProjection: ForecastProjection;
  gapMonths: number;
  overviewAssumptionSummary: string;
  fullHistoricalChartData: HistoricalChartPoint[];
  clampedHistoryWindow: HomeHistoryWindow;
  historicalChartData: HistoricalChartPoint[];
  chartYDomain: number[];
  fyBoundaries: string[];
  accelZone: { x1: string; x2: string } | null;
  historicalXAxisTicks: string[];
  historicalYAxisTicks: number[];
  historyWindowSummary: {
    startLabel: string;
    endLabel: string;
    count: number;
  } | null;
  isRecentHistoryWindow: boolean;
  isArchiveHistoryWindow: boolean;
  isFullHistoryWindow: boolean;
  activeHistoricalInsight: ReturnType<typeof getHistoricalPointInsight> | null;
  recentPaceInsight: { headline: string; detail: string } | null;
  demandDensityData: Array<{
    year: string;
    pending: number;
    estimated: number;
    source: string;
    isTarget: boolean;
    isCurrent: boolean;
  }>;
  currentCutoffs: Record<
    TrackerCategoryKey,
    {
      fad: string;
      dof: string;
      fadStatus?: CutoffStatus;
      dofStatus?: CutoffStatus;
    }
  >;
  trackerSourceLinks: SourceLink[];
  categoryComparisonRows: CategoryComparisonRow[];
  sensitivityRows: SensitivityRow[];
  sensitivityByOption: Map<string, SensitivityRow>;
};

export function useForecastData({
  selectedCategory,
  targetDate,
  spilloverLevel,
  banContinues,
  wastageLevel,
  deferredSpillover,
  deferredBan,
  deferredWastage,
  historyWindow,
  activeHistoricalPoint,
  isMobile,
  fadKey,
  dofKey,
}: UseForecastDataParams): UseForecastDataResult {
  const cat = EB_CATEGORIES[selectedCategory];
  const operationalGcLagMonths = Math.max(
    cat.gcLagMonths,
    I485_PERFORMANCE.derivedProcessingLagMonths
  );

  const adjustedRates = useMemo(() => {
    return applyAssumptionRates(cat.rates, {
      spilloverLevel: deferredSpillover,
      banContinues: deferredBan,
      wastageLevel: deferredWastage,
    });
  }, [cat.rates, deferredBan, deferredSpillover, deferredWastage]);

  const categoryBulletins = useMemo(
    () =>
      [...HISTORICAL_BULLETINS].reverse().map(b => ({
        month: b.month,
        fad: b[fadKey] as string,
        dof: b[dofKey] as string,
        fadUnavailable:
          rowCutoffStatus(b, selectedCategory, "fad") === "unavailable",
        dofUnavailable:
          rowCutoffStatus(b, selectedCategory, "dof") === "unavailable",
      })),
    [dofKey, fadKey, selectedCategory]
  );

  const demandInputs = useMemo(
    () => categoryDemandInputs(selectedCategory),
    [selectedCategory]
  );

  const forecastContext = useMemo(
    () =>
      createForecastContext({
        bulletins: categoryBulletins,
        demand: demandInputs,
      }),
    [categoryBulletins, demandInputs]
  );

  const forecastStartMonthIndex = useMemo(
    () => (parseBulletinMonth(CURRENT_BULLETIN.month).getMonth() + 1) % 12,
    []
  );
  const currentFadUnavailable = cat.currentFADStatus === "unavailable";
  const currentUnavailabilityHoldMonths = useMemo(
    () =>
      fiscalYearRecoveryHoldMonths(
        forecastStartMonthIndex,
        currentFadUnavailable
      ),
    [currentFadUnavailable, forecastStartMonthIndex]
  );

  const pendingInventoryTotal = useMemo(
    () => I485_INVENTORY.categories[selectedCategory].disclosedTotal,
    [selectedCategory]
  );

  const forecastPolicies = useMemo(() => {
    const policies = {} as Record<ScenarioKey, ForecastPolicy>;
    for (const key of Object.keys(SCENARIOS) as ScenarioKey[]) {
      policies[key] = buildForecastPolicy({
        scenario: key,
        category: selectedCategory,
        spilloverLevel: deferredSpillover,
        banContinues: deferredBan,
        wastageLevel: deferredWastage,
      });
    }
    return policies;
  }, [deferredBan, deferredSpillover, deferredWastage, selectedCategory]);

  // ─── Web Worker: off-main-thread Monte Carlo ─────────────────────────────────
  const workerRef = useRef<Worker | null>(null);
  const pendingProjectionsId = useRef<string | null>(null);
  const pendingBacktestId = useRef<string | null>(null);

  // Compute synchronous initial values (runs once, avoids loading flash)
  const initialProjections = useMemo(() => {
    const result: Record<string, ForecastProjection> = {};
    for (const key of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>) {
      result[key] = forecastScenario({
        context: forecastContext,
        today: TODAY,
        currentFad: cat.currentFAD,
        currentDof: cat.currentDoF,
        currentFadUnavailable,
        currentUnavailabilityHoldMonths,
        targetDate,
        baseFadRate: adjustedRates[key],
        gcLagMonths: operationalGcLagMonths,
        seasonalityStartMonth: forecastStartMonthIndex,
        policy: forecastPolicies[key],
        paths: 500,
        maxMonths: 240,
        seed: `${selectedCategory}:${targetDate}:${key}:${deferredSpillover}:${deferredBan}:${deferredWastage}`,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only runs on mount

  const initialBacktest: BacktestSummary = useMemo(
    () =>
      backtestForecast({
        bulletins: categoryBulletins,
        demand: demandInputs,
        baseFadRate: cat.rates.base,
        gcLagMonths: operationalGcLagMonths,
        horizonMonths: 6,
        paths: 200,
        seed: `${selectedCategory}:backtest`,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally empty — only runs on mount
  );

  const [projections, setProjections] =
    useState<Record<string, ForecastProjection>>(initialProjections);
  const [backtestResult, setBacktestResult] =
    useState<BacktestSummary>(initialBacktest);

  // Spawn worker once
  useEffect(() => {
    const worker = new Worker(
      new URL("@/workers/forecast.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (
      e: MessageEvent<
        | {
            id: string;
            type: "projections_result";
            projections: Record<string, ForecastProjection>;
          }
        | {
            id: string;
            type: "backtest_result";
            backtestResult: BacktestSummary;
          }
      >
    ) => {
      if (
        e.data.type === "projections_result" &&
        e.data.id === pendingProjectionsId.current
      ) {
        setProjections(e.data.projections);
        pendingProjectionsId.current = null;
      } else if (
        e.data.type === "backtest_result" &&
        e.data.id === pendingBacktestId.current
      ) {
        setBacktestResult(e.data.backtestResult);
        pendingBacktestId.current = null;
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Send new projections request when deferred inputs change
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingProjectionsId.current = id;
    worker.postMessage({
      id,
      type: "projections",
      forecastContext,
      today: TODAY.toISOString(),
      currentFad: cat.currentFAD,
      currentDof: cat.currentDoF,
      currentFadUnavailable,
      currentUnavailabilityHoldMonths,
      targetDate,
      gcLagMonths: operationalGcLagMonths,
      forecastStartMonthIndex,
      adjustedRates,
      forecastPolicies,
      selectedCategory,
      deferredSpillover,
      deferredBan,
      deferredWastage,
    });
  }, [
    adjustedRates,
    cat.currentDoF,
    cat.currentFAD,
    currentFadUnavailable,
    currentUnavailabilityHoldMonths,
    operationalGcLagMonths,
    deferredBan,
    deferredSpillover,
    deferredWastage,
    forecastContext,
    forecastPolicies,
    forecastStartMonthIndex,
    selectedCategory,
    targetDate,
  ]);

  // Send new backtest request when category inputs change
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = `bt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingBacktestId.current = id;
    worker.postMessage({
      id,
      type: "backtest",
      bulletins: categoryBulletins,
      demand: demandInputs,
      baseRate: cat.rates.base,
      gcLagMonths: operationalGcLagMonths,
      selectedCategory,
    });
  }, [
    categoryBulletins,
    operationalGcLagMonths,
    cat.rates.base,
    demandInputs,
    selectedCategory,
  ]);

  const overviewProjection = projections.optimistic;
  const gapMonths = Math.max(
    0,
    Math.round(monthsBetween(cat.currentFAD, targetDate))
  );

  const overviewAssumptionSummary = useMemo(() => {
    const spilloverSummary =
      spilloverLevel === "high"
        ? "high spillover (~70k+ extra EB visas in FY2027)"
        : spilloverLevel === "moderate"
          ? "moderate spillover (30-40k extra EB visas in FY2027)"
          : "low spillover (~30k extra EB visas in FY2027)";
    const banSummary = `ban through ${banContinues}`;
    const wastageSummary =
      wastageLevel === "low"
        ? "low wastage"
        : wastageLevel === "moderate"
          ? "moderate wastage"
          : "high wastage";
    return `${spilloverSummary}, ${banSummary}, and ${wastageSummary}`;
  }, [banContinues, spilloverLevel, wastageLevel]);

  const fullHistoricalChartData = useMemo(
    () => buildHistoricalSeries(BULLETIN_TRACKER_HISTORY, selectedCategory),
    [selectedCategory]
  );

  const clampedHistoryWindow = useMemo(() => {
    const maxIndex = Math.max(0, fullHistoricalChartData.length - 1);
    const start = Math.max(0, Math.min(historyWindow.start, maxIndex));
    const end = Math.max(start, Math.min(historyWindow.end, maxIndex));
    return { start, end };
  }, [fullHistoricalChartData.length, historyWindow]);

  const historicalChartData = useMemo(() => {
    return clipHistoricalSeries(
      fullHistoricalChartData.slice(
        clampedHistoryWindow.start,
        clampedHistoryWindow.end + 1
      )
    );
  }, [
    clampedHistoryWindow.end,
    clampedHistoryWindow.start,
    fullHistoricalChartData,
  ]);

  const chartYDomain = useMemo(() => {
    const allVals = historicalChartData.flatMap(d => [d.fad, d.dof]);
    const targetTs = parseDateStr(targetDate).getTime();
    allVals.push(targetTs);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }, [historicalChartData, targetDate]);

  const fyBoundaries = useMemo(() => {
    return historicalChartData
      .filter(d => d.month.startsWith("Oct "))
      .map(d => d.month);
  }, [historicalChartData]);

  const accelZone = useMemo(() => {
    const start = historicalChartData.find(d => d.month === "Oct 2025")?.month;
    const end = historicalChartData.find(d => d.month === "Apr 2026")?.month;
    return start && end ? { x1: start, x2: end } : null;
  }, [historicalChartData]);

  const historicalXAxisTicks = useMemo(() => {
    const lastIdx = historicalChartData.length - 1;
    const firstIdx = 0;
    const anchors = new Set([firstIdx, lastIdx]);

    const ticks: string[] = [];

    historicalChartData.forEach((d, index) => {
      const isDesktopTick =
        d.month.startsWith("Apr ") || d.month.startsWith("Oct ");
      const isMobileTick = d.month.startsWith("Oct ");
      const isRegular = isMobile ? isMobileTick : isDesktopTick;

      if (isRegular && !anchors.has(index)) {
        const tooCloseToAnchor = Array.from(anchors).some(
          a => Math.abs(index - a) < 3
        );
        if (!tooCloseToAnchor) ticks.push(d.month);
      }
    });

    ticks.unshift(historicalChartData[firstIdx].month);
    ticks.push(historicalChartData[lastIdx].month);

    return Array.from(new Set(ticks));
  }, [historicalChartData, isMobile]);

  const historicalYAxisTicks = useMemo(() => {
    const allVals = historicalChartData.flatMap(d => [d.fadRaw, d.dofRaw]);
    allVals.push(parseDateStr(targetDate).getTime());
    const minYear = new Date(Math.min(...allVals)).getFullYear();
    const maxYear = new Date(Math.max(...allVals)).getFullYear();
    const stepYears = isMobile ? 2 : 1;
    const ticks: number[] = [];

    for (let year = minYear; year <= maxYear; year += stepYears) {
      ticks.push(new Date(year, 0, 1).getTime());
    }

    const lastYearTick = new Date(maxYear, 0, 1).getTime();
    if (!ticks.includes(lastYearTick)) ticks.push(lastYearTick);

    return ticks;
  }, [historicalChartData, isMobile, targetDate]);

  const historyWindowSummary = useMemo(() => {
    const start = fullHistoricalChartData[clampedHistoryWindow.start];
    const end = fullHistoricalChartData[clampedHistoryWindow.end];
    if (!start || !end) return null;
    return {
      startLabel: fmtBulletinMonthLabel(start.month),
      endLabel: fmtBulletinMonthLabel(end.month),
      count: clampedHistoryWindow.end - clampedHistoryWindow.start + 1,
    };
  }, [
    clampedHistoryWindow.end,
    clampedHistoryWindow.start,
    fullHistoricalChartData,
  ]);

  const isRecentHistoryWindow =
    clampedHistoryWindow.start === DEFAULT_HISTORY_WINDOW.start &&
    clampedHistoryWindow.end === DEFAULT_HISTORY_WINDOW.end;
  const isArchiveHistoryWindow =
    clampedHistoryWindow.start === ARCHIVE_HISTORY_WINDOW.start &&
    clampedHistoryWindow.end === ARCHIVE_HISTORY_WINDOW.end;
  const isFullHistoryWindow =
    clampedHistoryWindow.start === 0 &&
    clampedHistoryWindow.end === fullHistoricalChartData.length - 1;

  const activeHistoricalInsight = useMemo(() => {
    if (!activeHistoricalPoint) return null;
    return getHistoricalPointInsight(activeHistoricalPoint, targetDate);
  }, [activeHistoricalPoint, targetDate]);

  const recentPaceInsight = useMemo(() => {
    if (HISTORICAL_BULLETINS.length < 2) return null;

    const monthlyMoves = [];
    for (let i = 0; i < HISTORICAL_BULLETINS.length - 1; i++) {
      const current = HISTORICAL_BULLETINS[i];
      const previous = HISTORICAL_BULLETINS[i + 1];
      const move = rowCutoffMovement(
        previous,
        current,
        selectedCategory,
        "fad"
      );
      const isUnavailable =
        rowCutoffStatus(current, selectedCategory, "fad") === "unavailable";
      monthlyMoves.push({
        month: current.month,
        ...(move ?? { label: "—", type: "stable" as const, days: 0 }),
        isUnavailable,
        months: Math.round(((move?.days ?? 0) / 30.44) * 10) / 10,
      });
    }

    const latest = monthlyMoves[0];
    const trailingMoves = monthlyMoves.slice(
      0,
      Math.min(6, monthlyMoves.length)
    );
    const trailingTotal =
      Math.round(
        trailingMoves.reduce((sum, move) => sum + move.months, 0) * 10
      ) / 10;
    const maxAdvanceDays = Math.max(...monthlyMoves.map(move => move.days), 0);

    const headline = latest.isUnavailable
      ? `Unavailable in ${latest.month}`
      : latest.type === "stable"
        ? `No change in ${latest.month}`
        : `${latest.days > 0 ? "+" : ""}${Math.round(latest.months)} mo in ${latest.month}`;

    const trailingSummary = `${trailingTotal > 0 ? "+" : ""}${trailingTotal} PD-months total across the last ${trailingMoves.length} moves.`;

    let detail = trailingSummary;
    if (latest.isUnavailable) {
      detail = `${cat.label} India FAD is unavailable in the latest bulletin. Forecasts hold FAD movement until the FY2027 recovery window before resuming simulations from the recovery anchor.`;
    } else if (
      latest.type === "advancement" &&
      latest.days === maxAdvanceDays
    ) {
      detail = `Largest single-month ${cat.label} India advancement in this tracker. ${trailingSummary}`;
    } else if (latest.type === "advancement") {
      detail = `Latest bulletin advanced by ${Math.abs(Math.round(latest.months))} PD-months. ${trailingSummary}`;
    } else if (latest.type === "retrogression") {
      detail = `Latest bulletin retrogressed by ${Math.abs(Math.round(latest.months))} PD-months. ${trailingSummary}`;
    } else {
      detail = `Latest bulletin was unchanged. ${trailingSummary}`;
    }

    return { headline, detail };
  }, [cat.label, selectedCategory]);

  const demandDensityData = useMemo(() => {
    const i485 = I485_INDIA_PENDING[selectedCategory] ?? {};
    const i140 = I140_INDIA_APPROVALS[selectedCategory] ?? {};
    const demandCurve = buildDemandCurve(
      categoryDemandInputs(selectedCategory)
    );
    const scaleFactor = demandCurve.scaleFactor;

    const fadYear = parseDateStr(cat.currentFAD).getFullYear();
    const targetYear = parseDateStr(targetDate).getFullYear();
    const allI485Years = Object.keys(i485)
      .map(Number)
      .filter(y => i485[y] > 0);
    const allI140Years = Object.keys(i140).map(Number);
    const minYear = Math.min(fadYear - 2, ...allI485Years, ...allI140Years);
    const maxYear = Math.max(targetYear + 1, ...allI485Years, ...allI140Years);

    const bars: UseForecastDataResult["demandDensityData"] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const i485Val = i485[y];
      const i140Val = i140[y];
      let pending = 0;
      let estimated = 0;
      let source = "none";
      if (i485Val !== undefined && i485Val > 0) {
        pending = i485Val;
        source = "I-485";
        estimated = Math.max(0, Math.round(demandCurve.byYear[y]) - pending);
      } else if (i140Val !== undefined) {
        estimated = Math.round(i140Val * scaleFactor);
        source = "I-140 (scaled)";
      }
      if (pending + estimated > 0) {
        bars.push({
          year: String(y),
          pending,
          estimated,
          source,
          isTarget: y === targetYear,
          isCurrent: y === fadYear,
        });
      }
    }
    return bars;
  }, [cat.currentFAD, selectedCategory, targetDate]);

  const currentCutoffs = useMemo(
    () => ({
      EB1: {
        fad: EB_CATEGORIES.EB1.currentFAD,
        dof: EB_CATEGORIES.EB1.currentDoF,
        fadStatus: EB_CATEGORIES.EB1.currentFADStatus,
        dofStatus: EB_CATEGORIES.EB1.currentDoFStatus,
      },
      EB2: {
        fad: EB_CATEGORIES.EB2.currentFAD,
        dof: EB_CATEGORIES.EB2.currentDoF,
        fadStatus: EB_CATEGORIES.EB2.currentFADStatus,
        dofStatus: EB_CATEGORIES.EB2.currentDoFStatus,
      },
      EB3: {
        fad: EB_CATEGORIES.EB3.currentFAD,
        dof: EB_CATEGORIES.EB3.currentDoF,
        fadStatus: EB_CATEGORIES.EB3.currentFADStatus,
        dofStatus: EB_CATEGORIES.EB3.currentDoFStatus,
      },
    }),
    []
  );

  const trackerSourceLinks = useMemo<SourceLink[]>(
    () => [
      {
        label: `${CURRENT_BULLETIN.month} Bulletin`,
        href: bulletinUrl(CURRENT_BULLETIN.month),
        detail: "Official current-month employment-based cutoff source.",
      },
      ...TRACKER_SOURCE_LINKS,
    ],
    []
  );

  const categoryComparisonRows: CategoryComparisonRow[] = useMemo(() => {
    const latestRow = HISTORICAL_BULLETINS[0];
    const prevRow = HISTORICAL_BULLETINS[1];
    const prevBulletinLabel = prevRow?.month ?? "prior";

    return (Object.keys(EB_CATEGORIES) as TrackerCategoryKey[]).map(
      category => {
        const comparisonCat = EB_CATEGORIES[category];
        const keys = historicalCategoryKeys(category);
        const comparisonFadUnavailable =
          comparisonCat.currentFADStatus === "unavailable";
        const comparisonUnavailabilityHoldMonths = fiscalYearRecoveryHoldMonths(
          forecastStartMonthIndex,
          comparisonFadUnavailable
        );

        const fadMove =
          prevRow && latestRow
            ? rowCutoffMovement(prevRow, latestRow, category, "fad")
            : null;
        const dofMove =
          prevRow && latestRow
            ? rowCutoffMovement(prevRow, latestRow, category, "dof")
            : null;

        const bulletins = [...HISTORICAL_BULLETINS].reverse().map(row => ({
          month: row.month,
          fad: row[keys.fadKey],
          dof: row[keys.dofKey],
          fadUnavailable:
            rowCutoffStatus(row, category, "fad") === "unavailable",
          dofUnavailable:
            rowCutoffStatus(row, category, "dof") === "unavailable",
        }));
        const context = createForecastContext({
          bulletins,
          demand: categoryDemandInputs(category),
        });
        const rates = applyAssumptionRates(comparisonCat.rates, {
          spilloverLevel: deferredSpillover,
          banContinues: deferredBan,
          wastageLevel: deferredWastage,
        });
        const policy = buildForecastPolicy({
          scenario: "base",
          category,
          spilloverLevel: deferredSpillover,
          banContinues: deferredBan,
          wastageLevel: deferredWastage,
        });
        const projection = forecastScenario({
          context,
          today: TODAY,
          currentFad: comparisonCat.currentFAD,
          currentDof: comparisonCat.currentDoF,
          currentFadUnavailable: comparisonFadUnavailable,
          currentUnavailabilityHoldMonths: comparisonUnavailabilityHoldMonths,
          targetDate,
          baseFadRate: rates.base,
          gcLagMonths: Math.max(
            comparisonCat.gcLagMonths,
            I485_PERFORMANCE.derivedProcessingLagMonths
          ),
          seasonalityStartMonth: forecastStartMonthIndex,
          policy,
          paths: 200,
          maxMonths: 240,
          seed: `${category}:${targetDate}:comparison:${deferredSpillover}:${deferredBan}:${deferredWastage}`,
        });
        const gap = Math.max(
          0,
          Math.round(monthsBetween(comparisonCat.currentFAD, targetDate))
        );

        return {
          category,
          label: comparisonCat.label,
          name: comparisonCat.name,
          currentFadLabel: cutoffDateLabel(
            comparisonCat.currentFAD,
            comparisonCat.currentFADStatus
          ),
          currentDofLabel: cutoffDateLabel(
            comparisonCat.currentDoF,
            comparisonCat.currentDoFStatus
          ),
          fadMove,
          dofMove,
          prevBulletinLabel,
          gapLabel: comparisonFadUnavailable
            ? "Unavailable"
            : gap > 0
              ? fmtDuration(gap)
              : "Current",
          fadEstLabel: projection.isAlreadyCurrent
            ? "Current"
            : fmtProjectionDate(
                projection.fadDate,
                projection.horizon.fadP50Capped
              ),
          isSelected: category === selectedCategory,
        };
      }
    );
  }, [
    deferredBan,
    deferredSpillover,
    deferredWastage,
    forecastStartMonthIndex,
    selectedCategory,
    targetDate,
  ]);

  const sensitivityRows: SensitivityRow[] = useMemo(() => {
    const baseline = projections.base;
    if (!baseline) return [];

    const optionGroups: Array<{
      control: string;
      values: Array<{
        label: string;
        settings: {
          spilloverLevel: "low" | "moderate" | "high";
          banContinues: "2027" | "2028" | "2029";
          wastageLevel: "low" | "moderate" | "high";
        };
        selected: boolean;
      }>;
    }> = [
      {
        control: "Spillover",
        values: [
          {
            label: "Low",
            settings: { spilloverLevel: "low", banContinues, wastageLevel },
            selected: spilloverLevel === "low",
          },
          {
            label: "Moderate",
            settings: {
              spilloverLevel: "moderate",
              banContinues,
              wastageLevel,
            },
            selected: spilloverLevel === "moderate",
          },
          {
            label: "High",
            settings: { spilloverLevel: "high", banContinues, wastageLevel },
            selected: spilloverLevel === "high",
          },
        ],
      },
      {
        control: "Ban duration",
        values: [
          {
            label: "Through 2027",
            settings: { spilloverLevel, banContinues: "2027", wastageLevel },
            selected: banContinues === "2027",
          },
          {
            label: "Through 2028",
            settings: { spilloverLevel, banContinues: "2028", wastageLevel },
            selected: banContinues === "2028",
          },
          {
            label: "Through 2029",
            settings: { spilloverLevel, banContinues: "2029", wastageLevel },
            selected: banContinues === "2029",
          },
        ],
      },
      {
        control: "Wastage",
        values: [
          {
            label: "Low",
            settings: { spilloverLevel, banContinues, wastageLevel: "low" },
            selected: wastageLevel === "low",
          },
          {
            label: "Moderate",
            settings: {
              spilloverLevel,
              banContinues,
              wastageLevel: "moderate",
            },
            selected: wastageLevel === "moderate",
          },
          {
            label: "High",
            settings: { spilloverLevel, banContinues, wastageLevel: "high" },
            selected: wastageLevel === "high",
          },
        ],
      },
    ];

    return optionGroups.flatMap(group =>
      group.values.map(option => {
        const rates = applyAssumptionRates(cat.rates, option.settings);
        const policy = buildForecastPolicy({
          scenario: "base",
          category: selectedCategory,
          ...option.settings,
        });
        const projection = forecastScenario({
          context: forecastContext,
          today: TODAY,
          currentFad: cat.currentFAD,
          currentDof: cat.currentDoF,
          currentFadUnavailable,
          currentUnavailabilityHoldMonths,
          targetDate,
          baseFadRate: rates.base,
          gcLagMonths: operationalGcLagMonths,
          seasonalityStartMonth: forecastStartMonthIndex,
          policy,
          paths: 220,
          maxMonths: 240,
          seed: `${selectedCategory}:${targetDate}:sensitivity:${group.control}:${option.label}:${option.settings.spilloverLevel}:${option.settings.banContinues}:${option.settings.wastageLevel}`,
        });

        return {
          control: group.control,
          value: option.label,
          months: projection.monthsFromToday,
          dateLabel: fmtProjectionDate(
            projection.fadDate,
            projection.horizon.fadP50Capped
          ),
          deltaMonths: Math.round(
            projection.fadMonths.p50 - baseline.fadMonths.p50
          ),
          selected: option.selected,
        };
      })
    );
  }, [
    banContinues,
    cat.currentDoF,
    cat.currentFAD,
    currentFadUnavailable,
    currentUnavailabilityHoldMonths,
    operationalGcLagMonths,
    cat.rates,
    forecastContext,
    forecastStartMonthIndex,
    projections.base,
    selectedCategory,
    spilloverLevel,
    targetDate,
    wastageLevel,
  ]);

  const sensitivityByOption = useMemo(() => {
    const map = new Map<string, SensitivityRow>();
    sensitivityRows.forEach(row => map.set(`${row.control}:${row.value}`, row));
    return map;
  }, [sensitivityRows]);

  return {
    adjustedRates,
    operationalGcLagMonths,
    fadKey,
    dofKey,
    categoryBulletins,
    demandInputs,
    forecastContext,
    forecastStartMonthIndex,
    pendingInventoryTotal,
    forecastPolicies,
    projections,
    backtestResult,
    overviewProjection,
    gapMonths,
    overviewAssumptionSummary,
    fullHistoricalChartData,
    clampedHistoryWindow,
    historicalChartData,
    chartYDomain,
    fyBoundaries,
    accelZone,
    historicalXAxisTicks,
    historicalYAxisTicks,
    historyWindowSummary,
    isRecentHistoryWindow,
    isArchiveHistoryWindow,
    isFullHistoryWindow,
    activeHistoricalInsight,
    recentPaceInsight,
    demandDensityData,
    currentCutoffs,
    trackerSourceLinks,
    categoryComparisonRows,
    sensitivityRows,
    sensitivityByOption,
  };
}
