import {
  addApproxMonths,
  parseBulletinMonth,
  parseDateStr,
  monthsBetween,
  monthsBetweenDates,
} from "@/lib/trackerUtils";

export type ForecastBulletin = {
  month: string;
  fad: string;
  dof: string;
  fadUnavailable?: boolean;
  dofUnavailable?: boolean;
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
  isCurrentlyUnavailable: boolean;
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
  nearTermRisk: number;
  retrogressionRisk: number;
  unavailabilityRisk: number;
  currentUnavailabilityHoldMonths: number;
  horizon: {
    months: number;
    fadP50Capped: boolean;
    fadP90Capped: boolean;
    dofP50Capped: boolean;
    dofP90Capped: boolean;
    gcP50Capped: boolean;
    gcP90Capped: boolean;
  };
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
  hadNearTermPressure: boolean;
  hadRetrogression: boolean;
  hadUnavailability: boolean;
  finalFadAdvance: number;
};

type MonthlyAdvance = {
  delta: number;
  hadRetrogressionPressure: boolean;
};

export type ForecastPolicyEventProbabilities = {
  stall: number;
  smallAdvance: number;
  retrogression: number;
  unavailable: number;
};

export type ForecastPolicy = {
  windowMonths: number;
  eventProbabilities: ForecastPolicyEventProbabilities;
  stallMonths: { min: number; max: number };
  smallAdvanceMonths: { min: number; max: number };
  retrogressionMonths: { min: number; max: number };
  unavailableMonths: { min: number; max: number };
  dofRetrogressionShare?: number;
};

type PolicyEvent =
  | { type: "none" }
  | { type: "stall"; startMonth: number; durationMonths: number }
  | { type: "smallAdvance"; startMonth: number; advanceMonths: number }
  | {
      type: "retrogression";
      startMonth: number;
      durationMonths: number;
      fadShockMonths: number;
      dofShockMonths: number;
    }
  | { type: "unavailable"; startMonth: number; durationMonths: number };

const DEFAULT_POLICY_WINDOW_MONTHS = 12;

function bulletinMonthToDate(label: string): Date {
  return parseBulletinMonth(label);
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
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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

function drawRange(
  range: { min: number; max: number },
  rng: () => number
): number {
  return range.min + (range.max - range.min) * rng();
}

function normalizeEventProbabilities(
  policy?: ForecastPolicy
): ForecastPolicyEventProbabilities {
  if (!policy) {
    return {
      stall: 0,
      smallAdvance: 0,
      retrogression: 0,
      unavailable: 0,
    };
  }

  const raw = policy.eventProbabilities;
  const total =
    Math.max(raw.stall, 0) +
    Math.max(raw.smallAdvance, 0) +
    Math.max(raw.retrogression, 0) +
    Math.max(raw.unavailable, 0);
  if (total <= 1) {
    return {
      stall: Math.max(raw.stall, 0),
      smallAdvance: Math.max(raw.smallAdvance, 0),
      retrogression: Math.max(raw.retrogression, 0),
      unavailable: Math.max(raw.unavailable, 0),
    };
  }

  return {
    stall: Math.max(raw.stall, 0) / total,
    smallAdvance: Math.max(raw.smallAdvance, 0) / total,
    retrogression: Math.max(raw.retrogression, 0) / total,
    unavailable: Math.max(raw.unavailable, 0) / total,
  };
}

function drawPolicyEvent(
  policy: ForecastPolicy | undefined,
  rng: () => number
): PolicyEvent {
  if (!policy || policy.windowMonths <= 0) return { type: "none" };

  const probabilities = normalizeEventProbabilities(policy);
  const roll = rng();
  const startMonth = Math.floor(rng() * policy.windowMonths);

  if (roll < probabilities.unavailable) {
    return {
      type: "unavailable",
      startMonth,
      durationMonths: Math.max(
        1,
        Math.round(drawRange(policy.unavailableMonths, rng))
      ),
    };
  }

  if (roll < probabilities.unavailable + probabilities.retrogression) {
    const fadShockMonths = drawRange(policy.retrogressionMonths, rng);
    return {
      type: "retrogression",
      startMonth,
      durationMonths: Math.max(
        1,
        Math.round(drawRange(policy.stallMonths, rng))
      ),
      fadShockMonths,
      dofShockMonths: fadShockMonths * (policy.dofRetrogressionShare ?? 0.35),
    };
  }

  if (
    roll <
    probabilities.unavailable +
      probabilities.retrogression +
      probabilities.stall
  ) {
    return {
      type: "stall",
      startMonth,
      durationMonths: Math.max(
        1,
        Math.round(drawRange(policy.stallMonths, rng))
      ),
    };
  }

  if (
    roll <
    probabilities.unavailable +
      probabilities.retrogression +
      probabilities.stall +
      probabilities.smallAdvance
  ) {
    return {
      type: "smallAdvance",
      startMonth,
      advanceMonths: drawRange(policy.smallAdvanceMonths, rng),
    };
  }

  return { type: "none" };
}

function computeLeadMedian(bulletins: ForecastBulletin[]): number {
  const gaps = bulletins
    .filter(b => !b.fadUnavailable && !b.dofUnavailable)
    .map(b => monthsBetween(b.fad, b.dof))
    .filter(gap => gap > 0);
  return gaps.length > 0 ? median(gaps) : 6;
}

function buildSeriesStats(
  bulletins: ForecastBulletin[],
  key: "fad" | "dof"
): SeriesStats {
  const deltas: Array<{ fyMonth: number; delta: number }> = [];

  for (let i = 1; i < bulletins.length; i++) {
    const current = bulletins[i];
    const previous = bulletins[i - 1];
    const currentUnavailable =
      key === "fad" ? current.fadUnavailable : current.dofUnavailable;
    const previousUnavailable =
      key === "fad" ? previous.fadUnavailable : previous.dofUnavailable;
    if (currentUnavailable || previousUnavailable) continue;
    const delta = monthsBetween(bulletins[i - 1][key], current[key]);
    deltas.push({
      fyMonth: toFyMonth(bulletinMonthToDate(current.month).getMonth()),
      delta,
    });
  }

  const positive = deltas
    .map(entry => entry.delta)
    .filter(delta => delta > 0.05);
  const baseline = Math.max(median(positive), 0.25);

  const seasonality: Record<number, number> = {};
  const residualBuckets: Record<number, number[]> = {};
  for (let fyMonth = 1; fyMonth <= 12; fyMonth++) {
    residualBuckets[fyMonth] = [];
    const bucketPositives = deltas
      .filter(entry => entry.fyMonth === fyMonth && entry.delta > 0.05)
      .map(entry => entry.delta / baseline);
    seasonality[fyMonth] =
      bucketPositives.length > 0
        ? clamp(median(bucketPositives), 0.65, 1.6)
        : 1;
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

function sampleResidual(
  stats: SeriesStats,
  fyMonth: number,
  rng: () => number
): number {
  const bucket = stats.residualBuckets[fyMonth] ?? [];
  const bucketSample = bucket.length > 0 ? pickSample(bucket, rng) : 0;
  const overallSample = pickSample(stats.overallResiduals, rng);
  return bucket.length > 0
    ? bucketSample * 0.7 + overallSample * 0.3
    : overallSample;
}

function drawMonthlyAdvance(
  stats: SeriesStats,
  baseRate: number,
  demandCurve: DemandCurve,
  pdYear: number,
  fyMonth: number,
  rng: () => number
): MonthlyAdvance {
  const yearDemand = demandCurve.byYear[pdYear] ?? demandCurve.reference;
  const demandRatio = clamp(yearDemand / demandCurve.reference, 0.6, 1.8);
  const rawMultiplier =
    stats.seasonality[fyMonth] + sampleResidual(stats, fyMonth, rng);
  const multiplier = clamp(rawMultiplier, 0, 3.25);
  return {
    delta: (baseRate * multiplier) / Math.sqrt(demandRatio),
    hadRetrogressionPressure: rawMultiplier < -0.05,
  };
}

export function buildDemandCurve({ i485, i140 }: DemandInputs): DemandCurve {
  const overlapYears = Object.keys(i485)
    .map(Number)
    .filter(
      year => i485[year] > 0 && i140[year] !== undefined && i140[year] > 0
    );
  const overlapRatios = overlapYears
    .map(year => i485[year] / i140[year])
    .filter(Number.isFinite);
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

  const reference = Math.max(
    median(Object.values(byYear).filter(value => value > 0)),
    1
  );
  return { byYear, reference, scaleFactor };
}

export function createForecastContext(args: {
  bulletins: ForecastBulletin[];
  demand: DemandInputs;
}): ForecastContext {
  const demandCurve = buildDemandCurve(args.demand);
  const fadStats = buildSeriesStats(args.bulletins, "fad");
  const dofStats = buildSeriesStats(args.bulletins, "dof");
  const dofRateRatio = clamp(
    dofStats.baseline / Math.max(fadStats.baseline, 0.25),
    0.75,
    2.25
  );

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
  currentFadUnavailable?: boolean;
  currentUnavailabilityHoldMonths?: number;
  targetDate?: string;
  baseFadRate: number;
  gcLagMonths: number;
  seasonalityStartMonth: number;
  maxMonths: number;
  policy?: ForecastPolicy;
  context: ForecastContext;
  seed: string;
}): PathResult {
  const rng = mulberry32(hashString(args.seed));
  const target = args.targetDate ? parseDateStr(args.targetDate) : null;
  const baseDofRate = args.baseFadRate * args.context.dofRateRatio;
  const policyEvent = drawPolicyEvent(args.policy, rng);
  const currentUnavailabilityHoldMonths = Math.max(
    0,
    Math.round(
      args.currentUnavailabilityHoldMonths ??
        (args.currentFadUnavailable ? 1 : 0)
    )
  );

  let fadCursor = parseDateStr(args.currentFad);
  let dofCursor = parseDateStr(args.currentDof);
  if (dofCursor.getTime() < fadCursor.getTime())
    dofCursor = new Date(fadCursor);

  let fadReachedMonths =
    target &&
    !args.currentFadUnavailable &&
    monthsBetweenDates(fadCursor, target) <= 0
      ? 0
      : null;
  let dofReachedMonths =
    target && monthsBetweenDates(dofCursor, target) <= 0 ? 0 : null;
  let hadNearTermPressure = false;
  let hadRetrogression = false;
  let hadUnavailability = false;

  for (let step = 0; step < args.maxMonths; step++) {
    const monthIdx = (args.seasonalityStartMonth + step) % 12;
    const fyMonth = toFyMonth(monthIdx);

    const fadAdvance = drawMonthlyAdvance(
      args.context.fadStats,
      args.baseFadRate,
      args.context.demandCurve,
      fadCursor.getFullYear(),
      fyMonth,
      rng
    );
    const dofAdvance = drawMonthlyAdvance(
      args.context.dofStats,
      baseDofRate,
      args.context.demandCurve,
      dofCursor.getFullYear(),
      fyMonth,
      rng
    );
    let fadDelta = fadAdvance.delta;
    let dofDelta = dofAdvance.delta;
    const currentUnavailableActive = step < currentUnavailabilityHoldMonths;

    if (
      step < (args.policy?.windowMonths ?? DEFAULT_POLICY_WINDOW_MONTHS) &&
      (fadAdvance.hadRetrogressionPressure ||
        dofAdvance.hadRetrogressionPressure)
    ) {
      hadNearTermPressure = true;
    }

    if (currentUnavailableActive) {
      fadDelta = 0;
      dofDelta = 0;
      hadNearTermPressure = true;
      hadUnavailability = true;
    } else if (policyEvent.type !== "none") {
      const activePolicyMonth =
        step >= policyEvent.startMonth &&
        ("durationMonths" in policyEvent
          ? step < policyEvent.startMonth + policyEvent.durationMonths
          : step === policyEvent.startMonth);

      if (
        step === policyEvent.startMonth &&
        policyEvent.type === "retrogression"
      ) {
        fadCursor = addApproxMonths(fadCursor, -policyEvent.fadShockMonths);
        dofCursor = addApproxMonths(dofCursor, -policyEvent.dofShockMonths);
        if (dofCursor.getTime() < fadCursor.getTime())
          dofCursor = new Date(fadCursor);
        hadNearTermPressure = true;
        hadRetrogression = true;
      }

      if (
        activePolicyMonth &&
        (policyEvent.type === "stall" ||
          policyEvent.type === "retrogression" ||
          policyEvent.type === "unavailable")
      ) {
        fadDelta = 0;
        dofDelta = 0;
        hadNearTermPressure = true;
        if (policyEvent.type === "unavailable") hadUnavailability = true;
      }

      if (
        step === policyEvent.startMonth &&
        policyEvent.type === "smallAdvance"
      ) {
        fadDelta += policyEvent.advanceMonths;
        dofDelta += policyEvent.advanceMonths * args.context.dofRateRatio;
      }
    }

    if (target) {
      const fadRemaining = monthsBetweenDates(fadCursor, target);
      if (fadReachedMonths === null && !currentUnavailableActive) {
        if (fadRemaining <= 0) {
          fadReachedMonths = step;
        } else if (fadDelta > 0 && fadRemaining <= fadDelta) {
          fadReachedMonths = step + fadRemaining / fadDelta;
        }
      }

      const dofRemaining = monthsBetweenDates(dofCursor, target);
      if (dofReachedMonths === null) {
        if (dofRemaining <= 0) {
          dofReachedMonths = step;
        } else if (dofDelta > 0 && dofRemaining <= dofDelta) {
          dofReachedMonths = step + dofRemaining / dofDelta;
        }
      }
    }

    fadCursor = addApproxMonths(fadCursor, fadDelta);
    dofCursor = addApproxMonths(dofCursor, dofDelta);
    if (dofCursor.getTime() < fadCursor.getTime())
      dofCursor = new Date(fadCursor);

    if (target && fadReachedMonths !== null && dofReachedMonths !== null) break;
  }

  const cappedFadMonths = fadReachedMonths ?? args.maxMonths;
  const cappedDofMonths = dofReachedMonths ?? args.maxMonths;

  return {
    fadReachedMonths: cappedFadMonths,
    dofReachedMonths: cappedDofMonths,
    gcReachedMonths: cappedFadMonths + args.gcLagMonths,
    hadNearTermPressure,
    hadRetrogression,
    hadUnavailability,
    finalFadAdvance: monthsBetweenDates(
      parseDateStr(args.currentFad),
      fadCursor
    ),
  };
}

function summarizeMonths(
  today: Date,
  values: number[]
): { months: QuantileMonths; dates: QuantileDates } {
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
  currentFadUnavailable?: boolean;
  currentUnavailabilityHoldMonths?: number;
  targetDate: string;
  baseFadRate: number;
  gcLagMonths: number;
  seasonalityStartMonth: number;
  policy?: ForecastPolicy;
  paths?: number;
  maxMonths?: number;
  seed?: string;
}): ForecastProjection {
  const currentUnavailabilityHoldMonths = Math.max(
    0,
    Math.round(
      args.currentUnavailabilityHoldMonths ??
        (args.currentFadUnavailable ? 1 : 0)
    )
  );
  const gapPDMonths = monthsBetween(args.currentFad, args.targetDate);
  if (gapPDMonths <= 0 && !args.currentFadUnavailable) {
    const current = parseDateStr(args.currentFad);
    return {
      isAlreadyCurrent: true,
      isCurrentlyUnavailable: false,
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
      nearTermRisk: 0,
      retrogressionRisk: 0,
      unavailabilityRisk: 0,
      currentUnavailabilityHoldMonths: 0,
      horizon: {
        months: 0,
        fadP50Capped: false,
        fadP90Capped: false,
        dofP50Capped: false,
        dofP90Capped: false,
        gcP50Capped: false,
        gcP90Capped: false,
      },
    };
  }

  const pathCount = args.paths ?? 500;
  const maxMonths = args.maxMonths ?? 240;
  const fadReached: number[] = [];
  const dofReached: number[] = [];
  const gcReached: number[] = [];
  let nearTermPressurePaths = 0;
  let retrogressionPaths = 0;
  let unavailabilityPaths = 0;

  for (let i = 0; i < pathCount; i++) {
    const path = simulatePath({
      today: args.today,
      currentFad: args.currentFad,
      currentDof: args.currentDof,
      currentFadUnavailable: args.currentFadUnavailable,
      currentUnavailabilityHoldMonths,
      targetDate: args.targetDate,
      baseFadRate: args.baseFadRate,
      gcLagMonths: args.gcLagMonths,
      seasonalityStartMonth: args.seasonalityStartMonth,
      maxMonths,
      policy: args.policy,
      context: args.context,
      seed: `${args.seed ?? "forecast"}:${i}`,
    });
    fadReached.push(path.fadReachedMonths);
    dofReached.push(path.dofReachedMonths);
    gcReached.push(path.gcReachedMonths);
    if (path.hadNearTermPressure) nearTermPressurePaths += 1;
    if (path.hadRetrogression) retrogressionPaths += 1;
    if (path.hadUnavailability) unavailabilityPaths += 1;
  }

  const fadSummary = summarizeMonths(args.today, fadReached);
  const dofSummary = summarizeMonths(args.today, dofReached);
  const gcSummary = summarizeMonths(args.today, gcReached);

  return {
    isAlreadyCurrent: false,
    isCurrentlyUnavailable: !!args.currentFadUnavailable,
    gapPDMonths: Math.max(0, Math.round(gapPDMonths)),
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
    nearTermRisk: nearTermPressurePaths / pathCount,
    retrogressionRisk: retrogressionPaths / pathCount,
    unavailabilityRisk: unavailabilityPaths / pathCount,
    currentUnavailabilityHoldMonths,
    horizon: {
      months: maxMonths,
      fadP50Capped: fadSummary.months.p50 >= maxMonths,
      fadP90Capped: fadSummary.months.p90 >= maxMonths,
      dofP50Capped: dofSummary.months.p50 >= maxMonths,
      dofP90Capped: dofSummary.months.p90 >= maxMonths,
      gcP50Capped: gcSummary.months.p50 >= maxMonths + args.gcLagMonths,
      gcP90Capped: gcSummary.months.p90 >= maxMonths + args.gcLagMonths,
    },
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

  for (
    let t = minTrainingWindows - 1;
    t < args.bulletins.length - horizonMonths;
    t++
  ) {
    const training = args.bulletins.slice(0, t + 1);
    const current = training[training.length - 1];
    const future = args.bulletins[t + horizonMonths];
    if (current.fadUnavailable || future.fadUnavailable) continue;
    const context = createForecastContext({
      bulletins: training,
      demand: args.demand,
    });
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
        seed: `${args.seed ?? "backtest"}:${t}:${i}`,
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

  const mae =
    errors.length > 0
      ? errors.reduce((sum, value) => sum + value, 0) / errors.length
      : 0;
  return {
    mae: Math.round(mae * 10) / 10,
    coverage80: errors.length > 0 ? covered / errors.length : 0,
    predictions: errors.length,
  };
}
