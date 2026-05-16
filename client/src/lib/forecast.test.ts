import { describe, expect, it } from 'vitest';

import { EB_CATEGORIES, HISTORICAL_BULLETINS, I140_INDIA_APPROVALS, I485_INDIA_PENDING } from '@/data/trackerData';

import { backtestForecast, buildDemandCurve, createForecastContext, forecastScenario, type ForecastBulletin } from './forecast';
import { MONTH_LABELS } from './trackerUtils';

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildLinearBulletins(count = 20): ForecastBulletin[] {
  return Array.from({ length: count }, (_, index) => {
    const bulletinDate = new Date(2023, index, 1);
    const fadDate = new Date(2012, index, 1);
    const dofDate = new Date(2012, index + 6, 1);

    return {
      month: `${MONTH_LABELS[bulletinDate.getMonth()]} ${bulletinDate.getFullYear()}`,
      fad: toIsoDate(fadDate),
      dof: toIsoDate(dofDate),
    };
  });
}

const demand = {
  i485: { 2012: 100, 2013: 140, 2014: 120 },
  i140: { 2012: 50, 2013: 70, 2014: 60, 2015: 80 },
};

describe('forecast engine', () => {
  it('buildDemandCurve prefers I-485 inventory and scales future I-140 years', () => {
    const curve = buildDemandCurve({
      i485: { 2012: 100, 2013: 200 },
      i140: { 2012: 50, 2013: 100, 2014: 150 },
    });

    expect(curve.scaleFactor).toBe(2);
    expect(curve.byYear).toEqual({
      2012: 100,
      2013: 200,
      2014: 300,
    });
    expect(curve.reference).toBe(200);
  });

  it('createForecastContext preserves the median DoF lead from the bulletin history', () => {
    const context = createForecastContext({
      bulletins: buildLinearBulletins(18),
      demand,
    });

    expect(context.dofLeadMedian).toBeCloseTo(6, 1);
    expect(context.dofRateRatio).toBeGreaterThan(0);
    expect(context.bulletins).toHaveLength(18);
  });

  it('forecastScenario is reproducible for a fixed seed', () => {
    const context = createForecastContext({
      bulletins: buildLinearBulletins(18),
      demand,
    });

    const args = {
      context,
      today: new Date(2026, 2, 19),
      currentFad: '2013-07-15',
      currentDof: '2014-01-15',
      targetDate: '2014-07-15',
      baseFadRate: 0.9,
      gcLagMonths: 15,
      seasonalityStartMonth: 4,
      paths: 50,
      maxMonths: 60,
      seed: 'deterministic-seed',
    };

    const first = forecastScenario(args);
    const second = forecastScenario(args);

    expect({
      gapPDMonths: first.gapPDMonths,
      monthsFromToday: first.monthsFromToday,
      retrogressionRisk: first.retrogressionRisk,
      fadMonths: first.fadMonths,
      dofMonths: first.dofMonths,
      gcMonths: first.gcMonths,
      fadDate: first.fadDate.toISOString(),
      dofDate: first.dofDate.toISOString(),
      gcDate: first.gcDate.toISOString(),
    }).toEqual({
      gapPDMonths: second.gapPDMonths,
      monthsFromToday: second.monthsFromToday,
      retrogressionRisk: second.retrogressionRisk,
      fadMonths: second.fadMonths,
      dofMonths: second.dofMonths,
      gcMonths: second.gcMonths,
      fadDate: second.fadDate.toISOString(),
      dofDate: second.dofDate.toISOString(),
      gcDate: second.gcDate.toISOString(),
    });
  });

  it('forecastScenario short-circuits when the target priority date is already current', () => {
    const context = createForecastContext({
      bulletins: buildLinearBulletins(18),
      demand,
    });

    const result = forecastScenario({
      context,
      today: new Date(2026, 2, 19),
      currentFad: '2014-07-15',
      currentDof: '2015-01-15',
      targetDate: '2014-07-15',
      baseFadRate: 1,
      gcLagMonths: 15,
      seasonalityStartMonth: 4,
      paths: 10,
      maxMonths: 12,
    });

    expect(result.isAlreadyCurrent).toBe(true);
    expect(result.monthsFromToday).toBe(0);
    expect(result.retrogressionRisk).toBe(0);
    expect(result.fadDate.getFullYear()).toBe(2014);
    expect(result.fadDate.getMonth()).toBe(6);
    expect(result.fadDate.getDate()).toBe(15);
  });

  it('uses a large current-bulletin retrogression as risk pressure, not repeated backward movement', () => {
    const category = EB_CATEGORIES.EB2;
    const bulletins = [...HISTORICAL_BULLETINS].reverse().map(row => ({
      month: row.month,
      fad: row.eb2_fad,
      dof: row.eb2_dof,
    }));
    const context = createForecastContext({
      bulletins,
      demand: {
        i485: I485_INDIA_PENDING.EB2,
        i140: I140_INDIA_APPROVALS.EB2,
      },
    });

    const result = forecastScenario({
      context,
      today: new Date(2026, 5, 1),
      currentFad: category.currentFAD,
      currentDof: category.currentDoF,
      targetDate: '2016-08-01',
      baseFadRate: category.rates.base,
      gcLagMonths: category.gcLagMonths,
      seasonalityStartMonth: 6,
      paths: 120,
      maxMonths: 240,
      seed: 'june-2026-eb2-retrogression',
    });

    expect(result.isAlreadyCurrent).toBe(false);
    expect(result.fadMonths.p50).toBeLessThan(120);
    expect(result.fadMonths.p90).toBeLessThan(240);
    expect(result.retrogressionRisk).toBeLessThan(1);
  });

  it('backtestForecast returns an empty summary when there is not enough history', () => {
    const result = backtestForecast({
      bulletins: buildLinearBulletins(10),
      demand,
      baseFadRate: 1,
      gcLagMonths: 15,
    });

    expect(result).toEqual({
      mae: 0,
      coverage80: 0,
      predictions: 0,
    });
  });

  it('backtestForecast returns bounded metrics when enough history is available', () => {
    const result = backtestForecast({
      bulletins: buildLinearBulletins(20),
      demand,
      baseFadRate: 1,
      gcLagMonths: 15,
      horizonMonths: 6,
      paths: 40,
      seed: 'backtest-seed',
    });

    expect(result.predictions).toBeGreaterThan(0);
    expect(result.mae).toBeGreaterThanOrEqual(0);
    expect(result.coverage80).toBeGreaterThanOrEqual(0);
    expect(result.coverage80).toBeLessThanOrEqual(1);
  });
});
