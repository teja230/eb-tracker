/**
 * EB Priority Date Tracker
 *
 * DESIGN: Civic Tech Policy Dashboard
 * - Slate blue primary, teal for advancement, amber for caution, red for retrogression
 * - DM Sans + DM Mono typography
 * - Data-forward, trustworthy, professional
 *
 * ALGORITHM (v8 — Probabilistic Dual-Cutoff Simulator):
 *
 * The forecast now simulates both FAD and DoF month by month instead of
 * converting the entire gap with a single fixed rate. Each projected bulletin
 * month combines:
 *
 * 1. The scenario's base FAD rate (still controlled by spillover / ban / wastage
 *    assumptions in the Scenarios tab)
 * 2. A historical FY-month movement pattern derived from verified bulletin data
 * 3. A sampled residual from that FY-month's historical movement bucket
 * 4. A demand-density slowdown using a hybrid curve built from USCIS I-485
 *    inventory and scaled I-140 approvals
 *
 * That gives a path simulator which can produce both surges and retrogression,
 * separate DoF and FAD forecasts, and a rolling 6-month backtest.
 *
 * Density data sources:
 *   Primary: USCIS I-485 Pending Inventory (as of Oct 2, 2025) — actual queue depth
 *   Fallback: USCIS I-140 Performance Data (FY2025 Q3) — proxy for PD years beyond inventory
 *
 * Scenario rates (calibrated against PD-2012 density era for EB-2/EB-3):
 *   Optimistic  : 1.625 PD-mo/month (large FY2027 spillover 60k+)
 *   Base Case   : 0.85  PD-mo/month (moderate spillover, mid-year correction)
 *   Conservative: 0.45  PD-mo/month (no spillover, reversion to pre-FY2026 pace)
 *   Pessimistic : 0.275 PD-mo/month (ban reversed, stagnation returns)
 *
 * DoF leads FAD by ~6 months historically.
 * GC receipt follows FAD by ~12–18 months.
 *
 * Sources:
 *   - DOS Visa Bulletins Oct 2022–June 2026 (travel.state.gov)
 *   - USCIS I-485 Pending Inventory, Oct 2025 (uscis.gov)
 *   - USCIS I-140 Performance Data, FY2025 Q3 (uscis.gov)
 *   - Cato Institute immigration policy analysis
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, ReferenceDot, Area, ReferenceArea } from 'recharts';
import { TrendingUp, Calendar, Download, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import PriorityDatePicker from '@/components/PriorityDatePicker';
import { ConfidenceRangeChart } from '@/components/ConfidenceRangeChart';
import {
  AskEBTracker,
  CategoryComparison,
  DataFreshnessPanel,
  FloatingChatWidget,
  TrustAndLimitationsPanel,
  WatchlistPanel,
  type CategoryComparisonRow,
  type SensitivityRow,
  type SourceLink,
} from '@/components/TrackerEnhancements';

import { useIsMobile } from '@/hooks/useMobile';
import {
  BULLETIN_TRACKER_HISTORY,
  CURRENT_BULLETIN,
  DATA_FRESHNESS,
  EB_CATEGORIES,
  HISTORICAL_BULLETINS,
  I140_INDIA_APPROVALS,
  I485_INDIA_PENDING,
  SCENARIOS,
  TRACKER_SOURCE_LINKS,
  type HistoricalBulletinRow,
  type TrackerCategoryKey,
} from '@/data/trackerData';
import {
  backtestForecast,
  buildDemandCurve,
  createForecastContext,
  forecastScenario,
  type BacktestSummary,
  type ForecastPolicy,
  type ForecastProjection,
} from '@/lib/forecast';
import {
  areConsecutiveBulletinMonths,
  MONTH_LABELS,
  fmtBulletinMonthLabel,
  fmtCompactMonthYear,
  fmtDate,
  fmtDateStr,
  fmtDuration,
  fmtYear,
  monthsBetween,
  monthsBetweenDates,
  movementLabel,
  parseBulletinMonth,
  parseDateStr,
  sumRecordValues,
} from '@/lib/trackerUtils';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TODAY = new Date(); // Always the current date — do NOT hardcode this

const MONTH_FULL_NAMES: Record<string, string> = {
  Jan: 'january', Feb: 'february', Mar: 'march', Apr: 'april',
  May: 'may', Jun: 'june', Jul: 'july', Aug: 'august',
  Sep: 'september', Oct: 'october', Nov: 'november', Dec: 'december',
};

function bulletinUrl(month: string): string {
  const [mon, year] = month.split(' ');
  const monthName = MONTH_FULL_NAMES[mon] ?? mon.toLowerCase();
  const fy = Number(mon === 'Oct' || mon === 'Nov' || mon === 'Dec' ? Number(year) + 1 : year);
  return `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/${fy}/visa-bulletin-for-${monthName}-${year}.html`;
}

type ScenarioKey = keyof typeof SCENARIOS;
type AssumptionSettings = {
  spilloverLevel: 'low' | 'moderate' | 'high';
  banContinues: '2027' | '2028' | '2029';
  wastageLevel: 'low' | 'moderate' | 'high';
};

function clampProbability(value: number): number {
  return Math.min(Math.max(value, 0), 0.95);
}

function applyAssumptionRates(
  rates: Record<ScenarioKey, number>,
  { spilloverLevel, banContinues, wastageLevel }: AssumptionSettings
): Record<ScenarioKey, number> {
  const spilloverMultiplier = spilloverLevel === 'high' ? 1.25 : spilloverLevel === 'low' ? 0.75 : 1.0;
  const banMultiplier = banContinues === '2029' ? 1.15 : banContinues === '2027' ? 0.85 : 1.0;
  const wastageMultiplier = wastageLevel === 'high' ? 0.8 : wastageLevel === 'low' ? 1.1 : 1.0;
  const combined = spilloverMultiplier * banMultiplier * wastageMultiplier;

  return {
    optimistic: +(rates.optimistic * combined).toFixed(3),
    base: +(rates.base * combined).toFixed(3),
    conservative: +(rates.conservative * combined).toFixed(3),
    pessimistic: +(rates.pessimistic * combined).toFixed(3),
  };
}

function buildForecastPolicy(args: {
  scenario: ScenarioKey;
  category: TrackerCategoryKey;
  spilloverLevel: 'low' | 'moderate' | 'high';
  banContinues: '2027' | '2028' | '2029';
  wastageLevel: 'low' | 'moderate' | 'high';
}): ForecastPolicy {
  const baseByScenario: Record<ScenarioKey, ForecastPolicy['eventProbabilities']> = {
    optimistic: { stall: 0.18, smallAdvance: 0.32, retrogression: 0.08, unavailable: 0.02 },
    base: { stall: 0.32, smallAdvance: 0.18, retrogression: 0.18, unavailable: 0.04 },
    conservative: { stall: 0.4, smallAdvance: 0.08, retrogression: 0.28, unavailable: 0.08 },
    pessimistic: { stall: 0.35, smallAdvance: 0.03, retrogression: 0.42, unavailable: 0.15 },
  };

  const riskAdjustment =
    (args.spilloverLevel === 'low' ? 0.05 : args.spilloverLevel === 'high' ? -0.04 : 0) +
    (args.banContinues === '2027' ? 0.04 : args.banContinues === '2029' ? -0.02 : 0) +
    (args.wastageLevel === 'high' ? 0.05 : args.wastageLevel === 'low' ? -0.02 : 0);

  const base = baseByScenario[args.scenario];
  const categoryRetrogression =
    args.category === 'EB1'
      ? { min: 1.5, max: 5 }
      : args.category === 'EB3'
        ? { min: 1, max: 4 }
        : { min: 2, max: 8 };
  const shockMultiplier = args.scenario === 'pessimistic' ? 1.35 : args.scenario === 'conservative' ? 1.15 : args.scenario === 'optimistic' ? 0.75 : 1;

  return {
    windowMonths: 12,
    eventProbabilities: {
      stall: clampProbability(base.stall + riskAdjustment * 0.6),
      smallAdvance: clampProbability(base.smallAdvance - riskAdjustment),
      retrogression: clampProbability(base.retrogression + riskAdjustment),
      unavailable: clampProbability(base.unavailable + Math.max(riskAdjustment, 0) * 0.5),
    },
    stallMonths: args.scenario === 'pessimistic' ? { min: 3, max: 8 } : args.scenario === 'conservative' ? { min: 2, max: 5 } : { min: 1, max: 3 },
    smallAdvanceMonths: args.scenario === 'optimistic' ? { min: 0.5, max: 1.75 } : { min: 0.25, max: 1 },
    retrogressionMonths: {
      min: categoryRetrogression.min * shockMultiplier,
      max: categoryRetrogression.max * shockMultiplier,
    },
    unavailableMonths: args.scenario === 'pessimistic' ? { min: 4, max: 9 } : { min: 2, max: 5 },
    dofRetrogressionShare: 0.25,
  };
}

function fmtProjectionDate(date: Date, capped: boolean): string {
  if (capped) {
    // The model's simulation horizon (240 months / 20 years) was reached before the
    // priority date became current. Show a '>' label so users understand the estimate
    // is a lower bound, not a specific date.
    const year = new Date().getFullYear() + 20;
    return `>${year}`;
  }
  return fmtDate(date);
}

function fmtProjectionDateRange(p10: Date, p90: Date, p90Capped: boolean): string {
  return `${fmtDate(p10)} - ${p90Capped ? 'beyond horizon' : fmtDate(p90)}`;
}

function fmtProjectionDuration(months: number, capped: boolean): string {
  return capped ? `>${fmtDuration(months)}` : fmtDuration(months);
}

function fmtSensitivityDelta(deltaMonths: number): string {
  if (deltaMonths === 0) return 'No change';
  const abs = Math.abs(Math.round(deltaMonths));
  return deltaMonths > 0 ? `${abs} mo later` : `${abs} mo earlier`;
}

// Tracker data and shared helpers live in dedicated modules to keep Home focused
// on UI state, derived view models, and rendering.

function getHistoricalPointInsight(point: { month: string; fadRaw: number; dofRaw: number }, targetDate: string) {
  const fadDate = new Date(point.fadRaw);
  const dofDate = new Date(point.dofRaw);
  const target = parseDateStr(targetDate);
  const gapToTarget = Math.round(monthsBetweenDates(fadDate, target));
  const dofLead = Math.max(0, Math.round(monthsBetweenDates(fadDate, dofDate) * 10) / 10);

  return {
    month: point.month,
    fadDate,
    dofDate,
    target,
    dofLead,
    targetStatus: gapToTarget === 0 ? 'Matches your priority date' : gapToTarget > 0 ? `${fmtDuration(gapToTarget)} behind your priority date` : `${fmtDuration(Math.abs(gapToTarget))} past your priority date`,
  };
}

function historicalCategoryKeys(category: TrackerCategoryKey) {
  if (category === 'EB1') return { fadKey: 'eb1_fad', dofKey: 'eb1_dof' } as const;
  if (category === 'EB3') return { fadKey: 'eb3_fad', dofKey: 'eb3_dof' } as const;
  return { fadKey: 'eb2_fad', dofKey: 'eb2_dof' } as const;
}

function buildHistoricalSeries(rows: HistoricalBulletinRow[], category: TrackerCategoryKey) {
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

function clipHistoricalSeries<T extends { fadRaw: number; dofRaw: number }>(points: T[], quantile: number = 0.1) {
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
const DEFAULT_HISTORY_START_INDEX = FULL_HISTORY_CHRONO.findIndex(row => row.month === 'Oct 2022');
const ARCHIVE_HISTORY_END_INDEX = FULL_HISTORY_CHRONO.findIndex(row => row.month === 'Sep 2022');
const DEFAULT_HISTORY_WINDOW = {
  start: DEFAULT_HISTORY_START_INDEX >= 0 ? DEFAULT_HISTORY_START_INDEX : Math.max(0, FULL_HISTORY_CHRONO.length - 43),
  end: FULL_HISTORY_CHRONO.length - 1,
};
const ARCHIVE_HISTORY_WINDOW = {
  start: 0,
  end: ARCHIVE_HISTORY_END_INDEX >= 0 ? ARCHIVE_HISTORY_END_INDEX : Math.max(0, DEFAULT_HISTORY_WINDOW.start - 1),
};

// Forecast simulation now lives in client/src/lib/forecast.ts.

type BulletinFadKey = 'eb1_fad' | 'eb2_fad' | 'eb3_fad';
type BulletinDofKey = 'eb1_dof' | 'eb2_dof' | 'eb3_dof';

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Home() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<TrackerCategoryKey>('EB2'); // default to EB-2
  const [targetDate, setTargetDate] = useState('2016-08-01');
  const [lastToastDate, setLastToastDate] = useState('');
  const [dateFlash, setDateFlash] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  // Bulletin Tracker: keep FAD and DoF accordions independent
  const [expandedFadFYs, setExpandedFadFYs] = useState<Set<string>>(new Set(['FY2026']));
  const [expandedDofFYs, setExpandedDofFYs] = useState<Set<string>>(new Set(['FY2026']));
  const toggleFadFY = (fy: string) =>
    setExpandedFadFYs(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  const toggleDofFY = (fy: string) =>
    setExpandedDofFYs(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  const fadStarRowRef = useRef<HTMLTableRowElement>(null);
  const dofStarRowRef = useRef<HTMLTableRowElement>(null);
  type HistoricalChartPoint = ReturnType<typeof buildHistoricalSeries>[number];
  const [activeHistoricalPoint, setActiveHistoricalPoint] = useState<HistoricalChartPoint | null>(null);
  const [historyWindow, setHistoryWindow] = useState(DEFAULT_HISTORY_WINDOW);

  // Simulator controls (affect scenario rates)
  const [spilloverLevel, setSpilloverLevel] = useState<'low' | 'moderate' | 'high'>('high');
  const [banContinues, setBanContinues] = useState<'2027' | '2028' | '2029'>('2029');
  const [wastageLevel, setWastageLevel] = useState<'low' | 'moderate' | 'high'>('low');

  const cat = EB_CATEGORIES[selectedCategory];

  // ── Read URL params on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pd = params.get('pd');
    const cat = params.get('cat') as keyof typeof EB_CATEGORIES | null;
    const sp = params.get('sp') as 'low' | 'moderate' | 'high' | null;
    const ban = params.get('ban') as '2027' | '2028' | '2029' | null;
    const wst = params.get('wst') as 'low' | 'moderate' | 'high' | null;
    if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) setTargetDate(pd);
    if (cat && cat in EB_CATEGORIES) setSelectedCategory(cat);
    if (sp && ['low', 'moderate', 'high'].includes(sp)) setSpilloverLevel(sp);
    if (ban && ['2027', '2028', '2029'].includes(ban)) setBanContinues(ban);
    if (wst && ['low', 'moderate', 'high'].includes(wst)) setWastageLevel(wst);
  }, []);

  const handleDateChange = useCallback(
    (val: string) => {
      setTargetDate(val);
      if (val !== lastToastDate && val) {
        const d = parseDateStr(val);
        toast.success(`Projections updated for ${fmtDate(d)}`, {
          description: 'All scenarios and estimates have been recalculated.',
          duration: 3000,
          position: 'bottom-right',
        });
        setLastToastDate(val);
        setDateFlash(true);
        setTimeout(() => setDateFlash(false), 800);
      }
    },
    [lastToastDate]
  );

  // Compute adjusted rates based on simulator settings
  const adjustedRates = useMemo(() => {
    return applyAssumptionRates(cat.rates, { spilloverLevel, banContinues, wastageLevel });
  }, [selectedCategory, spilloverLevel, banContinues, wastageLevel, cat.rates]);

  // Bulletin keys for the selected category
  const fadKey: BulletinFadKey = selectedCategory === 'EB1' ? 'eb1_fad' : selectedCategory === 'EB3' ? 'eb3_fad' : 'eb2_fad';
  const dofKey: BulletinDofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';

  const categoryBulletins = useMemo(
    () =>
      [...HISTORICAL_BULLETINS].reverse().map(b => ({
        month: b.month,
        fad: b[fadKey] as string,
        dof: b[dofKey] as string,
      })),
    [fadKey, dofKey]
  );

  const demandInputs = useMemo(
    () => ({
      i485: I485_INDIA_PENDING[selectedCategory] ?? {},
      i140: I140_INDIA_APPROVALS[selectedCategory] ?? {},
    }),
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

  const forecastStartMonthIndex = useMemo(() => (parseBulletinMonth(CURRENT_BULLETIN.month).getMonth() + 1) % 12, []);

  const pendingInventoryTotal = useMemo(() => sumRecordValues(demandInputs.i485), [demandInputs]);

  const forecastPolicies = useMemo(() => {
    const policies = {} as Record<ScenarioKey, ForecastPolicy>;
    for (const key of Object.keys(SCENARIOS) as ScenarioKey[]) {
      policies[key] = buildForecastPolicy({
        scenario: key,
        category: selectedCategory,
        spilloverLevel,
        banContinues,
        wastageLevel,
      });
    }
    return policies;
  }, [selectedCategory, spilloverLevel, banContinues, wastageLevel]);

  // Compute projections for all scenarios (probabilistic dual-cutoff simulator)
  const projections = useMemo(() => {
    const result: Record<string, ForecastProjection> = {};
    for (const key of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>) {
      result[key] = forecastScenario({
        context: forecastContext,
        today: TODAY,
        currentFad: cat.currentFAD,
        currentDof: cat.currentDoF,
        targetDate,
        baseFadRate: adjustedRates[key],
        gcLagMonths: cat.gcLagMonths,
        seasonalityStartMonth: forecastStartMonthIndex,
        policy: forecastPolicies[key],
        paths: 500,
        maxMonths: 240,
        seed: `${selectedCategory}:${targetDate}:${key}:${spilloverLevel}:${banContinues}:${wastageLevel}`,
      });
    }
    return result;
  }, [forecastContext, cat.currentFAD, cat.currentDoF, cat.gcLagMonths, targetDate, adjustedRates, selectedCategory, spilloverLevel, banContinues, wastageLevel, forecastStartMonthIndex, forecastPolicies]);

  // Backtest the same simulator used for live forecasts.
  const backtestResult: BacktestSummary = useMemo(
    () =>
      backtestForecast({
        bulletins: categoryBulletins,
        demand: demandInputs,
        baseFadRate: cat.rates.base,
        gcLagMonths: cat.gcLagMonths,
        horizonMonths: 6,
        paths: 200,
        seed: `${selectedCategory}:backtest`,
      }),
    [categoryBulletins, demandInputs, cat.rates.base, cat.gcLagMonths, selectedCategory]
  );

  const overviewProjection = projections.optimistic;
  const gapMonths = Math.max(0, Math.round(monthsBetween(cat.currentFAD, targetDate)));
  const overviewAssumptionSummary = useMemo(() => {
    const spilloverSummary =
      spilloverLevel === 'high'
        ? 'high spillover (~70k+ extra EB visas in FY2027)'
        : spilloverLevel === 'moderate'
          ? 'moderate spillover (30-40k extra EB visas in FY2027)'
          : 'low spillover (~30k extra EB visas in FY2027)';
    const banSummary = `ban through ${banContinues}`;
    const wastageSummary =
      wastageLevel === 'low' ? 'low wastage' : wastageLevel === 'moderate' ? 'moderate wastage' : 'high wastage';
    return `${spilloverSummary}, ${banSummary}, and ${wastageSummary}`;
  }, [spilloverLevel, banContinues, wastageLevel]);

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
      fullHistoricalChartData.slice(clampedHistoryWindow.start, clampedHistoryWindow.end + 1)
    );
  }, [clampedHistoryWindow.end, clampedHistoryWindow.start, fullHistoricalChartData]);

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
    return historicalChartData.filter(d => d.month.startsWith('Oct ')).map(d => d.month);
  }, [historicalChartData]);

  const accelZone = useMemo(() => {
    const start = historicalChartData.find(d => d.month === 'Oct 2025')?.month;
    const end = historicalChartData.find(d => d.month === 'Apr 2026')?.month;
    return start && end ? { x1: start, x2: end } : null;
  }, [historicalChartData]);

  const historicalXAxisTicks = useMemo(() => {
    const lastIdx = historicalChartData.length - 1;
    const firstIdx = 0;
    const anchors = new Set([firstIdx, lastIdx]);

    const ticks: string[] = [];

    historicalChartData.forEach((d, index) => {
      const isDesktopTick = d.month.startsWith('Apr ') || d.month.startsWith('Oct ');
      const isMobileTick = d.month.startsWith('Oct ');
      const isRegular = isMobile ? isMobileTick : isDesktopTick;

      // Drop regular ticks that are within 2 months of an anchor
      if (isRegular && !anchors.has(index)) {
        const tooCloseToAnchor = Array.from(anchors).some(a => Math.abs(index - a) < 3);
        if (!tooCloseToAnchor) ticks.push(d.month);
      }
    });

    // Anchors always win
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
  }, [clampedHistoryWindow.end, clampedHistoryWindow.start, fullHistoricalChartData]);

  const isRecentHistoryWindow =
    clampedHistoryWindow.start === DEFAULT_HISTORY_WINDOW.start &&
    clampedHistoryWindow.end === DEFAULT_HISTORY_WINDOW.end;
  const isArchiveHistoryWindow =
    clampedHistoryWindow.start === ARCHIVE_HISTORY_WINDOW.start &&
    clampedHistoryWindow.end === ARCHIVE_HISTORY_WINDOW.end;
  const isFullHistoryWindow =
    clampedHistoryWindow.start === 0 && clampedHistoryWindow.end === fullHistoricalChartData.length - 1;

  useEffect(() => {
    setActiveHistoricalPoint((prev: HistoricalChartPoint | null) => {
      if (historicalChartData.length === 0) return null;
      if (!prev) return historicalChartData[historicalChartData.length - 1];
      return historicalChartData.find(point => point.month === prev.month) ?? historicalChartData[historicalChartData.length - 1];
    });
  }, [historicalChartData]);

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
      const move = movementLabel(previous[fadKey] as string, current[fadKey] as string);
      monthlyMoves.push({
        month: current.month,
        ...move,
        months: Math.round((move.days / 30.44) * 10) / 10,
      });
    }

    const latest = monthlyMoves[0];
    const trailingMoves = monthlyMoves.slice(0, Math.min(6, monthlyMoves.length));
    const trailingTotal = Math.round(trailingMoves.reduce((sum, move) => sum + move.months, 0) * 10) / 10;
    const maxAdvanceDays = Math.max(...monthlyMoves.map(move => move.days), 0);

    const headline =
      latest.type === 'stable'
        ? `No change in ${latest.month}`
        : `${latest.days > 0 ? '+' : ''}${Math.round(latest.months)} mo in ${latest.month}`;

    const trailingSummary = `${trailingTotal > 0 ? '+' : ''}${trailingTotal} PD-months total across the last ${trailingMoves.length} moves.`;

    let detail = trailingSummary;
    if (latest.type === 'advancement' && latest.days === maxAdvanceDays) {
      detail = `Largest single-month ${cat.label} India advancement in this tracker. ${trailingSummary}`;
    } else if (latest.type === 'advancement') {
      detail = `Latest bulletin advanced by ${Math.abs(Math.round(latest.months))} PD-months. ${trailingSummary}`;
    } else if (latest.type === 'retrogression') {
      detail = `Latest bulletin retrogressed by ${Math.abs(Math.round(latest.months))} PD-months. ${trailingSummary}`;
    } else {
      detail = `Latest bulletin was unchanged. ${trailingSummary}`;
    }

    return { headline, detail };
  }, [cat.label, fadKey]);

  // Demand density chart data: pending I-485s + scaled I-140 by PD year
  const demandDensityData = useMemo(() => {
    const catKey = selectedCategory;
    const i485 = I485_INDIA_PENDING[catKey] ?? {};
    const i140 = I140_INDIA_APPROVALS[catKey] ?? {};
    const demandCurve = buildDemandCurve({ i485, i140 });
    const scaleFactor = demandCurve.scaleFactor;

    // Collect all years, determine range around current FAD and target PD
    const fadYear = parseDateStr(cat.currentFAD).getFullYear();
    const targetYear = parseDateStr(targetDate).getFullYear();
    const allI485Years = Object.keys(i485)
      .map(Number)
      .filter(y => i485[y] > 0);
    const allI140Years = Object.keys(i140).map(Number);
    const minYear = Math.min(fadYear - 2, ...allI485Years, ...allI140Years);
    const maxYear = Math.max(targetYear + 1, ...allI485Years, ...allI140Years);

    const bars: {
      year: string;
      pending: number;
      source: string;
      isTarget: boolean;
      isCurrent: boolean;
    }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const i485Val = i485[y];
      const i140Val = i140[y];
      let pending = 0;
      let source = 'none';
      if (i485Val !== undefined && i485Val > 0) {
        pending = i485Val;
        source = 'I-485';
      } else if (i140Val !== undefined) {
        pending = Math.round(i140Val * scaleFactor);
        source = 'I-140 (scaled)';
      }
      if (pending > 0) {
        bars.push({
          year: String(y),
          pending,
          source,
          isTarget: y === targetYear,
          isCurrent: y === fadYear,
        });
      }
    }
    return bars;
  }, [selectedCategory, targetDate, cat.currentFAD]);

  // Scenario comparison chart data
  const scenarioChartData = useMemo(() => {
    return Object.entries(SCENARIOS).map(([key, s]) => ({
      name: s.label,
      months: projections[key]?.monthsFromToday ?? 0,
      year: projections[key]?.fadDate ? fmtYear(projections[key].fadDate) : '—',
      color: s.color,
    }));
  }, [projections]);

  const currentCutoffs = useMemo(
    () => ({
      EB1: { fad: EB_CATEGORIES.EB1.currentFAD, dof: EB_CATEGORIES.EB1.currentDoF },
      EB2: { fad: EB_CATEGORIES.EB2.currentFAD, dof: EB_CATEGORIES.EB2.currentDoF },
      EB3: { fad: EB_CATEGORIES.EB3.currentFAD, dof: EB_CATEGORIES.EB3.currentDoF },
    }),
    []
  );

  const trackerSourceLinks = useMemo(
    () => [
      {
        label: `${CURRENT_BULLETIN.month} Bulletin`,
        href: bulletinUrl(CURRENT_BULLETIN.month),
        detail: 'Official current-month employment-based cutoff source.',
      },
      ...TRACKER_SOURCE_LINKS,
    ],
    []
  );

  const categoryComparisonRows: CategoryComparisonRow[] = useMemo(() => {
    const prevRow = HISTORICAL_BULLETINS[1]; // [0] = current, [1] = previous
    const prevBulletinLabel = prevRow?.month ?? 'prior';

    return (Object.keys(EB_CATEGORIES) as TrackerCategoryKey[]).map(category => {
      const comparisonCat = EB_CATEGORIES[category];
      const keys = historicalCategoryKeys(category);

      // MoM movement from previous bulletin
      const fadMove = prevRow
        ? movementLabel(prevRow[keys.fadKey], comparisonCat.currentFAD)
        : { label: '—', type: 'stable' as const, days: 0 };
      const dofMove = prevRow
        ? movementLabel(prevRow[keys.dofKey], comparisonCat.currentDoF)
        : { label: '—', type: 'stable' as const, days: 0 };

      // Base-case FAD estimate (reuse the primary category's forecastContext for speed if same category)
      const bulletins = [...HISTORICAL_BULLETINS].reverse().map(row => ({
        month: row.month,
        fad: row[keys.fadKey],
        dof: row[keys.dofKey],
      }));
      const context = createForecastContext({
        bulletins,
        demand: {
          i485: I485_INDIA_PENDING[category] ?? {},
          i140: I140_INDIA_APPROVALS[category] ?? {},
        },
      });
      const rates = applyAssumptionRates(comparisonCat.rates, { spilloverLevel, banContinues, wastageLevel });
      const policy = buildForecastPolicy({ scenario: 'base', category, spilloverLevel, banContinues, wastageLevel });
      const projection = forecastScenario({
        context,
        today: TODAY,
        currentFad: comparisonCat.currentFAD,
        currentDof: comparisonCat.currentDoF,
        targetDate,
        baseFadRate: rates.base,
        gcLagMonths: comparisonCat.gcLagMonths,
        seasonalityStartMonth: forecastStartMonthIndex,
        policy,
        paths: 200,
        maxMonths: 240,
        seed: `${category}:${targetDate}:comparison:${spilloverLevel}:${banContinues}:${wastageLevel}`,
      });
      const gap = Math.max(0, Math.round(monthsBetween(comparisonCat.currentFAD, targetDate)));

      return {
        category,
        label: comparisonCat.label,
        name: comparisonCat.name,
        currentFadLabel: fmtDateStr(comparisonCat.currentFAD),
        currentDofLabel: fmtDateStr(comparisonCat.currentDoF),
        fadMove,
        dofMove,
        prevBulletinLabel,
        gapLabel: gap > 0 ? fmtDuration(gap) : 'Current',
        fadEstLabel: projection.isAlreadyCurrent ? 'Current' : fmtProjectionDate(projection.fadDate, projection.horizon.fadP50Capped),
        isSelected: category === selectedCategory,
      };
    });
  }, [banContinues, forecastStartMonthIndex, selectedCategory, spilloverLevel, targetDate, wastageLevel]);

  const sensitivityRows: SensitivityRow[] = useMemo(() => {
    const baseline = projections.base;
    if (!baseline) return [];

    const optionGroups: Array<{
      control: string;
      values: Array<{ label: string; settings: AssumptionSettings; selected: boolean }>;
    }> = [
      {
        control: 'Spillover',
        values: [
          { label: 'Low', settings: { spilloverLevel: 'low', banContinues, wastageLevel }, selected: spilloverLevel === 'low' },
          { label: 'Moderate', settings: { spilloverLevel: 'moderate', banContinues, wastageLevel }, selected: spilloverLevel === 'moderate' },
          { label: 'High', settings: { spilloverLevel: 'high', banContinues, wastageLevel }, selected: spilloverLevel === 'high' },
        ],
      },
      {
        control: 'Ban duration',
        values: [
          { label: 'Through 2027', settings: { spilloverLevel, banContinues: '2027', wastageLevel }, selected: banContinues === '2027' },
          { label: 'Through 2028', settings: { spilloverLevel, banContinues: '2028', wastageLevel }, selected: banContinues === '2028' },
          { label: 'Through 2029', settings: { spilloverLevel, banContinues: '2029', wastageLevel }, selected: banContinues === '2029' },
        ],
      },
      {
        control: 'Wastage',
        values: [
          { label: 'Low', settings: { spilloverLevel, banContinues, wastageLevel: 'low' }, selected: wastageLevel === 'low' },
          { label: 'Moderate', settings: { spilloverLevel, banContinues, wastageLevel: 'moderate' }, selected: wastageLevel === 'moderate' },
          { label: 'High', settings: { spilloverLevel, banContinues, wastageLevel: 'high' }, selected: wastageLevel === 'high' },
        ],
      },
    ];

    return optionGroups.flatMap(group =>
      group.values.map(option => {
        const rates = applyAssumptionRates(cat.rates, option.settings);
        const policy = buildForecastPolicy({
          scenario: 'base',
          category: selectedCategory,
          ...option.settings,
        });
        const projection = forecastScenario({
          context: forecastContext,
          today: TODAY,
          currentFad: cat.currentFAD,
          currentDof: cat.currentDoF,
          targetDate,
          baseFadRate: rates.base,
          gcLagMonths: cat.gcLagMonths,
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
          dateLabel: fmtProjectionDate(projection.fadDate, projection.horizon.fadP50Capped),
          deltaMonths: Math.round(projection.fadMonths.p50 - baseline.fadMonths.p50),
          selected: option.selected,
        };
      })
    );
  }, [banContinues, cat.currentDoF, cat.currentFAD, cat.gcLagMonths, cat.rates, forecastContext, forecastStartMonthIndex, projections.base, selectedCategory, spilloverLevel, targetDate, wastageLevel]);

  const sensitivityByOption = useMemo(() => {
    const map = new Map<string, SensitivityRow>();
    sensitivityRows.forEach(row => map.set(`${row.control}:${row.value}`, row));
    return map;
  }, [sensitivityRows]);

  const generateShareUrl = useCallback(() => {
    const params = new URLSearchParams({
      pd: targetDate,
      cat: selectedCategory,
      sp: spilloverLevel,
      ban: banContinues,
      wst: wastageLevel,
    });
    const base = window.location.origin + window.location.pathname;
    return `${base}?${params.toString()}`;
  }, [targetDate, selectedCategory, spilloverLevel, banContinues, wastageLevel]);

  const handleShare = useCallback(async () => {
    const url = generateShareUrl();
    const overviewFadDate = overviewProjection?.fadDate;
    const fadMonthYear = overviewFadDate ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][overviewFadDate.getMonth()]} ${overviewFadDate.getFullYear()}` : 'unknown';
    const overviewDofDate = overviewProjection?.dofDate;
    const dofMonthYear = overviewDofDate ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][overviewDofDate.getMonth()]} ${overviewDofDate.getFullYear()}` : null;
    const summary = dofMonthYear
      ? `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) — can file I-485 around ${dofMonthYear}, become current around ${fadMonthYear} (best case).`
      : `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) is estimated to become current around ${fadMonthYear} (best case).`;
    const sentence = `${summary} ${url}`;
    const copyShareText = async () => {
      await navigator.clipboard.writeText(sentence);
      setShareCopied(true);
      toast.success('Estimate copied to clipboard!', {
        description: sentence.length > 80 ? sentence.slice(0, 80) + '…' : sentence,
        duration: 4000,
        position: 'bottom-right',
      });
      setTimeout(() => setShareCopied(false), 3000);
    };

    try {
      if (isMobile && typeof navigator.share === 'function') {
        await navigator.share({
          title: `${cat.label} India estimate`,
          text: summary,
          url,
        });
        return;
      }

      await copyShareText();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      try {
        await copyShareText();
        return;
      } catch {
        // Fall through to prompt fallback below.
      }

      // Fallback: show in prompt
      window.prompt('Copy this to share your estimate:', sentence);
    }
  }, [generateShareUrl, overviewProjection, cat.label, targetDate, isMobile]);

  const generateExport = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Helper: add new page if needed ──
    const checkPage = (needed = 12) => {
      if (y + needed > 272) {
        doc.addPage();
        y = 20;
      }
    };

    // ── Header band ──
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('EB Priority Date Tracker', margin, 13);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('India · EB-1, EB-2, EB-3 · Personalized Estimate', margin, 20);
    doc.text(`Generated: ${fmtDate(new Date())}`, margin, 26);
    // Site link in header
    const siteUrl = window.location.origin;
    doc.setTextColor(99, 179, 237);
    doc.textWithLink(siteUrl, pageW - margin - doc.getTextWidth(siteUrl), 26, {
      url: siteUrl,
    });
    y = 42;

    // ── Section: Your Priority Date ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('YOUR PRIORITY DATE', margin, y);
    y += 5;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(fmtDateStr(targetDate), margin + 6, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Category: ${cat.label} — ${cat.name}`, margin + 6, y + 16);
    // Current FAD / Gap / DoF stats
    const statX = margin + contentW * 0.45;
    const statCols = [
      { label: 'CURRENT FAD', val: fmtDateStr(cat.currentFAD) },
      { label: 'GAP', val: fmtDuration(gapMonths) },
      { label: 'CURRENT DOF', val: fmtDateStr(cat.currentDoF) },
    ];
    statCols.forEach((st, i) => {
      const sx = statX + i * ((contentW * 0.55) / 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(st.label, sx, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(st.val, sx, y + 14);
    });
    y += 30;

    // ── Section: Best Case Projection ──
    checkPage(38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('BEST CASE PROJECTION', margin, y);
    y += 4;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F');
    const bp = overviewProjection;
    const bpCols = [
      {
        label: 'FILING DATE (DOF)',
        val: bp.isAlreadyCurrent ? 'Current' : fmtDate(bp.dofDate),
        sub: 'Can file I-485',
      },
      {
        label: 'FINAL ACTION DATE',
        val: bp.isAlreadyCurrent ? 'Current' : fmtDate(bp.fadDate),
        sub: 'Visa becomes available',
      },
      {
        label: 'GC RECEIPT EST.',
        val: bp.isAlreadyCurrent ? 'Current' : fmtDate(bp.gcDate),
        sub: `~${fmtDuration(cat.gcLagMonths)} after FAD`,
      },
      {
        label: 'TIME TO FAD',
        val: fmtDuration(bp.monthsFromToday),
        sub: 'Best case estimate',
      },
    ];
    bpCols.forEach((col, i) => {
      const cx = margin + 6 + i * (contentW / 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(col.label, cx, y + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(col.val, cx, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(col.sub, cx, y + 22);
    });
    y += 36;

    // ── Section: Assumption Settings ──
    checkPage(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('ASSUMPTION SETTINGS', margin, y);
    y += 4;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, y, contentW, 16, 2, 2, 'F');
    const assumptions = [
      {
        label: 'Spillover',
        val: spilloverLevel.charAt(0).toUpperCase() + spilloverLevel.slice(1),
      },
      { label: 'Ban Duration', val: `Through ${banContinues}` },
      {
        label: 'Wastage',
        val: wastageLevel.charAt(0).toUpperCase() + wastageLevel.slice(1),
      },
    ];
    assumptions.forEach((a, i) => {
      const ax = margin + 6 + i * (contentW / 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(a.label.toUpperCase(), ax, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(a.val, ax, y + 13);
    });
    y += 24;

    // ── Section: All Scenarios ──
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('SCENARIO RANGE — ALL OUTCOMES', margin, y);
    y += 5;

    // Table header
    const cols = ['Scenario', 'Probability', 'DoF Estimate', 'FAD Estimate', 'GC Receipt', 'Time to FAD'];
    const colW = [32, 22, 32, 32, 32, 24];
    let cx2 = margin;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, contentW, 7, 'F');
    cols.forEach((c, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(c, cx2 + 2, y + 4.8);
      cx2 += colW[i];
    });
    y += 7;

    // Table rows
    const scenarioColors: Record<string, [number, number, number]> = {
      optimistic: [16, 185, 129],
      base: [59, 130, 246],
      conservative: [245, 158, 11],
      pessimistic: [239, 68, 68],
    };
    Object.entries(SCENARIOS).forEach(([key, s], rowIdx) => {
      checkPage(9);
      const p = projections[key];
      const rowBg: [number, number, number] = rowIdx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
      doc.setFillColor(...rowBg);
      doc.rect(margin, y, contentW, 8, 'F');
      // Color accent bar
      const [r, g, b] = scenarioColors[key] ?? [100, 116, 139];
      doc.setFillColor(r, g, b);
      doc.rect(margin, y, 2.5, 8, 'F');
      const rowData = [s.label, s.probability, p.isAlreadyCurrent ? 'Current' : fmtDate(p.dofDate), p.isAlreadyCurrent ? 'Current' : fmtDate(p.fadDate), p.isAlreadyCurrent ? 'Current' : fmtDate(p.gcDate), p.isAlreadyCurrent ? '0' : fmtDuration(p.monthsFromToday)];
      let rx = margin + 3.5;
      rowData.forEach((cell, i) => {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(cell, rx, y + 5.2);
        rx += colW[i];
      });
      y += 8;
    });
    y += 8;

    // ── Section: Methodology ──
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('METHODOLOGY', margin, y);
    y += 5;
    const methodLines = [
      'Uses a probabilistic month-by-month simulator for both FAD and DoF, rather than a single gap divided by one static rate.',
      'Each simulated bulletin month samples historical seasonality and volatility, then adjusts movement for demand density using USCIS I-485 inventory with scaled I-140 fallback data.',
      'Scenario assumptions still control the base FAD rate through spillover, ban duration, and wastage multipliers.',
      'Displayed dates are medians (P50) with an 80% interval, and the backtest badge reports 6-month FAD forecast MAE and interval hit rate.',
    ];
    methodLines.forEach(line => {
      checkPage(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const wrapped = doc.splitTextToSize(line, contentW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.5;
    });
    y += 6;

    // ── Disclaimer ──
    checkPage(16);
    doc.setFillColor(254, 243, 199); // amber-100
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text('DISCLAIMER', margin + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 53, 15);
    const disclaimer = 'Estimates are based on historical trends and current policy. Actual timelines may vary significantly. This is not legal advice — consult a licensed immigration attorney for guidance specific to your situation.';
    const dLines = doc.splitTextToSize(disclaimer, contentW - 8);
    doc.text(dLines, margin + 4, y + 10);
    y += 20;

    // ── Footer ──
    const totalPages = (doc.internal as { getNumberOfPages?: () => number }).getNumberOfPages?.() ?? 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin, 290, {
        align: 'right',
      });
      doc.setTextColor(99, 179, 237);
      doc.textWithLink(siteUrl, margin, 290, { url: siteUrl });
    }

    doc.save(`EB-Estimate-${fmtDateStr(targetDate).replace(/[, ]/g, '')}.pdf`);
    toast.success('PDF exported!', { duration: 2000 });
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview', mobileLabel: '📊 Overview' },
    { id: 'scenarios', label: '📈 Scenarios', mobileLabel: '📈 Scenarios' },
    { id: 'tracker', label: '📋 Bulletin Tracker', mobileLabel: '📋 Tracker' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white sticky top-0 z-10" style={{ boxShadow: '0 1px 0 #e2e8f0' }}>
        {/* ── MOBILE: two-row layout (< md) ── */}
        <div className="md:hidden">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="bg-slate-900 text-white rounded-md px-2.5 py-1 font-black text-[11px] tracking-[0.15em] leading-none shrink-0">EB</div>
                <p className="truncate text-sm font-semibold text-slate-900">Priority Date Tracker</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleShare}
                  aria-label="Share estimate"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                    shareCopied ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {shareCopied ? <CheckCircle2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-100 p-1">
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(EB_CATEGORIES) as Array<keyof typeof EB_CATEGORIES>).map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition-all ${
                      selectedCategory === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {EB_CATEGORIES[c].label}
                  </button>
                ))}
              </div>
            </div>

            <nav className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-all ${
                    activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t.mobileLabel}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ── DESKTOP: single row (>= md) ── */}
        <div className="hidden md:block max-w-7xl mx-auto">
          <div className="flex items-stretch h-12 px-4">
            {/* EB badge */}
            <div className="flex items-center pr-4 shrink-0">
              <div className="bg-slate-900 text-white rounded-md px-2.5 py-1 font-black text-[11px] tracking-[0.15em] leading-none">EB</div>
            </div>
            <div className="w-px bg-slate-100 my-2.5 shrink-0" />
            {/* Category pills */}
            <div className="flex items-center gap-1 px-4 shrink-0">
              {(Object.keys(EB_CATEGORIES) as Array<keyof typeof EB_CATEGORIES>).map(c => (
                <button key={c} onClick={() => setSelectedCategory(c)} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${selectedCategory === c ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200'}`}>
                  <span className="font-bold">{EB_CATEGORIES[c].label}</span>
                  <span className={`hidden lg:inline font-normal ${selectedCategory === c ? 'text-slate-300' : 'text-slate-400'}`}> — {EB_CATEGORIES[c].name.split(' / ')[0]}</span>
                </button>
              ))}
            </div>
            <div className="w-px bg-slate-100 my-2.5 shrink-0" />
            {/* Nav tabs */}
            <nav className="flex items-stretch px-2 flex-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`relative px-4 text-sm font-semibold transition-colors flex items-center whitespace-nowrap ${activeTab === t.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}>
                  {t.label}
                  {activeTab === t.id && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-slate-900 rounded-full" />}
                </button>
              ))}
            </nav>
            {/* Utilities */}
            <div className="flex items-center gap-2 pl-2 shrink-0">
              <button onClick={handleShare} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${shareCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                {shareCopied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-3 h-3" /> Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* ── Target Date Picker ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-stretch">
            {/* Date input side */}
            <div className="flex-1 px-5 py-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Priority Date</label>
              <PriorityDatePicker value={targetDate} onChange={handleDateChange} />
              <p className="text-xs text-slate-400 mt-1.5">Change to see updated projections for any priority date.</p>
            </div>
            {/* Stats side */}
            <div className={`grid grid-cols-3 md:flex md:items-stretch md:divide-x divide-slate-200 border-t md:border-t-0 md:border-l transition-all duration-300 ${dateFlash ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
              {[
                {
                  label: 'Current FAD',
                  value: fmtDateStr(cat.currentFAD),
                  tip: 'Final Action Date — the cutoff date for visa availability',
                },
                {
                  label: 'Gap',
                  value: gapMonths > 0 ? fmtDuration(gapMonths) : 'Current',
                  tip: 'Months between your priority date and the current Final Action Date',
                },
                {
                  label: 'Current DoF',
                  value: fmtDateStr(cat.currentDoF),
                  tip: 'Dates for Filing — the earliest date you can submit I-485',
                },
              ].map(({ label, value, tip }) => (
                <div key={label} className="flex flex-col justify-center items-center px-3 py-3 md:px-5 md:py-4 md:min-w-[100px] group relative">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap mb-1 flex items-center gap-1">
                    {label}
                    <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-200 text-slate-400 text-[8px] font-bold cursor-help" title={tip}>
                      i
                    </span>
                  </p>
                  <p className="font-mono font-bold text-slate-800 text-sm md:text-sm whitespace-nowrap">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Hero Estimate */}
            {overviewProjection.isAlreadyCurrent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-emerald-700">Already Current!</p>
                <p className="text-sm text-slate-600 mt-1">{fmtDateStr(targetDate)} is already current as of the {CURRENT_BULLETIN.month} bulletin.</p>
              </div>
            ) : (
              <div className="relative -mt-2 overflow-hidden rounded-xl border border-slate-600/80 border-l-4 border-l-emerald-400 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 p-6 text-white md:-mt-0">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-1">Your Projection</h2>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-mono text-slate-300">{fmtDateStr(targetDate)}</span>
                  <span className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100">Best Case</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">Filing Date (DoF)</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">{fmtProjectionDate(overviewProjection.dofDate, overviewProjection.horizon.dofP50Capped)}</p>
                    <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
                    <p className="mt-1 text-[11px] text-slate-300">80% range: {fmtProjectionDateRange(overviewProjection.dofRange.p10, overviewProjection.dofRange.p90, overviewProjection.horizon.dofP90Capped)}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">Final Action Date</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">{fmtProjectionDate(overviewProjection.fadDate, overviewProjection.horizon.fadP50Capped)}</p>
                    <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
                    <p className="mt-1 text-[11px] text-slate-300">80% range: {fmtProjectionDateRange(overviewProjection.fadRange.p10, overviewProjection.fadRange.p90, overviewProjection.horizon.fadP90Capped)}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">GC Receipt Est.</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">{fmtProjectionDate(overviewProjection.gcDate, overviewProjection.horizon.gcP50Capped)}</p>
                    <p className="mt-1.5 text-xs text-slate-500">P50 estimate</p>
                    <p className="mt-1 text-[11px] text-slate-300">80% range: {fmtProjectionDateRange(overviewProjection.gcRange.p10, overviewProjection.gcRange.p90, overviewProjection.horizon.gcP90Capped)}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-300">Time to FAD</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight text-slate-50">{fmtProjectionDuration(overviewProjection.monthsFromToday, overviewProjection.horizon.fadP50Capped)}</p>
                    <p className="mt-1 text-xs text-slate-500">Best case median</p>
                    <p className="mt-1 text-[11px] text-slate-300">80% range: {fmtDuration(Math.round(overviewProjection.fadMonths.p10))} - {fmtProjectionDuration(Math.round(overviewProjection.fadMonths.p90), overviewProjection.horizon.fadP90Capped)}</p>
                  </div>
                </div>

                {/* Confidence Range Visualization */}
                <div className="mt-6 pt-6 border-t border-slate-600">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-300">80% Confidence Timeline</p>
                  <ConfidenceRangeChart
                    data={[
                      {
                        label: 'Filing Date (DoF)',
                        p10: overviewProjection.dofRange.p10,
                        p50: overviewProjection.dofDate,
                        p90: overviewProjection.dofRange.p90,
                      },
                      {
                        label: 'Final Action Date (FAD)',
                        p10: overviewProjection.fadRange.p10,
                        p50: overviewProjection.fadDate,
                        p90: overviewProjection.fadRange.p90,
                      },
                      {
                        label: 'GC Receipt Estimate',
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
                  <p>Best case uses the optimistic scenario with {overviewAssumptionSummary}. See Scenarios tab for the full range.</p>
                  <div className="flex items-center gap-3 text-[10px] shrink-0">
                    {backtestResult.predictions > 0 && (
                      <span className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200" title={`6-month backtest on ${backtestResult.predictions} rolling windows`}>
                        <Info className="w-3 h-3" />
                        MAE: ±{backtestResult.mae} mo
                      </span>
                    )}
                    {backtestResult.predictions > 0 && <span className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200" title="Share of 6-month backtest windows where the actual FAD landed inside the model's 80% interval">80% hit: {Math.round(backtestResult.coverage80 * 100)}%</span>}
                    <span className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200" title="Share of simulated paths with a near-term stall, unavailability, or bounded retrogression event in the next 12 bulletin months">Near-term risk: {Math.round(overviewProjection.nearTermRisk * 100)}%</span>
                    <span className="flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-700/60 px-2 py-0.5 text-slate-200" title="Share of simulated paths with a bounded one-time backward FAD movement">Retro shock: {Math.round(overviewProjection.retrogressionRisk * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Category Snapshot — current cutoffs, prior-bulletin movement, and base-case estimate */}
            <CategoryComparison
              rows={categoryComparisonRows}
              currentBulletinLabel={CURRENT_BULLETIN.month}
              targetDateLabel={fmtDateStr(targetDate)}
              onSelectCategory={cat => setSelectedCategory(cat)}
            />

            {/* Watchlist — save and track estimates */}
            <WatchlistPanel
              category={selectedCategory}
              categoryLabel={cat.label}
              targetDate={targetDate}
              assumptionsSummary={overviewAssumptionSummary}
              projection={projections.base}
              currentCutoffs={currentCutoffs}
              shareUrl={generateShareUrl()}
            />
            {/* Historical Chart */}
            <Card className="overflow-hidden gap-0 border-slate-200 bg-white p-0 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 md:text-base">{cat.label} India priority date movement</h3>
                  <p className="mt-1 text-xs text-slate-500">Source: <a href={bulletinUrl(CURRENT_BULLETIN.month)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline underline-offset-2">DOS Visa Bulletin</a> · {isMobile ? 'Tap' : 'Click'} any point to view its official bulletin</p>
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
                      {fmtBulletinMonthLabel(accelZone.x1)} to {fmtBulletinMonthLabel(accelZone.x2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 md:p-4">
                <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">History Range</p>
                    {historyWindowSummary && (
                      <p className="mt-1 text-xs text-slate-500">
                        Showing {historyWindowSummary.startLabel} to {historyWindowSummary.endLabel} · {historyWindowSummary.count} bulletins
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setHistoryWindow(DEFAULT_HISTORY_WINDOW)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        isRecentHistoryWindow ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      Recent
                    </button>
                    <button
                      onClick={() => setHistoryWindow(ARCHIVE_HISTORY_WINDOW)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        isArchiveHistoryWindow ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      FY2020-2022
                    </button>
                    <button
                      onClick={() => setHistoryWindow({ start: 0, end: fullHistoricalChartData.length - 1 })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        isFullHistoryWindow ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      Full history
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2 md:p-3">
                  <div className="h-[330px] md:h-[390px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historicalChartData}
                        margin={{ top: 18, right: isMobile ? 10 : 18, left: isMobile ? 0 : 8, bottom: 6 }}
                        onMouseMove={(state: any) => {
                          const point = state?.activePayload?.[0]?.payload;
                          if (point) setActiveHistoricalPoint(point);
                        }}
                        onMouseLeave={() => setActiveHistoricalPoint(historicalChartData[historicalChartData.length - 1] ?? null)}
                        style={{ cursor: 'pointer' }}
                        onClick={(state: any) => {
                          const point = state?.activePayload?.[0]?.payload;
                          if (point) {
                            setActiveHistoricalPoint(point);
                            window.open(bulletinUrl(point.month), '_blank', 'noopener,noreferrer');
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
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />

                        {accelZone && <ReferenceArea x1={accelZone.x1} x2={accelZone.x2} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.14} strokeDasharray="6 6" />}

                        {fyBoundaries.map(m => (
                          <ReferenceLine key={m} x={m} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" />
                        ))}

                        <XAxis
                          dataKey="month"
                          ticks={historicalXAxisTicks}
                          tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }}
                          tickFormatter={fmtBulletinMonthLabel}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                          interval={0}
                          minTickGap={isMobile ? 16 : 24}
                          tickMargin={isMobile ? 8 : 12}
                          height={isMobile ? 28 : 34}
                        />
                        <YAxis
                          ticks={historicalYAxisTicks}
                          tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }}
                          tickFormatter={(v: number) => String(new Date(v).getFullYear())}
                          axisLine={false}
                          tickLine={false}
                          tickMargin={10}
                          domain={chartYDomain}
                          width={isMobile ? 40 : 52}
                        />

                        {activeHistoricalPoint && <ReferenceLine x={activeHistoricalPoint.month} stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" />}

                        <ReferenceLine
                          y={parseDateStr(targetDate).getTime()}
                          stroke="#f59e0b"
                          strokeDasharray="6 5"
                          strokeWidth={isMobile ? 1.25 : 1.5}
                          strokeOpacity={0.85}
                        />

                        <Area type="monotone" dataKey="fad" fill="url(#fadAreaGrad)" stroke="none" />

                        {activeHistoricalPoint && (
                          <>
                            <ReferenceDot x={activeHistoricalPoint.month} y={activeHistoricalPoint.fad} r={5.5} fill="#1d4ed8" stroke="#fff" strokeWidth={2.5} isFront />
                            <ReferenceDot x={activeHistoricalPoint.month} y={activeHistoricalPoint.dof} r={4.5} fill="#06b6d4" stroke="#fff" strokeWidth={2} isFront />
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
                            fill: '#06b6d4',
                            stroke: '#fff',
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
                            if (index !== historicalChartData.length - 1) return <g key={index} />;
                            return (
                              <g key={index}>
                                <circle cx={cx} cy={cy} r={8} fill="#dbeafe" opacity={0.8} />
                                <circle cx={cx} cy={cy} r={4.5} fill="#1d4ed8" stroke="#fff" strokeWidth={2} />
                              </g>
                            );
                          }}
                          activeDot={{
                            r: 5.5,
                            fill: '#1d4ed8',
                            stroke: '#fff',
                            strokeWidth: 2.5,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {activeHistoricalInsight && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Bulletin</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{activeHistoricalInsight.month}</p>
                          {activeHistoricalPoint?.month === historicalChartData[historicalChartData.length - 1]?.month && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Latest</span>}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{isMobile ? 'Tap' : 'Click'} any point to open that month's official visa bulletin.</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">FAD</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{fmtDate(activeHistoricalInsight.fadDate)}</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">DoF</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{fmtDate(activeHistoricalInsight.dofDate)}</p>
                      </div>

                      <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Status vs your PD</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{activeHistoricalInsight.targetStatus}</p>
                        <p className="mt-1 text-[11px] text-amber-800/80">DoF lead: {activeHistoricalInsight.dofLead} mo</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Demand Density — Queue Depth by PD Year */}
            {demandDensityData.length > 0 && (
              <Card className="p-5 pb-3 overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-700">Queue Depth by Priority Date Year</h3>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600" /> I-485 inventory
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-300" /> I-140 (scaled)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Pending applications the FAD must clear through each year. Your PD year highlighted.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={demandDensityData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} width={36} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: 'none',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                        padding: '10px 14px',
                        fontSize: 12,
                      }}
                      formatter={(v: number, _name: string, props: any) => {
                        return [`${v.toLocaleString()} pending`, props.payload.source];
                      }}
                      labelFormatter={(label: string) => `PD Year ${label}`}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="pending" radius={[3, 3, 0, 0]} maxBarSize={40}>
                      {demandDensityData.map((entry, i) => (
                        <Cell key={i} fill={entry.isTarget ? '#f59e0b' : entry.source === 'I-485' ? '#2563eb' : '#93c5fd'} stroke={entry.isTarget ? '#d97706' : 'none'} strokeWidth={entry.isTarget ? 2 : 0} />
                      ))}
                    </Bar>
                    {/* Current FAD position marker */}
                    <ReferenceLine
                      x={String(parseDateStr(cat.currentFAD).getFullYear())}
                      stroke="#10b981"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: 'FAD',
                        position: 'top',
                        fill: '#10b981',
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    />
                    {/* Target PD marker */}
                    <ReferenceLine
                      x={String(parseDateStr(targetDate).getFullYear())}
                      stroke="#f59e0b"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: 'Your PD',
                        position: 'top',
                        fill: '#d97706',
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-slate-400 text-center mt-1">Source: USCIS I-485 Pending Inventory (Oct 2025) · I-140 Performance Data (FY2025 Q3)</p>
              </Card>
            )}

            {/* Key Facts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Recent Pace</p>
                    <p className="text-sm font-bold text-slate-900">{recentPaceInsight?.headline ?? 'Waiting for data'}</p>
                    <p className="text-xs text-slate-500 mt-1">{recentPaceInsight?.detail ?? 'Need at least two bulletin rows to compute a monthly movement.'}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Pending Inventory</p>
                    <p className="text-sm font-bold text-slate-900">{pendingInventoryTotal.toLocaleString()} I-485s</p>
                    <p className="text-xs text-slate-500 mt-1">USCIS Oct 2025 filed I-485 inventory used by the demand model. This does not include future demand that has not yet reached the filing stage.</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Key Risk</p>
                    <p className="text-sm font-bold text-slate-900">Retrogression possible</p>
                    <p className="text-xs text-slate-500 mt-1">{CURRENT_BULLETIN.month} bulletin notes that retrogression may be necessary later in the fiscal year.</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Methodology & Trust (consolidated) */}
            <div className="space-y-3">
              <button onClick={() => setShowMethodology(v => !v)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors">
                <Info className="w-3.5 h-3.5" />
                {showMethodology ? 'Hide' : 'Show'} methodology
                {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showMethodology && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-800">Probabilistic Dual-Cutoff Simulator (v8)</p>
                  <p>
                    Simulates both <strong>FAD and DoF month by month</strong>. Each future bulletin month samples from historical movement patterns instead of assuming one smooth, fixed rate.
                  </p>
                  <p>
                    For each simulated month: <code className="bg-slate-200 px-1 rounded">delta = base_rate × (seasonality + residual sample) ÷ √(demand ÷ ref)</code>
                  </p>
                  <p>
                    <strong>Demand curve:</strong> Uses <strong>USCIS I-485 pending inventory</strong> (Oct 2025) where available and falls back to <strong>I-140 approval counts</strong> (FY2025 Q3) beyond inventory coverage. The fallback is scaled using the <strong>median overlap ratio</strong>, and demand ratios are clipped before applying the square-root slowdown.
                  </p>
                  <p>
                    <strong>Seasonality and volatility:</strong> Derived from {HISTORICAL_BULLETINS.length} months of verified bulletin data. Each FY-month has its own bucket of historical residuals, which means the live model can simulate both surges and retrogression.
                  </p>
                  <p>
                    <strong>DoF model:</strong> Independent — DoF is simulated from its own historical movement series instead of being forced to equal FAD minus a fixed offset.
                  </p>
                  <p>Scenario assumptions in the Scenarios tab are unchanged. They still scale the base FAD rate through spillover, ban duration, and wastage multipliers before the simulator runs.</p>
                  <p>
                    Forecast cards show the <strong>median (P50)</strong> date plus an <strong>80% interval</strong>. The backtest badge reports 6-month FAD MAE and how often the actual bulletin landed inside the model's 80% interval.
                  </p>
                  <p className="text-slate-400">Disclaimer: Estimates are probabilistic and may change with policy shifts, retrogression, or legislative action.</p>
                </div>
              )}
              <TrustAndLimitationsPanel sourceLinks={trackerSourceLinks} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SCENARIOS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'scenarios' && (
          <div className="space-y-6">
            {/* ── Unified Assumptions + Scenarios header ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-base">&#9881;&#65039;</span>
                    Assumptions &amp; Scenario Projections
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tune policy controls, inspect base-case sensitivity, and compare scenario results in one view.
                  </p>
                </div>
                <button onClick={generateExport} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 border border-slate-800 rounded-lg shadow-sm hover:bg-slate-700 active:scale-95 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
                </button>
              </div>

              {/* ── Assumption Controls (always visible) ── */}
              <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Spillover Level</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: 'low' as const,
                            sensitivity: 'Low',
                            label: 'Low (~30k extra EB visas)',
                            sub: 'Partial ban, limited spillover',
                          },
                          {
                            val: 'moderate' as const,
                            sensitivity: 'Moderate',
                            label: 'Moderate (~50k extra)',
                            sub: 'Base case assumption',
                          },
                          {
                            val: 'high' as const,
                            sensitivity: 'High',
                            label: 'High (~70k+ extra)',
                            sub: 'Full ban, max spillover',
                          },
                        ].map(o => {
                          const selected = spilloverLevel === o.val;
                          const sensitivity = sensitivityByOption.get(`Spillover:${o.sensitivity}`);
                          return (
                            <button key={o.val} onClick={() => setSpilloverLevel(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                              <div className="font-semibold">{o.label}</div>
                              <div className={selected ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                              {sensitivity && (
                                <div className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? 'border-white/15' : 'border-slate-100'}`}>
                                  <span className={`font-mono text-[11px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}>FAD {sensitivity.dateLabel}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? 'bg-white/15 text-white' : sensitivity.deltaMonths <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{fmtSensitivityDelta(sensitivity.deltaMonths)}</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Ban Duration</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: '2027' as const,
                            sensitivity: 'Through 2027',
                            label: 'Ends Oct 2027 (1 FY)',
                            sub: 'Court reversal (CLINIC v. Rubio pending)',
                          },
                          {
                            val: '2028' as const,
                            sensitivity: 'Through 2028',
                            label: 'Through Sept 2028 (2 FY)',
                            sub: 'Base case — sustained policy',
                          },
                          {
                            val: '2029' as const,
                            sensitivity: 'Through 2029',
                            label: 'Through Sept 2029 (3 FY)',
                            sub: 'Full term continuation',
                          },
                        ].map(o => {
                          const selected = banContinues === o.val;
                          const sensitivity = sensitivityByOption.get(`Ban duration:${o.sensitivity}`);
                          return (
                            <button key={o.val} onClick={() => setBanContinues(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                              <div className="font-semibold">{o.label}</div>
                              <div className={selected ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                              {sensitivity && (
                                <div className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? 'border-white/15' : 'border-slate-100'}`}>
                                  <span className={`font-mono text-[11px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}>FAD {sensitivity.dateLabel}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? 'bg-white/15 text-white' : sensitivity.deltaMonths <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{fmtSensitivityDelta(sensitivity.deltaMonths)}</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">GC Wastage Level</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: 'low' as const,
                            sensitivity: 'Low',
                            label: 'Low (5–10%)',
                            sub: 'Efficient consular processing',
                          },
                          {
                            val: 'moderate' as const,
                            sensitivity: 'Moderate',
                            label: 'Moderate (15–20%)',
                            sub: 'Typical processing friction',
                          },
                          {
                            val: 'high' as const,
                            sensitivity: 'High',
                            label: 'High (25–30%)',
                            sub: 'Systemic delays (as in FY2021)',
                          },
                        ].map(o => {
                          const selected = wastageLevel === o.val;
                          const sensitivity = sensitivityByOption.get(`Wastage:${o.sensitivity}`);
                          return (
                            <button key={o.val} onClick={() => setWastageLevel(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${selected ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                              <div className="font-semibold">{o.label}</div>
                              <div className={selected ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                              {sensitivity && (
                                <div className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${selected ? 'border-white/15' : 'border-slate-100'}`}>
                                  <span className={`font-mono text-[11px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}>FAD {sensitivity.dateLabel}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? 'bg-white/15 text-white' : sensitivity.deltaMonths <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{fmtSensitivityDelta(sensitivity.deltaMonths)}</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                {/* Explainer (collapsed by default) */}
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 list-none select-none">
                    <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                    About these assumptions
                  </summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">75-Country Visa Ban</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Proclamations 10949 & 10998 (Jan 2026) indefinitely paused immigrant visas for 75+ countries. India is <strong>exempt</strong>. Unused family-based visas spill over to EB categories under INA §201(d). Challenged in <em>CLINIC v. Rubio</em> (SDNY, Feb 2026).
                      </p>
                      <div className="mt-2 text-xs text-slate-500">
                        Est. FY2027 spillover: <span className="font-semibold text-slate-700">50k–70k extra EB visas</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">Green Card Wastage</p>
                      <p className="text-xs text-slate-600 leading-relaxed">Visas go unused due to processing friction — medical exams, security clearances, or interview windows. FY2021: 25% wastage (66k of 262k). FY2022: near 0% after USCIS reforms.</p>
                      <div className="mt-2 text-xs text-slate-500">
                        Higher supply + processing gaps = <span className="font-semibold text-amber-600">more wastage risk</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">How the Model Works</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Runs 500 simulated bulletin paths per scenario. Each month samples historical movement, then adjusts for demand density before applying the same spillover, ban-duration, and wastage controls shown above.
                      </p>
                      <div className="mt-2 text-xs text-slate-500 font-mono bg-white rounded px-2 py-1 leading-relaxed">each month: rate × (season + residual sample) × assumptions ÷ sqrt(density)</div>
                    </div>
                  </div>
                </details>
              </div>

              {/* ── Divider with context label ── */}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/70">
                <div className="h-px flex-1 bg-slate-200" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Results — {cat.label} India · PD {fmtDateStr(targetDate)}
                </p>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* ── Scenario Results (inside the same card) ── */}
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, (typeof SCENARIOS)[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                    const p = projections[key];
                    return (
                      <div key={key} className="rounded-xl border-l-4 border border-slate-200 bg-slate-50/50 p-5" style={{ borderLeftColor: s.color }}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-slate-900">{s.label}</h3>
                            <p className="text-xs text-slate-500">{s.probability} probability</p>
                          </div>
                          <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">{adjustedRates[key]} PD-mo/mo</span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3">{s.description}</p>
                        <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-slate-500 mb-0.5">DoF P50</p>
                            <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDate(p.dofDate, p.horizon.dofP50Capped)}</p>
                            {!p.isAlreadyCurrent && <p className="text-[11px] text-slate-400 mt-1">{fmtProjectionDateRange(p.dofRange.p10, p.dofRange.p90, p.horizon.dofP90Capped)}</p>}
                          </div>
                          <div>
                            <p className="text-slate-500 mb-0.5">FAD P50</p>
                            <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDate(p.fadDate, p.horizon.fadP50Capped)}</p>
                            {!p.isAlreadyCurrent && <p className="text-[11px] text-slate-400 mt-1">{fmtProjectionDateRange(p.fadRange.p10, p.fadRange.p90, p.horizon.fadP90Capped)}</p>}
                          </div>
                          <div>
                            <p className="text-slate-500 mb-0.5">GC P50</p>
                            <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDate(p.gcDate, p.horizon.gcP50Capped)}</p>
                            {!p.isAlreadyCurrent && <p className="text-[11px] text-slate-400 mt-1">{fmtProjectionDateRange(p.gcRange.p10, p.gcRange.p90, p.horizon.gcP90Capped)}</p>}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between gap-2">
                          <span>{p.isAlreadyCurrent ? 'Already current' : `FAD median in ${fmtProjectionDuration(p.monthsFromToday, p.horizon.fadP50Capped)}`}</span>
                          <span>Near-term risk {Math.round(p.nearTermRisk * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Scenario comparison bar chart */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Months from Today — Scenario Comparison</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scenarioChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: 'Months',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip formatter={(v: number) => [`${v} months`]} />
                  <Bar dataKey="months" radius={[4, 4, 0, 0]}>
                    {scenarioChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Model-generated scenario table */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Model Ranges (80% interval)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Scenario</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">DoF Range</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">FAD Range</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">GC Range</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Near-Term Risk</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Retro Shock</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, (typeof SCENARIOS)[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                      const p = projections[key];
                      return (
                        <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold" style={{ color: s.color }}>
                            {s.label}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDateRange(p.dofRange.p10, p.dofRange.p90, p.horizon.dofP90Capped)}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDateRange(p.fadRange.p10, p.fadRange.p90, p.horizon.fadP90Capped)}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{p.isAlreadyCurrent ? 'Current' : fmtProjectionDateRange(p.gcRange.p10, p.gcRange.p90, p.horizon.gcP90Capped)}</td>
                          <td className="px-3 py-2 text-slate-600">{Math.round(p.nearTermRisk * 100)}%</td>
                          <td className="px-3 py-2 text-slate-600">{Math.round(p.retrogressionRisk * 100)}%</td>
                          <td className="px-3 py-2 text-slate-600">{s.probability}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">Ranges are generated from 500 simulated bulletin paths per scenario using the same engine used in the live forecast cards.</p>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            BULLETIN TRACKER TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
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

            {/* ── Tracker header: legend + pace stats ── */}
            {(() => {
              const fadKey = selectedCategory === 'EB1' ? 'eb1_fad' : selectedCategory === 'EB3' ? 'eb3_fad' : 'eb2_fad';
              const dofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';
              // Compute deltas for up to 12 consecutive pairs
              const fadDeltas: number[] = [];
              const dofDeltas: number[] = [];
              for (let i = 0; i < Math.min(12, HISTORICAL_BULLETINS.length - 1); i++) {
                const curr = HISTORICAL_BULLETINS[i];
                const prev = HISTORICAL_BULLETINS[i + 1];
                fadDeltas.push(Math.round((parseDateStr(curr[fadKey as keyof typeof curr] as string).getTime() - parseDateStr(prev[fadKey as keyof typeof prev] as string).getTime()) / 86400000));
                dofDeltas.push(Math.round((parseDateStr(curr[dofKey as keyof typeof curr] as string).getTime() - parseDateStr(prev[dofKey as keyof typeof prev] as string).getTime()) / 86400000));
              }
              const avg = (arr: number[], n: number) => (arr.length >= n ? Math.round(arr.slice(0, n).reduce((a, b) => a + b, 0) / n) : null);
              const fad6 = avg(fadDeltas, 6);
              const fad12 = avg(fadDeltas, 12);
              const dof6 = avg(dofDeltas, 6);
              const dof12 = avg(dofDeltas, 12);
              const paceColor = (v: number) => (v > 10 ? 'text-emerald-600' : v < -10 ? 'text-red-600' : 'text-amber-600');
              const paceLabel = (v: number) => (v > 0 ? `+${v}d/mo` : `${v}d/mo`);
              const PaceTile = ({ label, v6, v12 }: { label: string; v6: number | null; v12: number | null }) => (
                <div className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{label}</p>
                  {v6 !== null && (
                    <p className={`mt-0.5 text-base font-bold font-mono ${paceColor(v6)}`}>
                      6mo: {paceLabel(v6)}
                      {v12 !== null && <span className={`ml-2 text-sm font-normal ${paceColor(v12)}`}>· 12mo: {paceLabel(v12)}</span>}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{cat.label} avg</p>
                </div>
              );
              return (
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 text-sm text-slate-600">
                    Historical visa bulletins for India. Δ columns show month-over-month movement.
                    <span className="text-emerald-600 font-semibold"> Green = advancement</span>,<span className="text-red-600 font-semibold"> Red = retrogression</span>.
                    <span className="block text-xs text-slate-500 mt-1">Tracker tables now run continuously from Oct 2019 through the latest bulletin, including archived FY2020-FY2022 rows. Forecasts, charts, and backtests remain calibrated on the contiguous Oct 2022–June 2026 series.</span>
                  </div>
                  <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[320px]">
                    <PaceTile label="FAD Pace" v6={fad6} v12={fad12} />
                    <PaceTile label="DoF Pace" v6={dof6} v12={dof12} />
                  </div>
                </div>
              );
            })()}

            {/* Final Action Dates Table */}
            {(() => {
              // Determine which column index pair belongs to the selected category
              // Columns: Month(0), EB-1(1), Δ(2), EB-2(3), Δ(4), EB-3(5), Δ(6)
              const selFadKey = selectedCategory === 'EB1' ? 'eb1_fad' : selectedCategory === 'EB3' ? 'eb3_fad' : 'eb2_fad';
              const selDofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';
              const selColIdx = selectedCategory === 'EB1' ? 0 : selectedCategory === 'EB3' ? 2 : 1; // 0=EB1,1=EB2,2=EB3
              const targetParsed = parseDateStr(targetDate);
              const trackerHistory = BULLETIN_TRACKER_HISTORY;

              // Find the first row where the selected FAD >= user's priority date (first month it became current)
              let firstCurrentIdx: number | null = null;
              for (let i = trackerHistory.length - 1; i >= 0; i--) {
                const fadVal = trackerHistory[i][selFadKey as keyof (typeof trackerHistory)[number]] as string;
                if (parseDateStr(fadVal) >= targetParsed) {
                  firstCurrentIdx = i;
                  break;
                }
              }

              const hdrCellCls = (colIdx: number) => (colIdx === selColIdx ? 'px-4 py-3 text-left font-bold bg-slate-600 text-white' : 'px-4 py-3 text-left font-semibold text-slate-300');
              const hdrDeltaCls = (colIdx: number) => (colIdx === selColIdx ? 'px-4 py-3 text-center font-bold bg-slate-600 text-white' : 'px-4 py-3 text-center font-semibold text-slate-300');

              // Group bulletins by fiscal year
              const fyOf = (m: string) => {
                const parts = m.split(' ');
                const yr = parseInt(parts[parts.length - 1]);
                const mo = parts[0];
                const isOctNovDec = ['Oct', 'Nov', 'Dec'].includes(mo);
                return `FY${isOctNovDec ? yr + 1 : yr}`;
              };
              const fyGroups: { fy: string; indices: number[] }[] = [];
              trackerHistory.forEach((b, idx) => {
                const fy = fyOf(b.month);
                const g = fyGroups.find(x => x.fy === fy);
                if (g) g.indices.push(idx);
                else fyGroups.push({ fy, indices: [idx] });
              });

              return (
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800">Final Action Dates (FAD)</h3>
                    <div className="flex items-center gap-3">
                      {firstCurrentIdx !== null && (
                        <button
                          onClick={() => {
                            const fy = fyOf(trackerHistory[firstCurrentIdx!].month);
                            setExpandedFadFYs(prev => {
                              const n = new Set(prev);
                              n.add(fy);
                              return n;
                            });
                            setTimeout(
                              () =>
                                fadStarRowRef.current?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                }),
                              100
                            );
                          }}
                          className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 hover:bg-amber-100 transition-colors font-semibold"
                        >
                          <span>★</span> Jump to your row
                        </button>
                      )}
                      <span className="text-xs text-slate-500">
                        Highlighted: <span className="font-semibold text-slate-700">{cat.label}</span>
                        {firstCurrentIdx !== null && <span className="ml-2 text-amber-600">★ = first current</span>}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {fyGroups.map(({ fy, indices }) => {
                      const isOpen = expandedFadFYs.has(fy);
                      const startMo = trackerHistory[indices[indices.length - 1]].month;
                      const endMo = trackerHistory[indices[0]].month;
                      const hasStarRow = firstCurrentIdx !== null && indices.includes(firstCurrentIdx);
                      return (
                        <div key={fy} className="rounded-lg border border-slate-200 overflow-hidden">
                          <button onClick={() => toggleFadFY(fy)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isOpen ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm">{fy}</span>
                              <span className={`text-xs ${isOpen ? 'text-slate-300' : 'text-slate-500'}`}>
                                {startMo} – {endMo} · {indices.length} bulletins
                              </span>
                              {hasStarRow && <span className="text-amber-400 text-xs font-semibold">★ your row</span>}
                            </div>
                            <span className={`text-xs font-bold transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                          {isOpen && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-700 text-white">
                                    <th className="px-4 py-2.5 text-left font-semibold">Month</th>
                                    <th className={hdrCellCls(0)}>EB-1</th>
                                    <th className={hdrDeltaCls(0)}>Δ</th>
                                    <th className={hdrCellCls(1)}>EB-2</th>
                                    <th className={hdrDeltaCls(1)}>Δ</th>
                                    <th className={hdrCellCls(2)}>EB-3</th>
                                    <th className={hdrDeltaCls(2)}>Δ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {indices.map(idx => {
                                    const b = trackerHistory[idx];
                                    const prev = idx < trackerHistory.length - 1 && areConsecutiveBulletinMonths(b.month, trackerHistory[idx + 1].month) ? trackerHistory[idx + 1] : null;
                                    const eb1m = prev ? movementLabel(prev.eb1_fad, b.eb1_fad) : null;
                                    const eb2m = prev ? movementLabel(prev.eb2_fad, b.eb2_fad) : null;
                                    const eb3m = prev ? movementLabel(prev.eb3_fad, b.eb3_fad) : null;
                                    const mvClass = (m: typeof eb1m) => (m?.type === 'advancement' ? 'text-emerald-600 font-semibold' : m?.type === 'retrogression' ? 'text-red-600 font-semibold' : 'text-slate-400');
                                    const isFirstCurrent = idx === firstCurrentIdx;
                                    const isLatest = idx === 0;
                                    const rowBase = isFirstCurrent ? 'bg-amber-50 border-b border-amber-200' : isLatest ? 'bg-blue-50 border-b border-slate-100' : 'border-b border-slate-100 hover:bg-slate-50';
                                    const selCellCls = 'px-4 py-2 font-mono font-bold text-slate-900 bg-white/60';
                                    const otherCellCls = 'px-4 py-2 font-mono text-slate-400';
                                    const c = (colIdx: number, val: string) => (colIdx === selColIdx ? <td className={selCellCls}>{val}</td> : <td className={otherCellCls}>{val}</td>);
                                    const d = (colIdx: number, m: typeof eb1m) => (colIdx === selColIdx ? <td className={`px-4 py-2 text-center font-mono ${mvClass(m)}`}>{m?.label ?? '—'}</td> : <td className="px-4 py-2 text-center font-mono text-slate-300">{m?.label ?? '—'}</td>);
                                    return (
                                      <tr key={b.month} className={rowBase} ref={isFirstCurrent ? fadStarRowRef : undefined}>
                                        <td className="px-4 py-2 font-mono font-semibold text-slate-800">
                                          {isFirstCurrent && <span className="mr-1 text-amber-500">★</span>}
                                          {b.month}
                                          {isLatest && <span className="ml-1 text-blue-600 text-xs">(latest)</span>}
                                        </td>
                                        {c(0, fmtDateStr(b.eb1_fad))}
                                        {d(0, eb1m)}
                                        {c(1, fmtDateStr(b.eb2_fad))}
                                        {d(1, eb2m)}
                                        {c(2, fmtDateStr(b.eb3_fad))}
                                        {d(2, eb3m)}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Dates for Filing Table */}
            {(() => {
              const selDofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';
              const selColIdx = selectedCategory === 'EB1' ? 0 : selectedCategory === 'EB3' ? 2 : 1;
              const targetParsed = parseDateStr(targetDate);
              const trackerHistory = BULLETIN_TRACKER_HISTORY;

              // Find first row where selected DoF >= user's priority date
              let firstCurrentIdx: number | null = null;
              for (let i = trackerHistory.length - 1; i >= 0; i--) {
                const dofVal = trackerHistory[i][selDofKey as keyof (typeof trackerHistory)[number]] as string;
                if (parseDateStr(dofVal) >= targetParsed) {
                  firstCurrentIdx = i;
                  break;
                }
              }

              const hdrCellCls = (colIdx: number) => (colIdx === selColIdx ? 'px-4 py-3 text-left font-bold bg-slate-500 text-white' : 'px-4 py-3 text-left font-semibold text-slate-300');
              const hdrDeltaCls = (colIdx: number) => (colIdx === selColIdx ? 'px-4 py-3 text-center font-bold bg-slate-500 text-white' : 'px-4 py-3 text-center font-semibold text-slate-300');

              // Group bulletins by fiscal year (reuse fyOf from FAD block scope is not available here, redefine)
              const fyOfD = (m: string) => {
                const parts = m.split(' ');
                const yr = parseInt(parts[parts.length - 1]);
                const mo = parts[0];
                return `FY${['Oct', 'Nov', 'Dec'].includes(mo) ? yr + 1 : yr}`;
              };
              const fyGroupsD: { fy: string; indices: number[] }[] = [];
              trackerHistory.forEach((b, idx) => {
                const fy = fyOfD(b.month);
                const g = fyGroupsD.find(x => x.fy === fy);
                if (g) g.indices.push(idx);
                else fyGroupsD.push({ fy, indices: [idx] });
              });

              return (
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800">Dates for Filing (DoF)</h3>
                    <div className="flex items-center gap-3">
                      {firstCurrentIdx !== null && (
                        <button
                          onClick={() => {
                            const fy = fyOfD(trackerHistory[firstCurrentIdx!].month);
                            setExpandedDofFYs(prev => {
                              const n = new Set(prev);
                              n.add(fy);
                              return n;
                            });
                            setTimeout(
                              () =>
                                dofStarRowRef.current?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                }),
                              100
                            );
                          }}
                          className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 hover:bg-amber-100 transition-colors font-semibold"
                        >
                          <span>★</span> Jump to your row
                        </button>
                      )}
                      <span className="text-xs text-slate-500">
                        Highlighted: <span className="font-semibold text-slate-700">{cat.label}</span>
                        {firstCurrentIdx !== null && <span className="ml-2 text-amber-600">★ = first fileable</span>}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {fyGroupsD.map(({ fy, indices }) => {
                      const isOpen = expandedDofFYs.has(fy);
                      const startMo = trackerHistory[indices[indices.length - 1]].month;
                      const endMo = trackerHistory[indices[0]].month;
                      const hasStarRow = firstCurrentIdx !== null && indices.includes(firstCurrentIdx);
                      return (
                        <div key={fy} className="rounded-lg border border-slate-200 overflow-hidden">
                          <button onClick={() => toggleDofFY(fy)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isOpen ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm">{fy}</span>
                              <span className={`text-xs ${isOpen ? 'text-slate-300' : 'text-slate-500'}`}>
                                {startMo} – {endMo} · {indices.length} bulletins
                              </span>
                              {hasStarRow && <span className="text-amber-400 text-xs font-semibold">★ your row</span>}
                            </div>
                            <span className={`text-xs font-bold transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                          {isOpen && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-600 text-white">
                                    <th className="px-4 py-2.5 text-left font-semibold">Month</th>
                                    <th className={hdrCellCls(0)}>EB-1</th>
                                    <th className={hdrDeltaCls(0)}>Δ</th>
                                    <th className={hdrCellCls(1)}>EB-2</th>
                                    <th className={hdrDeltaCls(1)}>Δ</th>
                                    <th className={hdrCellCls(2)}>EB-3</th>
                                    <th className={hdrDeltaCls(2)}>Δ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {indices.map(idx => {
                                    const b = trackerHistory[idx];
                                    const prev = idx < trackerHistory.length - 1 && areConsecutiveBulletinMonths(b.month, trackerHistory[idx + 1].month) ? trackerHistory[idx + 1] : null;
                                    const eb1m = prev ? movementLabel(prev.eb1_dof, b.eb1_dof) : null;
                                    const eb2m = prev ? movementLabel(prev.eb2_dof, b.eb2_dof) : null;
                                    const eb3m = prev ? movementLabel(prev.eb3_dof, b.eb3_dof) : null;
                                    const mvClass = (m: typeof eb1m) => (m?.type === 'advancement' ? 'text-emerald-600 font-semibold' : m?.type === 'retrogression' ? 'text-red-600 font-semibold' : 'text-slate-400');
                                    const isFirstCurrent = idx === firstCurrentIdx;
                                    const isLatest = idx === 0;
                                    const rowBase = isFirstCurrent ? 'bg-amber-50 border-b border-amber-200' : isLatest ? 'bg-blue-50 border-b border-slate-100' : 'border-b border-slate-100 hover:bg-slate-50';
                                    const selCellCls = 'px-4 py-2 font-mono font-bold text-slate-900 bg-white/60';
                                    const otherCellCls = 'px-4 py-2 font-mono text-slate-400';
                                    const c = (colIdx: number, val: string) => (colIdx === selColIdx ? <td className={selCellCls}>{val}</td> : <td className={otherCellCls}>{val}</td>);
                                    const d = (colIdx: number, m: typeof eb1m) => (colIdx === selColIdx ? <td className={`px-4 py-2 text-center font-mono ${mvClass(m)}`}>{m?.label ?? '—'}</td> : <td className="px-4 py-2 text-center font-mono text-slate-300">{m?.label ?? '—'}</td>);
                                    return (
                                      <tr key={b.month} className={rowBase} ref={isFirstCurrent ? dofStarRowRef : undefined}>
                                        <td className="px-4 py-2 font-mono font-semibold text-slate-800">
                                          {isFirstCurrent && <span className="mr-1 text-amber-500">★</span>}
                                          {b.month}
                                          {isLatest && <span className="ml-1 text-blue-600 text-xs">(latest)</span>}
                                        </td>
                                        {c(0, fmtDateStr(b.eb1_dof))}
                                        {d(0, eb1m)}
                                        {c(1, fmtDateStr(b.eb2_dof))}
                                        {d(1, eb2m)}
                                        {c(2, fmtDateStr(b.eb3_dof))}
                                        {d(2, eb3m)}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <FloatingChatWidget
        categoryLabel={cat.label}
        categoryName={cat.name}
        targetDate={targetDate}
        currentFad={cat.currentFAD}
        currentDof={cat.currentDoF}
        projections={projections}
        scenarios={SCENARIOS}
        assumptionsSummary={overviewAssumptionSummary}
        backtest={backtestResult}
        sourceLinks={trackerSourceLinks}
      />
    </div>
  );
}
