import {
  EB_CATEGORIES,
  BULLETIN_TRACKER_HISTORY,
  type HistoricalBulletinRow,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import { type ForecastPolicy } from "@/lib/forecast";
import {
  fmtDate,
  fmtDuration,
  monthsBetweenDates,
  parseDateStr,
} from "@/lib/trackerUtils";

export const TODAY = new Date();

const MONTH_FULL_NAMES: Record<string, string> = {
  Jan: "january",
  Feb: "february",
  Mar: "march",
  Apr: "april",
  May: "may",
  Jun: "june",
  Jul: "july",
  Aug: "august",
  Sep: "september",
  Oct: "october",
  Nov: "november",
  Dec: "december",
};

export type ScenarioKey =
  | "optimistic"
  | "base"
  | "conservative"
  | "pessimistic";

export type AssumptionSettings = {
  spilloverLevel: "low" | "moderate" | "high";
  banContinues: "2027" | "2028" | "2029";
  wastageLevel: "low" | "moderate" | "high";
};

export type BulletinFadKey = "eb1_fad" | "eb2_fad" | "eb3_fad";
export type BulletinDofKey = "eb1_dof" | "eb2_dof" | "eb3_dof";
export type HomeHistoryWindow = { start: number; end: number };
export type TrackerCategory = (typeof EB_CATEGORIES)[TrackerCategoryKey];

export function bulletinUrl(month: string): string {
  const [mon, year] = month.split(" ");
  const monthName = MONTH_FULL_NAMES[mon] ?? mon.toLowerCase();
  const fy = Number(
    mon === "Oct" || mon === "Nov" || mon === "Dec" ? Number(year) + 1 : year
  );
  return `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fy}/visa-bulletin-for-${monthName}-${year}.html`;
}

function clampProbability(value: number): number {
  return Math.min(Math.max(value, 0), 0.95);
}

export function applyAssumptionRates(
  rates: Record<ScenarioKey, number>,
  { spilloverLevel, banContinues, wastageLevel }: AssumptionSettings
): Record<ScenarioKey, number> {
  const spilloverMultiplier =
    spilloverLevel === "high" ? 1.25 : spilloverLevel === "low" ? 0.75 : 1.0;
  const banMultiplier =
    banContinues === "2029" ? 1.15 : banContinues === "2027" ? 0.85 : 1.0;
  const wastageMultiplier =
    wastageLevel === "high" ? 0.8 : wastageLevel === "low" ? 1.1 : 1.0;
  const combined = spilloverMultiplier * banMultiplier * wastageMultiplier;

  return {
    optimistic: +(rates.optimistic * combined).toFixed(3),
    base: +(rates.base * combined).toFixed(3),
    conservative: +(rates.conservative * combined).toFixed(3),
    pessimistic: +(rates.pessimistic * combined).toFixed(3),
  };
}

export function buildForecastPolicy(args: {
  scenario: ScenarioKey;
  category: TrackerCategoryKey;
  spilloverLevel: "low" | "moderate" | "high";
  banContinues: "2027" | "2028" | "2029";
  wastageLevel: "low" | "moderate" | "high";
}): ForecastPolicy {
  const baseByScenario: Record<
    ScenarioKey,
    ForecastPolicy["eventProbabilities"]
  > = {
    optimistic: {
      stall: 0.18,
      smallAdvance: 0.32,
      retrogression: 0.08,
      unavailable: 0.02,
    },
    base: {
      stall: 0.32,
      smallAdvance: 0.18,
      retrogression: 0.18,
      unavailable: 0.04,
    },
    conservative: {
      stall: 0.4,
      smallAdvance: 0.08,
      retrogression: 0.28,
      unavailable: 0.08,
    },
    pessimistic: {
      stall: 0.35,
      smallAdvance: 0.03,
      retrogression: 0.42,
      unavailable: 0.15,
    },
  };

  const riskAdjustment =
    (args.spilloverLevel === "low"
      ? 0.05
      : args.spilloverLevel === "high"
        ? -0.04
        : 0) +
    (args.banContinues === "2027"
      ? 0.04
      : args.banContinues === "2029"
        ? -0.02
        : 0) +
    (args.wastageLevel === "high"
      ? 0.05
      : args.wastageLevel === "low"
        ? -0.02
        : 0);

  const base = baseByScenario[args.scenario];
  const categoryRetrogression =
    args.category === "EB1"
      ? { min: 1.5, max: 5 }
      : args.category === "EB3"
        ? { min: 1, max: 4 }
        : { min: 2, max: 8 };
  const shockMultiplier =
    args.scenario === "pessimistic"
      ? 1.35
      : args.scenario === "conservative"
        ? 1.15
        : args.scenario === "optimistic"
          ? 0.75
          : 1;

  return {
    windowMonths: 12,
    eventProbabilities: {
      stall: clampProbability(base.stall + riskAdjustment * 0.6),
      smallAdvance: clampProbability(base.smallAdvance - riskAdjustment),
      retrogression: clampProbability(base.retrogression + riskAdjustment),
      unavailable: clampProbability(
        base.unavailable + Math.max(riskAdjustment, 0) * 0.5
      ),
    },
    stallMonths:
      args.scenario === "pessimistic"
        ? { min: 3, max: 8 }
        : args.scenario === "conservative"
          ? { min: 2, max: 5 }
          : { min: 1, max: 3 },
    smallAdvanceMonths:
      args.scenario === "optimistic"
        ? { min: 0.5, max: 1.75 }
        : { min: 0.25, max: 1 },
    retrogressionMonths: {
      min: categoryRetrogression.min * shockMultiplier,
      max: categoryRetrogression.max * shockMultiplier,
    },
    unavailableMonths:
      args.scenario === "pessimistic" ? { min: 4, max: 9 } : { min: 2, max: 5 },
    dofRetrogressionShare: 0.25,
  };
}

export function fmtProjectionDate(date: Date, capped: boolean): string {
  if (capped) {
    const year = new Date().getFullYear() + 20;
    return `>${year}`;
  }
  return fmtDate(date);
}

export function fmtProjectionDateRange(
  p10: Date,
  p90: Date,
  p90Capped: boolean
): string {
  return `${fmtDate(p10)} - ${p90Capped ? "beyond horizon" : fmtDate(p90)}`;
}

export function fmtProjectionDuration(months: number, capped: boolean): string {
  return capped ? `>${fmtDuration(months)}` : fmtDuration(months);
}

export function fmtSensitivityDelta(deltaMonths: number): string {
  if (deltaMonths === 0) return "No change";
  const abs = Math.abs(Math.round(deltaMonths));
  return deltaMonths > 0 ? `${abs} mo later` : `${abs} mo earlier`;
}

export function getHistoricalPointInsight(
  point: { month: string; fadRaw: number; dofRaw: number },
  targetDate: string
) {
  const fadDate = new Date(point.fadRaw);
  const dofDate = new Date(point.dofRaw);
  const target = parseDateStr(targetDate);
  const gapToTarget = Math.round(monthsBetweenDates(fadDate, target));
  const dofLead = Math.max(
    0,
    Math.round(monthsBetweenDates(fadDate, dofDate) * 10) / 10
  );

  return {
    month: point.month,
    fadDate,
    dofDate,
    target,
    dofLead,
    targetStatus:
      gapToTarget === 0
        ? "Matches your priority date"
        : gapToTarget > 0
          ? `${fmtDuration(gapToTarget)} behind your priority date`
          : `${fmtDuration(Math.abs(gapToTarget))} past your priority date`,
  };
}

export function historicalCategoryKeys(category: TrackerCategoryKey) {
  if (category === "EB1")
    return { fadKey: "eb1_fad", dofKey: "eb1_dof" } as const;
  if (category === "EB3")
    return { fadKey: "eb3_fad", dofKey: "eb3_dof" } as const;
  return { fadKey: "eb2_fad", dofKey: "eb2_dof" } as const;
}

export function buildHistoricalSeries(
  rows: HistoricalBulletinRow[],
  category: TrackerCategoryKey
) {
  const { fadKey, dofKey } = historicalCategoryKeys(category);

  return [...rows].reverse().map((row, index) => {
    const fadDate = parseDateStr(row[fadKey]);
    const dofDate = parseDateStr(row[dofKey]);
    return {
      month: row.month,
      idx: index,
      fad: fadDate.getTime(),
      dof: dofDate.getTime(),
      fadRaw: fadDate.getTime(),
      dofRaw: dofDate.getTime(),
      fadLabel: fmtDate(fadDate),
      dofLabel: fmtDate(dofDate),
    };
  });
}

export type HistoricalChartPoint = ReturnType<
  typeof buildHistoricalSeries
>[number];

export function clipHistoricalSeries<
  T extends { fadRaw: number; dofRaw: number },
>(points: T[], quantile: number = 0.1) {
  if (points.length === 0) return points;
  const sortedFads = points.map(point => point.fadRaw).sort((a, b) => a - b);
  const floor = sortedFads[Math.floor(sortedFads.length * quantile)];

  return points.map(point => ({
    ...point,
    fad: Math.max(point.fadRaw, floor),
    dof: Math.max(point.dofRaw, floor),
  }));
}

const FULL_HISTORY_CHRONO = [...BULLETIN_TRACKER_HISTORY].reverse();
const DEFAULT_HISTORY_START_INDEX = FULL_HISTORY_CHRONO.findIndex(
  row => row.month === "Oct 2022"
);
const ARCHIVE_HISTORY_END_INDEX = FULL_HISTORY_CHRONO.findIndex(
  row => row.month === "Sep 2022"
);

export const DEFAULT_HISTORY_WINDOW: HomeHistoryWindow = {
  start:
    DEFAULT_HISTORY_START_INDEX >= 0
      ? DEFAULT_HISTORY_START_INDEX
      : Math.max(0, FULL_HISTORY_CHRONO.length - 43),
  end: FULL_HISTORY_CHRONO.length - 1,
};

export const ARCHIVE_HISTORY_WINDOW: HomeHistoryWindow = {
  start: 0,
  end:
    ARCHIVE_HISTORY_END_INDEX >= 0
      ? ARCHIVE_HISTORY_END_INDEX
      : Math.max(0, DEFAULT_HISTORY_WINDOW.start - 1),
};
