import { describe, expect, it } from 'vitest';

import { CURRENT_BULLETIN, EB_CATEGORIES, SCENARIOS, TRACKER_SOURCE_LINKS } from '@/data/trackerData';

import { generateResponse, type EngineContext } from './ebChatEngine';
import type { ForecastProjection } from './forecast';

function projection(monthOffset: number): ForecastProjection {
  const baseDate = new Date(2027, monthOffset, 1);

  return {
    isAlreadyCurrent: false,
    gapPDMonths: 60,
    monthsFromToday: monthOffset,
    fadDate: baseDate,
    dofDate: new Date(2026, monthOffset, 1),
    gcDate: new Date(2028, monthOffset, 1),
    fadMonths: { p10: monthOffset - 2, p50: monthOffset, p90: monthOffset + 2 },
    dofMonths: { p10: monthOffset - 3, p50: monthOffset - 1, p90: monthOffset + 1 },
    gcMonths: { p10: monthOffset + 8, p50: monthOffset + 10, p90: monthOffset + 12 },
    fadRange: { p10: baseDate, p50: baseDate, p90: baseDate },
    dofRange: { p10: baseDate, p50: baseDate, p90: baseDate },
    gcRange: { p10: baseDate, p50: baseDate, p90: baseDate },
    nearTermRisk: 0.1,
    retrogressionRisk: 0.2,
    unavailabilityRisk: 0.05,
    horizon: {
      months: 240,
      fadP50Capped: false,
      fadP90Capped: false,
      dofP50Capped: false,
      dofP90Capped: false,
      gcP50Capped: false,
      gcP90Capped: false,
    },
  };
}

const context: EngineContext = {
  categoryLabel: 'EB-2',
  categoryKey: 'EB2',
  targetDate: '2020-06-01',
  currentFad: EB_CATEGORIES.EB2.currentFAD,
  currentDof: EB_CATEGORIES.EB2.currentDoF,
  projections: {
    optimistic: projection(10),
    base: projection(14),
    conservative: projection(20),
    pessimistic: projection(30),
  },
  scenarios: SCENARIOS,
  assumptionsSummary: 'default test assumptions',
  backtest: { mae: 2.1, coverage80: 0.8, predictions: 12 },
  sourceLinks: TRACKER_SOURCE_LINKS,
};

describe('EB chat engine', () => {
  it('answers filing questions from the active forecast context', () => {
    const response = generateResponse('When can I file I-485?', context, []);

    expect(response.intent).toBe('filing');
    expect(response.text).toContain('EB-2 India');
    expect(response.text).toContain(CURRENT_BULLETIN.month);
    expect(response.sources.length).toBeGreaterThan(0);
  });

  it('does not mix mentioned-category cutoffs with active-category projections', () => {
    const response = generateResponse('When will EB-3 FAD be current for me?', context, []);

    expect(response.intent).toBe('fad');
    expect(response.text).toContain('EB-3 India');
    expect(response.text).toContain('forecast currently loaded');
    expect(response.text).toContain('switch the active category');
    expect(response.text).not.toContain('Base Case estimate');
  });

  it('keeps cross-category comparison available without switching context', () => {
    const response = generateResponse('Compare EB-1 vs EB-2 vs EB-3', context, []);

    expect(response.intent).toBe('comparison');
    expect(response.text).toContain('EB-1');
    expect(response.text).toContain('EB-2');
    expect(response.text).toContain('EB-3');
  });
});
