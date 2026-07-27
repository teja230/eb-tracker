import { describe, expect, it } from "vitest";

import {
  applyAssumptionRates,
  buildForecastPolicy,
  buildHistoricalSeries,
  bulletinUrl,
  clipHistoricalSeries,
  fmtProjectionDate,
  fmtProjectionDateRange,
  fmtProjectionDuration,
  fmtSensitivityDelta,
  fiscalYearRecoveryHoldMonths,
  getHistoricalPointInsight,
  historicalCategoryKeys,
} from "./homeShared";

// ---------------------------------------------------------------------------
// bulletinUrl
// ---------------------------------------------------------------------------

describe("bulletinUrl", () => {
  it("uses the calendar year for Jan-Sep bulletins", () => {
    expect(bulletinUrl("Jan 2026")).toBe(
      "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-january-2026.html"
    );
    expect(bulletinUrl("Jun 2024")).toContain(
      "/2024/visa-bulletin-for-june-2024.html"
    );
    expect(bulletinUrl("Sep 2025")).toContain(
      "/2025/visa-bulletin-for-september-2025.html"
    );
  });

  it("advances the FY year for Oct-Dec bulletins", () => {
    // Oct 2025 belongs to FY 2026
    expect(bulletinUrl("Oct 2025")).toContain(
      "/2026/visa-bulletin-for-october-2025.html"
    );
    expect(bulletinUrl("Nov 2024")).toContain(
      "/2025/visa-bulletin-for-november-2024.html"
    );
    expect(bulletinUrl("Dec 2023")).toContain(
      "/2024/visa-bulletin-for-december-2023.html"
    );
  });

  it("returns a fully-qualified https URL in every case", () => {
    for (const month of [
      "Jan 2026",
      "Apr 2025",
      "Jul 2024",
      "Oct 2023",
      "Dec 2022",
    ]) {
      const url = bulletinUrl(month);
      expect(url).toMatch(/^https:\/\/travel\.state\.gov\//);
      expect(url).toMatch(/visa-bulletin-for-[a-z]+-\d{4}\.html$/);
    }
  });
});

// ---------------------------------------------------------------------------
// applyAssumptionRates
// ---------------------------------------------------------------------------

describe("applyAssumptionRates", () => {
  const BASE_RATES = {
    optimistic: 1.2,
    base: 0.9,
    conservative: 0.6,
    pessimistic: 0.4,
  };

  it("returns unchanged rates for all-moderate settings", () => {
    const result = applyAssumptionRates(BASE_RATES, {
      spilloverLevel: "moderate",
      banContinues: "2028",
      wastageLevel: "moderate",
    });
    expect(result.optimistic).toBeCloseTo(1.2, 3);
    expect(result.base).toBeCloseTo(0.9, 3);
    expect(result.conservative).toBeCloseTo(0.6, 3);
    expect(result.pessimistic).toBeCloseTo(0.4, 3);
  });

  it("scales all scenarios proportionally when multipliers shift", () => {
    // high spillover (×1.25), 2029 ban (×1.15), low wastage (×1.1) = combined 1.58125
    const result = applyAssumptionRates(BASE_RATES, {
      spilloverLevel: "high",
      banContinues: "2029",
      wastageLevel: "low",
    });
    const combined = 1.25 * 1.15 * 1.1;
    expect(result.optimistic).toBeCloseTo(BASE_RATES.optimistic * combined, 2);
    expect(result.base).toBeCloseTo(BASE_RATES.base * combined, 2);
  });

  it("reduces rates for pessimistic combination (low spillover, 2027 ban, high wastage)", () => {
    // low (×0.75), 2027 (×0.85), high wastage (×0.8) = 0.51
    const result = applyAssumptionRates(BASE_RATES, {
      spilloverLevel: "low",
      banContinues: "2027",
      wastageLevel: "high",
    });
    expect(result.base).toBeLessThan(BASE_RATES.base);
    expect(result.optimistic).toBeLessThan(BASE_RATES.optimistic);
  });

  it("preserves the relative ordering of scenarios after adjustment", () => {
    const result = applyAssumptionRates(BASE_RATES, {
      spilloverLevel: "high",
      banContinues: "2028",
      wastageLevel: "moderate",
    });
    expect(result.optimistic).toBeGreaterThan(result.base);
    expect(result.base).toBeGreaterThan(result.conservative);
    expect(result.conservative).toBeGreaterThan(result.pessimistic);
  });
});

// ---------------------------------------------------------------------------
// buildForecastPolicy
// ---------------------------------------------------------------------------

describe("buildForecastPolicy", () => {
  const BASE_ARGS = {
    spilloverLevel: "moderate" as const,
    banContinues: "2028" as const,
    wastageLevel: "moderate" as const,
  };

  it("produces non-negative event probabilities that don't exceed 0.95", () => {
    for (const scenario of [
      "optimistic",
      "base",
      "conservative",
      "pessimistic",
    ] as const) {
      const policy = buildForecastPolicy({
        ...BASE_ARGS,
        scenario,
        category: "EB2",
      });
      const probs = Object.values(policy.eventProbabilities);
      probs.forEach(p => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(0.95);
      });
    }
  });

  it("conservative scenario has higher retrogression probability than optimistic", () => {
    const opt = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "optimistic",
      category: "EB2",
    });
    const cons = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "conservative",
      category: "EB2",
    });
    expect(cons.eventProbabilities.retrogression).toBeGreaterThan(
      opt.eventProbabilities.retrogression
    );
  });

  it("pessimistic scenario has wider retrogression month range than optimistic", () => {
    const opt = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "optimistic",
      category: "EB2",
    });
    const pess = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "pessimistic",
      category: "EB2",
    });
    expect(pess.retrogressionMonths.max).toBeGreaterThan(
      opt.retrogressionMonths.max
    );
  });

  it("EB2 has wider retrogression range than EB1", () => {
    const eb1 = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "base",
      category: "EB1",
    });
    const eb2 = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "base",
      category: "EB2",
    });
    expect(eb2.retrogressionMonths.max).toBeGreaterThan(
      eb1.retrogressionMonths.max
    );
  });

  it("always uses a 12-month window and non-zero dofRetrogressionShare", () => {
    const policy = buildForecastPolicy({
      ...BASE_ARGS,
      scenario: "base",
      category: "EB3",
    });
    expect(policy.windowMonths).toBe(12);
    expect(policy.dofRetrogressionShare).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// fmtProjectionDate / fmtProjectionDateRange / fmtProjectionDuration
// ---------------------------------------------------------------------------

describe("fmtProjectionDate", () => {
  it("returns the formatted date when not capped", () => {
    const d = new Date(2028, 2, 15); // Mar 15, 2028
    expect(fmtProjectionDate(d, false)).toBe("Mar 15, 2028");
  });

  it("returns a >YEAR string when capped", () => {
    const d = new Date(2028, 2, 15);
    const result = fmtProjectionDate(d, true);
    expect(result).toMatch(/^>\d{4}$/);
    const year = parseInt(result.slice(1));
    expect(year).toBeGreaterThanOrEqual(new Date().getFullYear() + 19);
  });
});

describe("fmtProjectionDateRange", () => {
  const p10 = new Date(2027, 0, 1); // Jan 1, 2027
  const p90 = new Date(2029, 5, 1); // Jun 1, 2029

  it("formats a normal range as 'p10 - p90'", () => {
    expect(fmtProjectionDateRange(p10, p90, false)).toBe(
      "Jan 1, 2027 - Jun 1, 2029"
    );
  });

  it("replaces the p90 date with 'beyond horizon' when capped", () => {
    expect(fmtProjectionDateRange(p10, p90, true)).toBe(
      "Jan 1, 2027 - beyond horizon"
    );
  });
});

describe("fmtProjectionDuration", () => {
  it("formats uncapped durations normally", () => {
    expect(fmtProjectionDuration(6, false)).toBe("6 mo");
    expect(fmtProjectionDuration(18, false)).toBe("1 yr 6 mo");
    expect(fmtProjectionDuration(24, false)).toBe("2 yrs");
  });

  it("prepends '>' for capped durations", () => {
    expect(fmtProjectionDuration(24, true)).toBe(">2 yrs");
    expect(fmtProjectionDuration(6, true)).toBe(">6 mo");
  });
});

// ---------------------------------------------------------------------------
// fmtSensitivityDelta
// ---------------------------------------------------------------------------

describe("fmtSensitivityDelta", () => {
  it("returns 'No change' for zero", () => {
    expect(fmtSensitivityDelta(0)).toBe("No change");
  });

  it("labels positive deltas as 'X mo later'", () => {
    expect(fmtSensitivityDelta(3)).toBe("3 mo later");
    expect(fmtSensitivityDelta(3.7)).toBe("4 mo later");
  });

  it("labels negative deltas as 'X mo earlier'", () => {
    expect(fmtSensitivityDelta(-5)).toBe("5 mo earlier");
    expect(fmtSensitivityDelta(-2.3)).toBe("2 mo earlier");
  });
});

// ---------------------------------------------------------------------------
// getHistoricalPointInsight
// ---------------------------------------------------------------------------

describe("getHistoricalPointInsight", () => {
  const fad2015 = new Date(2015, 0, 1).getTime(); // Jan 1, 2015
  const dof2015 = new Date(2015, 6, 1).getTime(); // Jul 1, 2015 (6 mo lead)

  it("reports 'Matches' when FAD equals the target date", () => {
    const result = getHistoricalPointInsight(
      { month: "Jan 2025", fadRaw: fad2015, dofRaw: dof2015 },
      "2015-01-01"
    );
    expect(result.targetStatus).toBe("Matches your priority date");
    expect(result.dofLead).toBeCloseTo(6, 0);
  });

  it("reports 'behind' when FAD is before the target date", () => {
    const result = getHistoricalPointInsight(
      { month: "Jan 2025", fadRaw: fad2015, dofRaw: dof2015 },
      "2016-01-01" // target is 12 months ahead of FAD
    );
    expect(result.targetStatus).toContain("behind your priority date");
  });

  it("reports 'past' when FAD is after the target date", () => {
    const result = getHistoricalPointInsight(
      { month: "Jan 2025", fadRaw: fad2015, dofRaw: dof2015 },
      "2014-01-01" // target is 12 months before FAD
    );
    expect(result.targetStatus).toContain("past your priority date");
  });
});

// ---------------------------------------------------------------------------
// historicalCategoryKeys
// ---------------------------------------------------------------------------

describe("historicalCategoryKeys", () => {
  it("returns EB1 keys", () => {
    expect(historicalCategoryKeys("EB1")).toEqual({
      fadKey: "eb1_fad",
      dofKey: "eb1_dof",
    });
  });

  it("returns EB2 keys", () => {
    expect(historicalCategoryKeys("EB2")).toEqual({
      fadKey: "eb2_fad",
      dofKey: "eb2_dof",
    });
  });

  it("returns EB3 keys", () => {
    expect(historicalCategoryKeys("EB3")).toEqual({
      fadKey: "eb3_fad",
      dofKey: "eb3_dof",
    });
  });
});

// ---------------------------------------------------------------------------
// buildHistoricalSeries
// ---------------------------------------------------------------------------

describe("buildHistoricalSeries", () => {
  const rows = [
    { month: "Jun 2024", eb2_fad: "2014-06-01", eb2_dof: "2015-01-01" } as any,
    { month: "Jul 2024", eb2_fad: "2014-07-01", eb2_dof: "2015-02-01" } as any,
    { month: "Aug 2024", eb2_fad: "2014-08-01", eb2_dof: "2015-03-01" } as any,
  ];

  it("reverses the input rows (oldest first by index 0)", () => {
    const series = buildHistoricalSeries(rows, "EB2");
    expect(series[0].month).toBe("Aug 2024");
    expect(series[series.length - 1].month).toBe("Jun 2024");
  });

  it("produces numeric timestamps for fad/dof fields", () => {
    const series = buildHistoricalSeries(rows, "EB2");
    series.forEach(point => {
      expect(typeof point.fadRaw).toBe("number");
      expect(typeof point.dofRaw).toBe("number");
      expect(point.dof).toBeGreaterThan(point.fad);
    });
  });

  it("assigns a sequential idx to each point", () => {
    const series = buildHistoricalSeries(rows, "EB2");
    series.forEach((point, i) => expect(point.idx).toBe(i));
  });

  it("labels unavailable FAD rows without losing the recovery anchor timestamp", () => {
    const series = buildHistoricalSeries(
      [
        {
          month: "August 2026",
          eb2_fad: "2014-07-15",
          eb2_fad_status: "unavailable",
          eb2_dof: "2015-01-15",
        } as any,
      ],
      "EB2"
    );

    expect(series[0].fadLabel).toBe("Unavailable");
    expect(series[0].fadStatus).toBe("unavailable");
    expect(series[0].fadRaw).toBe(new Date(2014, 6, 15).getTime());
  });
});

describe("fiscalYearRecoveryHoldMonths", () => {
  it("holds an unavailable August bulletin through the September simulation step", () => {
    expect(fiscalYearRecoveryHoldMonths(8, true)).toBe(1);
  });

  it("does not add a hold after the October simulation step starts", () => {
    expect(fiscalYearRecoveryHoldMonths(9, true)).toBe(0);
    expect(fiscalYearRecoveryHoldMonths(8, false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clipHistoricalSeries
// ---------------------------------------------------------------------------

describe("clipHistoricalSeries", () => {
  it("returns an empty array unchanged", () => {
    expect(clipHistoricalSeries([])).toEqual([]);
  });

  it("raises fad/dof values below the floor quantile without touching values above it", () => {
    // 10 points where point 0 is a clear outlier far below the rest
    const points = Array.from({ length: 10 }, (_, i) => ({
      fadRaw: i === 0 ? 1000 : 1_000_000 + i * 1000,
      dofRaw: i === 0 ? 2000 : 1_100_000 + i * 1000,
    }));

    const clipped = clipHistoricalSeries(points, 0.1);

    // The outlier at index 0 should be raised to the 10th-percentile floor
    expect(clipped[0].fad).toBeGreaterThan(points[0].fadRaw);

    // Other points (well above the floor) should be unchanged
    for (let i = 1; i < clipped.length; i++) {
      expect(clipped[i].fad).toBe(points[i].fadRaw);
    }
  });

  it("preserves all original fadRaw / dofRaw values on each point", () => {
    const points = [
      { fadRaw: 100, dofRaw: 200 },
      { fadRaw: 300, dofRaw: 400 },
    ];
    const clipped = clipHistoricalSeries(points);
    clipped.forEach((point, i) => {
      expect(point.fadRaw).toBe(points[i].fadRaw);
      expect(point.dofRaw).toBe(points[i].dofRaw);
    });
  });
});
