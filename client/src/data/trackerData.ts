export type TrackerCategoryKey = 'EB1' | 'EB2' | 'EB3';

export type HistoricalBulletinRow = {
  month: string;
  eb1_fad: string;
  eb1_dof: string;
  eb2_fad: string;
  eb2_dof: string;
  eb3_fad: string;
  eb3_dof: string;
};

// April 2026 Visa Bulletin data (most recent)
export const CURRENT_BULLETIN = {
  month: 'April 2026',
  eb1: { fad: '2023-04-01', dof: '2023-12-01' },
  eb2: { fad: '2014-07-15', dof: '2015-01-15' },
  eb3: { fad: '2013-11-15', dof: '2015-01-15' },
};

// ─── DEMAND DENSITY DATA (HYBRID: I-485 INVENTORY + I-140 APPROVALS) ─────────
//
// Two data sources, used in a hybrid model:
//
// 1. I-485 Pending Inventory (USCIS, as of October 2, 2025)
//    Source: eb_inventory_october_2025.xlsx from uscis.gov
//    The actual queue depth at each priority date year — the direct measure of
//    how many applicants the FAD must clear through. Only available for PD years
//    where applicants have been able to file (i.e., PD before the DoF cutoff).
//
// 2. I-140 Approval Counts (USCIS Form I-140 Performance Data, FY2025 Q3)
//    Source: Published Oct 8, 2025 | Query ref: CLAIMS3/ELIS, queried 7/2025
//    Proxy for future demand in PD years beyond I-485 coverage. Not a direct
//    measure of queue depth (approval year ≠ PD year), but the best available
//    signal for years where no one has been able to file I-485 yet.
//
// Hybrid logic: Use I-485 inventory where it exists (most accurate for near-term
// PD years). Fall back to I-140 approvals for years beyond inventory coverage.

export const I485_INDIA_PENDING: Record<TrackerCategoryKey, Record<number, number>> = {
  EB1: {
    2016: 563,
    2017: 574,
    2018: 552,
    2019: 531,
    2020: 526,
    2021: 616,
    2022: 10953,
  },
  EB2: { 2010: 25, 2011: 123, 2012: 553, 2013: 10287, 2014: 17092 },
  EB3: { 2012: 214, 2013: 4364, 2014: 10346 },
};

export const I140_INDIA_APPROVALS: Record<TrackerCategoryKey, Record<number, number>> = {
  EB1: {
    2014: 6371,
    2015: 6127,
    2016: 7737,
    2017: 8496,
    2018: 7575,
    2019: 6879,
    2020: 6194,
    2021: 7243,
    2022: 8123,
    2023: 10995,
    2024: 8780,
  },
  EB2: {
    2014: 25010,
    2015: 31546,
    2016: 47462,
    2017: 40898,
    2018: 39047,
    2019: 43306,
    2020: 34976,
    2021: 37586,
    2022: 45299,
    2023: 39269,
    2024: 38842,
  },
  EB3: {
    2014: 3827,
    2015: 6251,
    2016: 9946,
    2017: 8610,
    2018: 8064,
    2019: 11182,
    2020: 9041,
    2021: 48036,
    2022: 16574,
    2023: 12549,
    2024: 10113,
  },
};

// EB Category metadata — order determines tab display order (EB-1, EB-2, EB-3)
export const EB_CATEGORIES = {
  EB1: {
    label: 'EB-1',
    name: 'Priority Workers / Multinational Managers',
    currentFAD: CURRENT_BULLETIN.eb1.fad,
    currentDoF: CURRENT_BULLETIN.eb1.dof,
    rates: {
      optimistic: 2.5,
      base: 1.5,
      conservative: 0.8,
      pessimistic: 0.4,
    },
    dofLeadMonths: 8,
    gcLagMonths: 12,
    annualVisas: 2500,
    density: { category: 'EB1' as const },
    notes: 'EB-1 India has ~14.3k pending I-485s. Current FAD is Apr 2023. Massive spike at PD-2022 (10,953 cases).',
  },
  EB2: {
    label: 'EB-2',
    name: 'Advanced Degree / Exceptional Ability',
    currentFAD: CURRENT_BULLETIN.eb2.fad,
    currentDoF: CURRENT_BULLETIN.eb2.dof,
    rates: {
      optimistic: 1.625,
      base: 0.975,
      conservative: 0.45,
      pessimistic: 0.275,
    },
    dofLeadMonths: 6,
    gcLagMonths: 15,
    annualVisas: 2850,
    density: { category: 'EB2' as const },
    notes: 'EB-2 India has ~28k pending I-485s. 97% in PD-2013/2014. FY2026 acceleration driven by 75-country ban spillover.',
  },
  EB3: {
    label: 'EB-3',
    name: 'Skilled Workers / Professionals',
    currentFAD: CURRENT_BULLETIN.eb3.fad,
    currentDoF: CURRENT_BULLETIN.eb3.dof,
    rates: {
      optimistic: 1.2,
      base: 0.7,
      conservative: 0.35,
      pessimistic: 0.2,
    },
    dofLeadMonths: 6,
    gcLagMonths: 18,
    annualVisas: 3000,
    density: { category: 'EB3' as const },
    notes: 'EB-3 India has ~14.9k pending I-485s. 98% concentrated in PD-2013/2014.',
  },
};

export const SCENARIOS = {
  optimistic: {
    label: 'Optimistic',
    probability: '15–20%',
    color: '#10b981',
    tailwindColor: 'emerald',
    spillover: '60k+ extra EB visas (FY2027 materializes at scale)',
    description: 'Large FY2027 spillover materializes. 75-country ban persists through Sept 2026, generating 60k+ extra EB visas. Historical parallel: COVID FY2021–22 created 120k+ extra EB visas.',
  },
  base: {
    label: 'Base Case',
    probability: '40%',
    color: '#3b82f6',
    tailwindColor: 'blue',
    spillover: '30–40k extra EB visas (moderate spillover)',
    description: 'Moderate spillover with some retrogression. Ban generates 30–40k extra visas but offset by surge in I-485 filings and mid-year retrogression.',
  },
  conservative: {
    label: 'Conservative',
    probability: '30%',
    color: '#f59e0b',
    tailwindColor: 'amber',
    spillover: 'No spillover, reversion to pre-FY2026 pace',
    description: 'Ban reversed by courts, no spillover materializes. Movement reverts to pre-FY2026 pace of 2–4 months/year.',
  },
  pessimistic: {
    label: 'Pessimistic',
    probability: '10–15%',
    color: '#ef4444',
    tailwindColor: 'red',
    spillover: 'Stagnation / retrogression',
    description: 'Ban reversed, retrogression occurs, pace drops below pre-FY2026 levels. At FY2024 pace (3.5 months/year), Aug 2016 would not clear until ~2033.',
  },
};

// Forecast-model history (most recent first)
// ALL values verified against official travel.state.gov bulletins (Oct 2022 – Apr 2026)
// EB-1 India "C" (Current) in Oct–Dec 2022 represented using bulletin month date.
export const HISTORICAL_BULLETINS: HistoricalBulletinRow[] = [
  { month: 'Apr 2026', eb1_fad: '2023-04-01', eb1_dof: '2023-12-01', eb2_fad: '2014-07-15', eb2_dof: '2015-01-15', eb3_fad: '2013-11-15', eb3_dof: '2015-01-15' },
  { month: 'Mar 2026', eb1_fad: '2023-03-01', eb1_dof: '2023-12-01', eb2_fad: '2013-09-15', eb2_dof: '2014-11-01', eb3_fad: '2013-11-15', eb3_dof: '2014-08-15' },
  { month: 'Feb 2026', eb1_fad: '2023-02-01', eb1_dof: '2023-08-01', eb2_fad: '2013-07-15', eb2_dof: '2013-12-01', eb3_fad: '2013-11-15', eb3_dof: '2014-08-15' },
  { month: 'Jan 2026', eb1_fad: '2023-02-01', eb1_dof: '2023-08-01', eb2_fad: '2013-07-15', eb2_dof: '2013-12-01', eb3_fad: '2013-11-15', eb3_dof: '2014-08-15' },
  { month: 'Dec 2025', eb1_fad: '2022-03-15', eb1_dof: '2023-04-15', eb2_fad: '2013-05-15', eb2_dof: '2013-12-01', eb3_fad: '2013-09-22', eb3_dof: '2014-08-15' },
  { month: 'Nov 2025', eb1_fad: '2022-02-15', eb1_dof: '2023-04-15', eb2_fad: '2013-04-01', eb2_dof: '2013-12-01', eb3_fad: '2013-08-22', eb3_dof: '2014-08-15' },
  { month: 'Oct 2025', eb1_fad: '2022-02-15', eb1_dof: '2023-04-15', eb2_fad: '2013-04-01', eb2_dof: '2013-12-01', eb3_fad: '2013-08-22', eb3_dof: '2014-08-15' },
  { month: 'Sep 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-05-22', eb3_dof: '2013-06-08' },
  { month: 'Aug 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-05-22', eb3_dof: '2013-06-08' },
  { month: 'Jul 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-04-22', eb3_dof: '2013-06-08' },
  { month: 'Jun 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-04-15', eb3_dof: '2013-06-08' },
  { month: 'May 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-04-15', eb3_dof: '2013-06-08' },
  { month: 'Apr 2025', eb1_fad: '2022-02-15', eb1_dof: '2022-04-15', eb2_fad: '2013-01-01', eb2_dof: '2013-02-01', eb3_fad: '2013-04-01', eb3_dof: '2013-06-08' },
  { month: 'Mar 2025', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-12-01', eb2_dof: '2013-01-01', eb3_fad: '2013-02-01', eb3_dof: '2013-06-08' },
  { month: 'Feb 2025', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-10-15', eb2_dof: '2013-01-01', eb3_fad: '2012-12-15', eb3_dof: '2013-06-08' },
  { month: 'Jan 2025', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-10-01', eb2_dof: '2013-01-01', eb3_fad: '2012-12-01', eb3_dof: '2013-06-08' },
  { month: 'Dec 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-08-01', eb2_dof: '2013-01-01', eb3_fad: '2012-11-08', eb3_dof: '2013-06-08' },
  { month: 'Nov 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-07-15', eb2_dof: '2013-01-01', eb3_fad: '2012-11-01', eb3_dof: '2013-06-08' },
  { month: 'Oct 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-04-15', eb2_fad: '2012-07-15', eb2_dof: '2013-01-01', eb3_fad: '2012-11-01', eb3_dof: '2013-06-08' },
  { month: 'Sep 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-02-08', eb2_fad: '2012-07-15', eb2_dof: '2012-07-22', eb3_fad: '2012-10-22', eb3_dof: '2012-11-01' },
  { month: 'Aug 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-02-08', eb2_fad: '2012-07-15', eb2_dof: '2012-07-22', eb3_fad: '2012-10-22', eb3_dof: '2012-11-01' },
  { month: 'Jul 2024', eb1_fad: '2022-02-01', eb1_dof: '2022-02-08', eb2_fad: '2012-06-15', eb2_dof: '2012-06-22', eb3_fad: '2012-09-22', eb3_dof: '2012-10-01' },
  { month: 'Jun 2024', eb1_fad: '2021-03-01', eb1_dof: '2021-04-01', eb2_fad: '2012-04-15', eb2_dof: '2012-05-15', eb3_fad: '2012-08-22', eb3_dof: '2012-09-15' },
  { month: 'May 2024', eb1_fad: '2021-03-01', eb1_dof: '2021-04-01', eb2_fad: '2012-04-15', eb2_dof: '2012-05-15', eb3_fad: '2012-08-15', eb3_dof: '2012-09-15' },
  { month: 'Apr 2024', eb1_fad: '2021-03-01', eb1_dof: '2021-04-01', eb2_fad: '2012-04-15', eb2_dof: '2012-05-15', eb3_fad: '2012-08-15', eb3_dof: '2012-09-15' },
  { month: 'Mar 2024', eb1_fad: '2020-10-01', eb1_dof: '2021-01-01', eb2_fad: '2012-03-01', eb2_dof: '2012-05-15', eb3_fad: '2012-07-01', eb3_dof: '2012-08-01' },
  { month: 'Feb 2024', eb1_fad: '2020-09-01', eb1_dof: '2021-01-01', eb2_fad: '2012-03-01', eb2_dof: '2012-05-15', eb3_fad: '2012-07-01', eb3_dof: '2012-08-01' },
  { month: 'Jan 2024', eb1_fad: '2020-09-01', eb1_dof: '2021-01-01', eb2_fad: '2012-03-01', eb2_dof: '2012-05-15', eb3_fad: '2012-06-01', eb3_dof: '2012-08-01' },
  { month: 'Dec 2023', eb1_fad: '2017-01-01', eb1_dof: '2019-07-01', eb2_fad: '2012-01-01', eb2_dof: '2012-05-15', eb3_fad: '2012-05-01', eb3_dof: '2012-08-01' },
  { month: 'Nov 2023', eb1_fad: '2017-01-01', eb1_dof: '2019-07-01', eb2_fad: '2012-01-01', eb2_dof: '2012-05-15', eb3_fad: '2012-05-01', eb3_dof: '2012-08-01' },
  { month: 'Oct 2023', eb1_fad: '2017-01-01', eb1_dof: '2019-07-01', eb2_fad: '2012-01-01', eb2_dof: '2012-05-15', eb3_fad: '2012-05-01', eb3_dof: '2012-08-01' },
  { month: 'Sep 2023', eb1_fad: '2012-01-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2009-01-01', eb3_dof: '2012-08-01' },
  { month: 'Aug 2023', eb1_fad: '2012-01-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2009-01-01', eb3_dof: '2012-08-01' },
  { month: 'Jul 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2009-01-01', eb3_dof: '2012-08-01' },
  { month: 'Jun 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'May 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Apr 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-01-01', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Mar 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-10-08', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Feb 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-10-08', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Jan 2023', eb1_fad: '2022-02-01', eb1_dof: '2022-06-01', eb2_fad: '2011-10-08', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Dec 2022', eb1_fad: '2022-12-01', eb1_dof: '2022-12-01', eb2_fad: '2011-10-08', eb2_dof: '2012-05-01', eb3_fad: '2012-06-15', eb3_dof: '2012-08-01' },
  { month: 'Nov 2022', eb1_fad: '2022-11-01', eb1_dof: '2022-11-01', eb2_fad: '2012-04-01', eb2_dof: '2012-05-01', eb3_fad: '2012-04-01', eb3_dof: '2012-07-01' },
  { month: 'Oct 2022', eb1_fad: '2022-10-01', eb1_dof: '2022-10-01', eb2_fad: '2012-04-01', eb2_dof: '2012-05-01', eb3_fad: '2012-04-01', eb3_dof: '2012-07-01' },
];

// Bulletin Tracker archive-only history (most recent first)
// Verified against official travel.state.gov bulletins for FY2022, FY2021, and FY2020.
// EB-1 India "C" (Current) is represented using the bulletin month date.
export const ARCHIVED_BULLETIN_TRACKER_HISTORY: HistoricalBulletinRow[] = [
  { month: 'Sep 2022', eb1_fad: '2022-09-01', eb1_dof: '2022-09-01', eb2_fad: '2014-12-01', eb2_dof: '2015-01-01', eb3_fad: '2012-02-15', eb3_dof: '2012-02-22' },
  { month: 'Aug 2022', eb1_fad: '2022-08-01', eb1_dof: '2022-08-01', eb2_fad: '2014-12-01', eb2_dof: '2015-01-01', eb3_fad: '2012-02-15', eb3_dof: '2012-02-22' },
  { month: 'Jul 2022', eb1_fad: '2022-07-01', eb1_dof: '2022-07-01', eb2_fad: '2014-12-01', eb2_dof: '2015-01-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Jun 2022', eb1_fad: '2022-06-01', eb1_dof: '2022-06-01', eb2_fad: '2014-09-01', eb2_dof: '2014-12-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'May 2022', eb1_fad: '2022-05-01', eb1_dof: '2022-05-01', eb2_fad: '2013-09-01', eb2_dof: '2014-12-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Apr 2022', eb1_fad: '2022-04-01', eb1_dof: '2022-04-01', eb2_fad: '2013-07-08', eb2_dof: '2014-09-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Mar 2022', eb1_fad: '2022-03-01', eb1_dof: '2022-03-01', eb2_fad: '2013-05-01', eb2_dof: '2013-09-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Feb 2022', eb1_fad: '2022-02-01', eb1_dof: '2022-02-01', eb2_fad: '2013-01-01', eb2_dof: '2013-09-01', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Jan 2022', eb1_fad: '2022-01-01', eb1_dof: '2022-01-01', eb2_fad: '2012-07-08', eb2_dof: '2013-07-08', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Dec 2021', eb1_fad: '2021-12-01', eb1_dof: '2021-12-01', eb2_fad: '2012-05-01', eb2_dof: '2013-07-08', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Nov 2021', eb1_fad: '2021-11-01', eb1_dof: '2021-11-01', eb2_fad: '2011-12-01', eb2_dof: '2013-01-08', eb3_fad: '2012-01-15', eb3_dof: '2012-01-22' },
  { month: 'Oct 2021', eb1_fad: '2021-10-01', eb1_dof: '2021-10-01', eb2_fad: '2011-09-01', eb2_dof: '2012-07-08', eb3_fad: '2014-01-01', eb3_dof: '2014-01-08' },
  { month: 'Sep 2021', eb1_fad: '2021-09-01', eb1_dof: '2021-09-01', eb2_fad: '2011-09-01', eb2_dof: '2011-12-01', eb3_fad: '2014-01-01', eb3_dof: '2014-03-01' },
  { month: 'Aug 2021', eb1_fad: '2021-08-01', eb1_dof: '2021-08-01', eb2_fad: '2011-06-01', eb2_dof: '2011-12-01', eb3_fad: '2013-07-01', eb3_dof: '2014-02-01' },
  { month: 'Jul 2021', eb1_fad: '2021-07-01', eb1_dof: '2021-07-01', eb2_fad: '2011-06-01', eb2_dof: '2011-12-01', eb3_fad: '2013-01-01', eb3_dof: '2014-02-01' },
  { month: 'Jun 2021', eb1_fad: '2021-06-01', eb1_dof: '2021-06-01', eb2_fad: '2010-12-01', eb2_dof: '2011-08-01', eb3_fad: '2011-11-01', eb3_dof: '2014-01-01' },
  { month: 'May 2021', eb1_fad: '2021-05-01', eb1_dof: '2021-05-01', eb2_fad: '2010-08-01', eb2_dof: '2011-05-15', eb3_fad: '2011-02-01', eb3_dof: '2014-01-01' },
  { month: 'Apr 2021', eb1_fad: '2021-04-01', eb1_dof: '2021-04-01', eb2_fad: '2010-05-01', eb2_dof: '2011-05-15', eb3_fad: '2010-09-01', eb3_dof: '2014-01-01' },
  { month: 'Mar 2021', eb1_fad: '2020-08-01', eb1_dof: '2021-03-01', eb2_fad: '2010-01-15', eb2_dof: '2011-05-15', eb3_fad: '2010-07-01', eb3_dof: '2014-01-01' },
  { month: 'Feb 2021', eb1_fad: '2020-01-01', eb1_dof: '2020-11-01', eb2_fad: '2009-10-12', eb2_dof: '2011-05-15', eb3_fad: '2010-04-01', eb3_dof: '2014-01-01' },
  { month: 'Jan 2021', eb1_fad: '2019-09-01', eb1_dof: '2020-11-01', eb2_fad: '2009-10-08', eb2_dof: '2011-05-15', eb3_fad: '2010-03-22', eb3_dof: '2014-01-01' },
  { month: 'Dec 2020', eb1_fad: '2019-04-01', eb1_dof: '2020-11-01', eb2_fad: '2009-10-01', eb2_dof: '2011-05-15', eb3_fad: '2010-03-15', eb3_dof: '2014-01-01' },
  { month: 'Nov 2020', eb1_fad: '2018-12-01', eb1_dof: '2020-09-01', eb2_fad: '2009-09-22', eb2_dof: '2011-05-15', eb3_fad: '2010-03-01', eb3_dof: '2015-01-01' },
  { month: 'Oct 2020', eb1_fad: '2018-06-01', eb1_dof: '2020-09-01', eb2_fad: '2009-09-01', eb2_dof: '2011-05-15', eb3_fad: '2010-01-15', eb3_dof: '2015-01-01' },
  { month: 'Sep 2020', eb1_fad: '2018-03-01', eb1_dof: '2018-07-01', eb2_fad: '2009-07-08', eb2_dof: '2009-08-15', eb3_fad: '2009-10-01', eb3_dof: '2010-02-01' },
  { month: 'Aug 2020', eb1_fad: '2018-02-08', eb1_dof: '2018-07-01', eb2_fad: '2009-07-08', eb2_dof: '2009-08-15', eb3_fad: '2009-10-01', eb3_dof: '2010-02-01' },
  { month: 'Jul 2020', eb1_fad: '2017-05-08', eb1_dof: '2017-08-01', eb2_fad: '2009-07-08', eb2_dof: '2009-08-15', eb3_fad: '2009-06-01', eb3_dof: '2010-02-01' },
  { month: 'Jun 2020', eb1_fad: '2016-06-08', eb1_dof: '2017-03-15', eb2_fad: '2009-06-12', eb2_dof: '2009-07-01', eb3_fad: '2009-04-01', eb3_dof: '2010-02-01' },
  { month: 'May 2020', eb1_fad: '2015-08-01', eb1_dof: '2017-03-15', eb2_fad: '2009-06-02', eb2_dof: '2009-07-01', eb3_fad: '2009-03-01', eb3_dof: '2010-02-01' },
  { month: 'Apr 2020', eb1_fad: '2015-05-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-25', eb2_dof: '2009-07-01', eb3_fad: '2009-01-22', eb3_dof: '2010-02-01' },
  { month: 'Mar 2020', eb1_fad: '2015-03-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-22', eb2_dof: '2009-07-01', eb3_fad: '2009-01-15', eb3_dof: '2010-02-01' },
  { month: 'Feb 2020', eb1_fad: '2015-01-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-19', eb2_dof: '2009-07-01', eb3_fad: '2009-01-08', eb3_dof: '2010-02-01' },
  { month: 'Jan 2020', eb1_fad: '2015-01-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-18', eb2_dof: '2009-07-01', eb3_fad: '2009-01-01', eb3_dof: '2010-02-01' },
  { month: 'Dec 2019', eb1_fad: '2015-01-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-15', eb2_dof: '2009-07-01', eb3_fad: '2009-01-01', eb3_dof: '2010-02-01' },
  { month: 'Nov 2019', eb1_fad: '2015-01-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-13', eb2_dof: '2009-07-01', eb3_fad: '2009-01-01', eb3_dof: '2010-02-01' },
  { month: 'Oct 2019', eb1_fad: '2015-01-01', eb1_dof: '2017-03-15', eb2_fad: '2009-05-12', eb2_dof: '2009-07-01', eb3_fad: '2009-01-01', eb3_dof: '2010-02-01' },
];

export const BULLETIN_TRACKER_HISTORY: HistoricalBulletinRow[] = [...HISTORICAL_BULLETINS, ...ARCHIVED_BULLETIN_TRACKER_HISTORY];
