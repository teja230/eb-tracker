const DAYS_PER_PD_MONTH = 30.44;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type ForecastBulletin = {
  month: string;
  fad: string;
  dof: string;
};

export type DemandInputs = {
  i485: Record<number, number>;
  i140: Record<number, number>;
};

export type DemandCurve = {
  byYear: Record<number, number>;
  reference: number;
  scaleFactor: number;
};

type SeriesStats = {
  baseline: number;
  seasonality: Record<number, number>;
  residualBuckets: Record<number, number[]>;
  overallResiduals: number[];
};

export type ForecastContext = {
  bulletins: ForecastBulletin[];
  demandCurve: DemandCurve;
  fadStats: SeriesStats;
  dofStats: SeriesStats;
  dofRateRatio: number;
  dofLeadMedian: number;
};

type QuantileMonths = {
  p10: number;
  p50: number;
  p90: number;
};

type QuantileDates = {
  p10: Date;
  p50: Date;
  p90: Date;
};

export type ForecastProjection = {
  isAlreadyCurrent: boolean;
  gapPDMonths: number;
  monthsFromToday: number;
  fadDate: Date;
  dofDate: Date;
  gcDate: Date;
  fadMonths: QuantileMonths;
  dofMonths: QuantileMonths;
  gcMonths: QuantileMonths;
  fadRange: QuantileDates;
  dofRange: QuantileDates;
  gcRange: QuantileDates;
  retrogressionRisk: number;
};

export type BacktestSummary = {
  mae: number;
  coverage80: number;
  predictions: number;
};

type PathResult = {
  fadReachedMonths: number;
  dofReachedMonths: number;
  gcReachedMonths: number;
  hadRetrogression: boolean;
  finalFadAdvance: number;
};

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetweenDates(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / DAYS_PER_PD_MONTH;
}

function monthsBetween(from: string, to: string): number {
  return monthsBetweenDates(parseDateStr(from), parseDateStr(to));
}

function addApproxMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(months * DAYS_PER_PD_MONTH));
  return d;
}

function bulletinMonthToDate(label: string): Date {
  const [month, year] = label.split(' ');
  return new Date(Number(year), MONTH_NAMES.indexOf(month), 1);
}

function toFyMonth(calendarMonth: number): number {
  return calendarMonth >= 9 ? calendarMonth - 8 : calendarMonth + 4;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSample(values: number[], rng: () => number): number {
  if (values.length === 0) return 0;
  return values[Math.floor(rng() * values.length)] ?? 0;
}

function computeLeadMedian(bulletins: ForecastBulletin[]): number {
  const gaps = bulletins.map(b => monthsBetween(b.fad, b.dof)).filter(gap => gap > 0);
  return gaps.length > 0 ? median(gaps) : 6;
}

function buildSeriesStats(bulletins: ForecastBulletin[], key: 'fad' | 'dof'): SeriesStats {
  const deltas: Array<{ fyMonth: number; delta: number }> = [];

  for (let i = 1; i < bulletins.length; i++) {
    const current = bulletins[i];
    const delta = monthsBetween(bulletins[i - 1][key], current[key]);
    deltas.push({
      fyMonth: toFyMonth(bulletinMonthToDate(current.month).getMonth()),
      delta,
    });
  }

  const positive = deltas.map(entry => entry.delta).filter(delta => delta > 0.05);
  const baseline = Math.max(median(positive), 0.25);

  const seasonality: Record<number, number> = {};
  const residualBuckets: Record<number, number[]> = {};
  for (let fyMonth = 1; fyMonth <= 12; fyMonth++) {
    residualBuckets[fyMonth] = [];
    const bucketPositives = deltas
      .filter(entry => entry.fyMonth === fyMonth && entry.delta > 0.05)
      .map(entry => entry.delta / baseline);
    seasonality[fyMonth] = bucketPositives.length > 0 ? clamp(median(bucketPositives), 0.65, 1.6) : 1;
  }

  const overallResiduals: number[] = [];
  for (const entry of deltas) {
    const normalized = entry.delta / baseline;
    const residual = clamp(normalized - seasonality[entry.fyMonth], -2.5, 2.5);
    residualBuckets[entry.fyMonth].push(residual);
    overallResiduals.push(residual);
  }

  if (overallResiduals.length === 0) overallResiduals.push(0);

  return {
    baseline,
    seasonality,
    residualBuckets,
    overallResiduals,
  };
}

function sampleResidual(stats: SeriesStats, fyMonth: number, rng: () => number): number {
  const bucket = stats.residualBuckets[fyMonth] ?? [];
  const bucketSample = bucket.length > 0 ? pickSample(bucket, rng) : 0;
  const overallSample = pickSample(stats.overallResiduals, rng);
  return bucket.length > 0 ? bucketSample * 0.7 + overallSample * 0.3 : overallSample;
}

function drawMonthlyAdvance(stats: SeriesStats, baseRate: number, demandCurve: DemandCurve, pdYear: number, fyMonth: number, rng: () => number): number {
  const yearDemand = demandCurve.byYear[pdYear] ?? demandCurve.reference;
  const demandRatio = clamp(yearDemand / demandCurve.reference, 0.6, 1.8);
  const multiplier = clamp(stats.seasonality[fyMonth] + sampleResidual(stats, fyMonth, rng), -2.25, 3.25);
  return (baseRate * multiplier) / Math.sqrt(demandRatio);
}

export function buildDemandCurve({ i485, i140 }: DemandInputs): DemandCurve {
  const overlapYears = Object.keys(i485)
    .map(Number)
    .filter(year => i485[year] > 0 && i140[year] !== undefined && i140[year] > 0);
  const overlapRatios = overlapYears.map(year => i485[year] / i140[year]).filter(Number.isFinite);
  const scaleFactor = overlapRatios.length > 0 ? median(overlapRatios) : 1;

  const byYear: Record<number, number> = {};
  const years = new Set<number>();
  Object.keys(i485).forEach(year => years.add(Number(year)));
  Object.keys(i140).forEach(year => years.add(Number(year)));

  Array.from(years)
    .sort((a, b) => a - b)
    .forEach(year => {
      if (i485[year] !== undefined && i485[year] > 0) {
        byYear[year] = i485[year];
      } else if (i140[year] !== undefined) {
        byYear[year] = i140[year] * scaleFactor;
      }
    });

  const reference = Math.max(median(Object.values(byYear).filter(value => value > 0)), 1);
  return { byYear, reference, scaleFactor };
}

export function createForecastContext(args: { bulletins: ForecastBulletin[]; demand: DemandInputs }): ForecastContext {
  const demandCurve = buildDemandCurve(args.demand);
  const fadStats = buildSeriesStats(args.bulletins, 'fad');
  const dofStats = buildSeriesStats(args.bulletins, 'dof');
  const dofRateRatio = clamp(dofStats.baseline / Math.max(fadStats.baseline, 0.25), 0.75, 2.25);

  return {
    bulletins: args.bulletins,
    demandCurve,
    fadStats,
    dofStats,
    dofRateRatio,
    dofLeadMedian: computeLeadMedian(args.bulletins),
  };
}

function simulatePath(args: {
  today: Date;
  currentFad: string;
  currentDof: string;
  targetDate?: string;
  baseFadRate: number;
  gcLagMonths: number;
  seasonalityStartMonth: number;
  maxMonths: number;
  context: ForecastContext;
  seed: string;
}): PathResult {
  const rng = mulberry32(hashString(args.seed));
  const target = args.targetDate ? parseDateStr(args.targetDate) : null;
  const baseDofRate = args.baseFadRate * args.context.dofRateRatio;

  let fadCursor = parseDateStr(args.currentFad);
  let dofCursor = parseDateStr(args.currentDof);
  if (dofCursor.getTime() < fadCursor.getTime()) dofCursor = new Date(fadCursor);

  let fadReachedMonths = target && monthsBetweenDates(fadCursor, target) <= 0 ? 0 : null;
  let dofReachedMonths = target && monthsBetweenDates(dofCursor, target) <= 0 ? 0 : null;
  let hadRetrogression = false;

  for (let step = 0; step < args.maxMonths; step++) {
    const monthIdx = (args.seasonalityStartMonth + step) % 12;
    const fyMonth = toFyMonth(monthIdx);

    const fadDelta = drawMonthlyAdvance(args.context.fadStats, args.baseFadRate, args.context.demandCurve, fadCursor.getFullYear(), fyMonth, rng);
    const dofDelta = drawMonthlyAdvance(args.context.dofStats, baseDofRate, args.context.demandCurve, dofCursor.getFullYear(), fyMonth, rng);

    if (fadDelta < 0 || dofDelta < 0) hadRetrogression = true;

    if (target) {
      const fadRemaining = monthsBetweenDates(fadCursor, target);
      if (fadReachedMonths === null && fadDelta > 0 && fadRemaining <= fadDelta) {
        fadReachedMonths = step + fadRemaining / fadDelta;
      }

      const dofRemaining = monthsBetweenDates(dofCursor, target);
      if (dofReachedMonths === null && dofDelta > 0 && dofRemaining <= dofDelta) {
        dofReachedMonths = step + dofRemaining / dofDelta;
      }
    }

    fadCursor = addApproxMonths(fadCursor, fadDelta);
    dofCursor = addApproxMonths(dofCursor, dofDelta);
    if (dofCursor.getTime() < fadCursor.getTime()) dofCursor = new Date(fadCursor);

    if (target && fadReachedMonths !== null && dofReachedMonths !== null) break;
  }

  const cappedFadMonths = fadReachedMonths ?? args.maxMonths;
  const cappedDofMonths = dofReachedMonths ?? args.maxMonths;

  return {
    fadReachedMonths: cappedFadMonths,
    dofReachedMonths: cappedDofMonths,
    gcReachedMonths: cappedFadMonths + args.gcLagMonths,
    hadRetrogression,
    finalFadAdvance: monthsBetweenDates(parseDateStr(args.currentFad), fadCursor),
  };
}

function summarizeMonths(today: Date, values: number[]): { months: QuantileMonths; dates: QuantileDates } {
  const months = {
    p10: quantile(values, 0.1),
    p50: quantile(values, 0.5),
    p90: quantile(values, 0.9),
  };

  return {
    months,
    dates: {
      p10: addApproxMonths(today, months.p10),
      p50: addApproxMonths(today, months.p50),
      p90: addApproxMonths(today, months.p90),
    },
  };
}

export function forecastScenario(args: {
  context: ForecastContext;
  today: Date;
  currentFad: string;
  currentDof: string;
  targetDate: string;
  baseFadRate: number;
  gcLagMonths: number;
  seasonalityStartMonth: number;
  paths?: number;
  maxMonths?: number;
  seed?: string;
}): ForecastProjection {
  const gapPDMonths = monthsBetween(args.currentFad, args.targetDate);
  if (gapPDMonths <= 0) {
    const current = parseDateStr(args.currentFad);
    return {
      isAlreadyCurrent: true,
      gapPDMonths: 0,
      monthsFromToday: 0,
      fadDate: current,
      dofDate: current,
      gcDate: current,
      fadMonths: { p10: 0, p50: 0, p90: 0 },
      dofMonths: { p10: 0, p50: 0, p90: 0 },
      gcMonths: { p10: 0, p50: 0, p90: 0 },
      fadRange: { p10: current, p50: current, p90: current },
      dofRange: { p10: current, p50: current, p90: current },
      gcRange: { p10: current, p50: current, p90: current },
      retrogressionRisk: 0,
    };
  }

  const pathCount = args.paths ?? 500;
  const maxMonths = args.maxMonths ?? 240;
  const fadReached: number[] = [];
  const dofReached: number[] = [];
  const gcReached: number[] = [];
  let retrogressionPaths = 0;

  for (let i = 0; i < pathCount; i++) {
    const path = simulatePath({
      today: args.today,
      currentFad: args.currentFad,
      currentDof: args.currentDof,
      targetDate: args.targetDate,
      baseFadRate: args.baseFadRate,
      gcLagMonths: args.gcLagMonths,
      seasonalityStartMonth: args.seasonalityStartMonth,
      maxMonths,
      context: args.context,
      seed: `${args.seed ?? 'forecast'}:${i}`,
    });
    fadReached.push(path.fadReachedMonths);
    dofReached.push(path.dofReachedMonths);
    gcReached.push(path.gcReachedMonths);
    if (path.hadRetrogression) retrogressionPaths += 1;
  }

  const fadSummary = summarizeMonths(args.today, fadReached);
  const dofSummary = summarizeMonths(args.today, dofReached);
  const gcSummary = summarizeMonths(args.today, gcReached);

  return {
    isAlreadyCurrent: false,
    gapPDMonths: Math.round(gapPDMonths),
    monthsFromToday: Math.round(fadSummary.months.p50),
    fadDate: fadSummary.dates.p50,
    dofDate: dofSummary.dates.p50,
    gcDate: gcSummary.dates.p50,
    fadMonths: fadSummary.months,
    dofMonths: dofSummary.months,
    gcMonths: gcSummary.months,
    fadRange: fadSummary.dates,
    dofRange: dofSummary.dates,
    gcRange: gcSummary.dates,
    retrogressionRisk: retrogressionPaths / pathCount,
  };
}

export function backtestForecast(args: {
  bulletins: ForecastBulletin[];
  demand: DemandInputs;
  baseFadRate: number;
  gcLagMonths: number;
  horizonMonths?: number;
  paths?: number;
  seed?: string;
}): BacktestSummary {
  const horizonMonths = args.horizonMonths ?? 6;
  const minTrainingWindows = 12;
  if (args.bulletins.length < horizonMonths + minTrainingWindows) {
    return { mae: 0, coverage80: 0, predictions: 0 };
  }

  const pathCount = args.paths ?? 180;
  const errors: number[] = [];
  let covered = 0;

  for (let t = minTrainingWindows - 1; t < args.bulletins.length - horizonMonths; t++) {
    const training = args.bulletins.slice(0, t + 1);
    const current = training[training.length - 1];
    const future = args.bulletins[t + horizonMonths];
    const context = createForecastContext({ bulletins: training, demand: args.demand });
    const today = bulletinMonthToDate(current.month);
    const seasonalityStartMonth = (today.getMonth() + 1) % 12;
    const advances: number[] = [];

    for (let i = 0; i < pathCount; i++) {
      const path = simulatePath({
        today,
        currentFad: current.fad,
        currentDof: current.dof,
        baseFadRate: args.baseFadRate,
        gcLagMonths: args.gcLagMonths,
        seasonalityStartMonth,
        maxMonths: horizonMonths,
        context,
        seed: `${args.seed ?? 'backtest'}:${t}:${i}`,
      });
      advances.push(path.finalFadAdvance);
    }

    const actualAdvance = monthsBetween(current.fad, future.fad);
    const p10 = quantile(advances, 0.1);
    const p50 = quantile(advances, 0.5);
    const p90 = quantile(advances, 0.9);

    errors.push(Math.abs(p50 - actualAdvance));
    if (actualAdvance >= p10 && actualAdvance <= p90) covered += 1;
  }

  const mae = errors.length > 0 ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0;
  return {
    mae: Math.round(mae * 10) / 10,
    coverage80: errors.length > 0 ? covered / errors.length : 0,
    predictions: errors.length,
  };
}
