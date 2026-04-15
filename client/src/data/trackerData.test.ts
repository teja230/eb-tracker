import { describe, expect, it } from 'vitest';

import {
  ARCHIVED_BULLETIN_TRACKER_HISTORY,
  BULLETIN_TRACKER_HISTORY,
  CURRENT_BULLETIN,
  HISTORICAL_BULLETINS,
  type HistoricalBulletinRow,
} from './trackerData';
import { areConsecutiveBulletinMonths, bulletinMonthDiffInMonths, parseBulletinMonth, parseDateStr } from '@/lib/trackerUtils';

const DATE_KEYS: Array<keyof HistoricalBulletinRow> = ['eb1_fad', 'eb1_dof', 'eb2_fad', 'eb2_dof', 'eb3_fad', 'eb3_dof'];

function expectDofNotBeforeFad(history: HistoricalBulletinRow[]) {
  history.forEach(row => {
    expect(parseDateStr(row.eb1_dof).getTime()).toBeGreaterThanOrEqual(parseDateStr(row.eb1_fad).getTime());
    expect(parseDateStr(row.eb2_dof).getTime()).toBeGreaterThanOrEqual(parseDateStr(row.eb2_fad).getTime());
    expect(parseDateStr(row.eb3_dof).getTime()).toBeGreaterThanOrEqual(parseDateStr(row.eb3_fad).getTime());
  });
}

describe('tracker bulletin data', () => {
  it('keeps the model history aligned with CURRENT_BULLETIN', () => {
    expect(HISTORICAL_BULLETINS[0]).toEqual({
      month: 'May 2026',
      eb1_fad: CURRENT_BULLETIN.eb1.fad,
      eb1_dof: CURRENT_BULLETIN.eb1.dof,
      eb2_fad: CURRENT_BULLETIN.eb2.fad,
      eb2_dof: CURRENT_BULLETIN.eb2.dof,
      eb3_fad: CURRENT_BULLETIN.eb3.fad,
      eb3_dof: CURRENT_BULLETIN.eb3.dof,
    });
  });

  it('preserves a contiguous month-by-month model history for the forecast engine', () => {
    for (let i = 0; i < HISTORICAL_BULLETINS.length - 1; i++) {
      expect(bulletinMonthDiffInMonths(HISTORICAL_BULLETINS[i].month, HISTORICAL_BULLETINS[i + 1].month)).toBe(1);
    }
  });

  it('stores valid FAD/DoF ordering across both model and tracker archive histories', () => {
    expectDofNotBeforeFad(HISTORICAL_BULLETINS);
    expectDofNotBeforeFad(BULLETIN_TRACKER_HISTORY);
  });

  it('adds a unique descending FY2020-FY2022 archive with full tracker continuity', () => {
    expect(ARCHIVED_BULLETIN_TRACKER_HISTORY).toHaveLength(36);
    expect(ARCHIVED_BULLETIN_TRACKER_HISTORY[0].month).toBe('Sep 2022');
    expect(ARCHIVED_BULLETIN_TRACKER_HISTORY[ARCHIVED_BULLETIN_TRACKER_HISTORY.length - 1].month).toBe('Oct 2019');

    const months = BULLETIN_TRACKER_HISTORY.map(row => row.month);
    expect(new Set(months).size).toBe(months.length);

    for (let i = 0; i < BULLETIN_TRACKER_HISTORY.length - 1; i++) {
      expect(parseBulletinMonth(BULLETIN_TRACKER_HISTORY[i].month).getTime()).toBeGreaterThan(parseBulletinMonth(BULLETIN_TRACKER_HISTORY[i + 1].month).getTime());
      expect(bulletinMonthDiffInMonths(BULLETIN_TRACKER_HISTORY[i].month, BULLETIN_TRACKER_HISTORY[i + 1].month)).toBe(1);
    }

    expect(areConsecutiveBulletinMonths('Oct 2022', 'Sep 2022')).toBe(true);
  });

  it('keeps the Current-to-date encoding for FY2021 EB-1 archive rows explicit', () => {
    const mar2021 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Mar 2021');
    const apr2021 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Apr 2021');
    const sep2021 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Sep 2021');
    const oct2021 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Oct 2021');
    const sep2022 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Sep 2022');

    expect(mar2021?.eb1_dof).toBe('2021-03-01');
    expect(apr2021?.eb1_fad).toBe('2021-04-01');
    expect(apr2021?.eb1_dof).toBe('2021-04-01');
    expect(sep2021?.eb1_fad).toBe('2021-09-01');
    expect(sep2021?.eb1_dof).toBe('2021-09-01');
    expect(oct2021?.eb1_fad).toBe('2021-10-01');
    expect(oct2021?.eb1_dof).toBe('2021-10-01');
    expect(sep2022?.eb1_fad).toBe('2022-09-01');
    expect(sep2022?.eb1_dof).toBe('2022-09-01');
  });

  it('keeps corrected historical spot-check rows aligned with official DOS bulletins', () => {
    const apr2023 = HISTORICAL_BULLETINS.find(row => row.month === 'Apr 2023');
    const jul2023 = HISTORICAL_BULLETINS.find(row => row.month === 'Jul 2023');
    const jun2022 = ARCHIVED_BULLETIN_TRACKER_HISTORY.find(row => row.month === 'Jun 2022');

    expect(apr2023?.eb1_fad).toBe('2022-02-01');
    expect(jul2023?.eb1_fad).toBe('2022-02-01');
    expect(jun2022?.eb2_fad).toBe('2014-09-01');
  });

  it('keeps every stored cutoff string in ISO date format', () => {
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    BULLETIN_TRACKER_HISTORY.forEach(row => {
      DATE_KEYS.forEach(key => {
        expect(row[key]).toMatch(isoDatePattern);
      });
    });
  });
});
