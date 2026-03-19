/**
 * EB Priority Date Tracker
 *
 * DESIGN: Civic Tech Policy Dashboard
 * - Slate blue primary, teal for advancement, amber for caution, red for retrogression
 * - DM Sans + DM Mono typography
 * - Data-forward, trustworthy, professional
 *
 * ALGORITHM (v7 — Density + Seasonality Month-by-Month Model):
 *
 * Builds on the v6 density-weighted model with three enhancements:
 *
 * 1. MONTH-BY-MONTH PROJECTION: Instead of one-shot gap conversion, projects
 *    forward one calendar month at a time, applying density and seasonal
 *    adjustments at each step. This naturally handles transitions between
 *    PD-years with different demand densities.
 *
 * 2. FY-MONTH SEASONALITY: Derives seasonal factors from historical bulletin
 *    movement data. Each FY-month (Oct=1..Sep=12) gets a factor representing
 *    its historical median advance relative to the overall median.
 *    E.g., Oct (new FY) may show retrogression while Aug-Sep show surges.
 *
 * 3. INDEPENDENT DOF MODEL: Instead of fixed dofLeadMonths, computes the
 *    rolling median of the historical DoF-FAD gap from bulletin data.
 *
 * 4. BACKTESTING: Rolling-window backtest computes 6-month-ahead prediction
 *    error (MAE) using only data available at each historical point.
 *
 * For each projected calendar month:
 *   seasonFactor    = historical median advance for that FY-month / overall median
 *   densityFactor   = sqrt(yearApprovals / refApprovals) for PD-year cursor
 *   monthAdvance    = fadAdvanceRate × seasonFactor / densityFactor
 *   calendarMonths += 1 (or pro-rated for last partial month)
 *
 *   estimatedDate = TODAY + sum(calendarMonths)
 *
 * Density data sources:
 *   Primary: USCIS I-485 Pending Inventory (as of Oct 2, 2025) — actual queue depth
 *   Fallback: USCIS I-140 Performance Data (FY2025 Q3) — proxy for PD years beyond inventory
 *
 * Scenario rates (calibrated against PD-2012 density era for EB-2/EB-3):
 *   Optimistic  : 1.625 PD-mo/month (large FY2027 spillover 60k+)
 *   Base Case   : 0.975 PD-mo/month (moderate spillover 30–40k)
 *   Conservative: 0.45  PD-mo/month (no spillover, reversion to pre-FY2026 pace)
 *   Pessimistic : 0.275 PD-mo/month (ban reversed, stagnation returns)
 *
 * DoF leads FAD by ~6 months historically.
 * GC receipt follows FAD by ~12–18 months.
 *
 * Sources:
 *   - DOS Visa Bulletins Oct 2022–Apr 2026 (travel.state.gov)
 *   - USCIS I-485 Pending Inventory, Oct 2025 (uscis.gov)
 *   - USCIS I-140 Performance Data, FY2025 Q3 (uscis.gov)
 *   - Cato Institute immigration policy analysis
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, ReferenceDot, Area, ReferenceArea } from 'recharts';
import { TrendingUp, Calendar, Clock, Download, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import PriorityDatePicker from '@/components/PriorityDatePicker';
import { useIsMobile } from '@/hooks/useMobile';
import { jsPDF } from 'jspdf';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TODAY = new Date(); // Always the current date — do NOT hardcode this

// April 2026 Visa Bulletin data (most recent)
const CURRENT_BULLETIN = {
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

const I485_INDIA_PENDING: Record<string, Record<number, number>> = {
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

const I140_INDIA_APPROVALS: Record<string, Record<number, number>> = {
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

/**
 * Hybrid density lookup: returns a normalized demand signal for the given
 * category + PD year. Uses I-485 inventory where available, otherwise scales
 * I-140 approvals to I-485 magnitude at their overlap year.
 *
 * The two data sources are on very different scales (I-485 = remaining pending
 * cases, I-140 = annual approvals). To blend them, we compute a scale factor
 * at the overlap year (last I-485 year that also has I-140 data) and apply it
 * to all I-140 values. This produces a single continuous demand curve.
 */
function getHybridDensity(category: string, pdYear: number): number | undefined {
  const i485 = I485_INDIA_PENDING[category]?.[pdYear];
  if (i485 !== undefined && i485 > 0) return i485;

  const i140 = I140_INDIA_APPROVALS[category]?.[pdYear];
  if (i140 === undefined) return undefined;

  // Scale I-140 values to I-485 magnitude using overlap year
  // For EB-2: overlap at 2014 → I-485=17,092 vs I-140=25,010 → scale=0.683
  // For EB-3: overlap at 2014 → I-485=10,346 vs I-140=3,827 → scale=2.70
  const i485Data = I485_INDIA_PENDING[category] ?? {};
  const i140Data = I140_INDIA_APPROVALS[category] ?? {};
  const overlapYears = Object.keys(i485Data)
    .map(Number)
    .filter(y => i485Data[y] > 0 && i140Data[y] !== undefined);

  if (overlapYears.length === 0) return i140; // no overlap, use raw

  // Use the last overlap year (closest to the I-140-only territory)
  const overlapYear = Math.max(...overlapYears);
  const scaleFactor = i485Data[overlapYear] / i140Data[overlapYear];
  return i140 * scaleFactor;
}

/**
 * Compute weighted mean of hybrid density across all available years for a
 * category. Used as the reference value so density ratios reflect relative
 * variation, not artifacts of depleted residuals vs peak years.
 */
function computeMeanDensity(category: string): number {
  // Collect all years from both sources
  const allYears = new Set<number>();
  for (const y of Object.keys(I485_INDIA_PENDING[category] ?? {})) allYears.add(Number(y));
  for (const y of Object.keys(I140_INDIA_APPROVALS[category] ?? {})) allYears.add(Number(y));

  let sum = 0,
    count = 0;
  Array.from(allYears).forEach(y => {
    const d = getHybridDensity(category, y);
    if (d && d > 0) {
      sum += d;
      count++;
    }
  });
  return count > 0 ? sum / count : 1;
}

// EB Category metadata — order determines tab display order (EB-1, EB-2, EB-3)
const EB_CATEGORIES = {
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
    pendingInventory: 8000,
    annualVisas: 2500,
    // Density: hybrid I-485 (2016–2022) + I-140 (2023+). Ref = weighted mean.
    density: { category: 'EB1' },
    notes: 'EB-1 India has ~15.4k pending I-485s. Current FAD is Apr 2023. Massive spike at PD-2022 (10,953 cases).',
  },
  EB2: {
    label: 'EB-2',
    name: 'Advanced Degree / Exceptional Ability',
    currentFAD: CURRENT_BULLETIN.eb2.fad,
    currentDoF: CURRENT_BULLETIN.eb2.dof,
    // FAD advance rates per scenario (PD-months per calendar month)
    // Calibrated against the PD-2012 density era (553 pending I-485s).
    rates: {
      optimistic: 1.625, // midpoint of 1.5–1.75 (large FY2027 spillover 60k+)
      base: 0.975, // midpoint of 0.9–1.05 (moderate spillover 30–40k)
      conservative: 0.45, // midpoint of 0.4–0.5  (no spillover, slow pace)
      pessimistic: 0.275, // midpoint of 0.25–0.3 (ban reversed, stagnation)
    },
    dofLeadMonths: 6, // fallback; independent DoF model used when data available
    gcLagMonths: 15, // GC receipt ~12–18 months after FAD (midpoint)
    pendingInventory: 28080, // USCIS Oct 2025 I-485 inventory total
    annualVisas: 2850, // ~2,800–2,900 baseline under 7% per-country cap (INA §202)
    // Density: hybrid I-485 (2010–2014) + I-140 (2015+, scaled to I-485 magnitude).
    // Ref = weighted mean across all years. Near-term: I-485 shows 10k–17k at PD-2013/2014.
    // Long-term: I-140 scaled via overlap at 2014 (I-485=17,092 / I-140=25,010 → 0.68×).
    density: { category: 'EB2' },
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
    pendingInventory: 55000,
    annualVisas: 3000,
    // Density: hybrid I-485 (2012–2014) + I-140 (2015+, scaled to I-485 magnitude).
    // Ref = weighted mean across all years.
    density: { category: 'EB3' },
    notes: 'EB-3 India has ~15k pending I-485s. 98% in PD-2013/2014.',
  },
};

// Scenario definitions
const SCENARIOS = {
  optimistic: {
    label: 'Optimistic',
    probability: '15–20%',
    color: '#10b981',
    tailwindColor: 'emerald',
    spillover: '60k+ extra EB visas (FY2027 materializes at scale)',
    description: 'Large FY2027 spillover materializes. 75-country ban persists through Sept 2026, generating 60k+ extra EB visas. Historical parallel: COVID FY2021–22 created 120k+ extra EB visas.',
    dofRange: 'Late 2026 – Early 2027',
    fadRange: 'Late 2027 – 2028',
    gcRange: '2028 – 2029',
  },
  base: {
    label: 'Base Case',
    probability: '40%',
    color: '#3b82f6',
    tailwindColor: 'blue',
    spillover: '30–40k extra EB visas (moderate spillover)',
    description: 'Moderate spillover with some retrogression. Ban generates 30–40k extra visas but offset by surge in I-485 filings and mid-year retrogression.',
    dofRange: 'Mid–Late 2027',
    fadRange: '2028 – 2029',
    gcRange: '2029 – 2031',
  },
  conservative: {
    label: 'Conservative',
    probability: '30%',
    color: '#f59e0b',
    tailwindColor: 'amber',
    spillover: 'No spillover, reversion to pre-FY2026 pace',
    description: 'Ban reversed by courts, no spillover materializes. Movement reverts to pre-FY2026 pace of 2–4 months/year.',
    dofRange: '2028 – 2029',
    fadRange: '2030 – 2033',
    gcRange: '2031 – 2035',
  },
  pessimistic: {
    label: 'Pessimistic',
    probability: '10–15%',
    color: '#ef4444',
    tailwindColor: 'red',
    spillover: 'Stagnation / retrogression',
    description: 'Ban reversed, retrogression occurs, pace drops below pre-FY2026 levels. At FY2024 pace (3.5 months/year), Aug 2016 would not clear until ~2033.',
    dofRange: '2030 – 2033',
    fadRange: '2032 – 2036',
    gcRange: '2033 – 2038',
  },
};

// Historical visa bulletins (most recent first)
// ALL values verified against official travel.state.gov bulletins (Oct 2022 – Apr 2026)
// EB-1 India "C" (Current) in Oct–Dec 2022 represented using bulletin month date.
const HISTORICAL_BULLETINS = [
  // Apr 2026: EB-2 FAD +10mo jump. Verified from official bulletin.
  {
    month: 'Apr 2026',
    eb1_fad: '2023-04-01',
    eb1_dof: '2023-12-01',
    eb2_fad: '2014-07-15',
    eb2_dof: '2015-01-15',
    eb3_fad: '2013-11-15',
    eb3_dof: '2015-01-15',
  },
  // Mar 2026: Verified from travel.state.gov. EB-2 FAD=Sep 15, 2013 (not 2014)
  {
    month: 'Mar 2026',
    eb1_fad: '2023-03-01',
    eb1_dof: '2023-12-01',
    eb2_fad: '2013-09-15',
    eb2_dof: '2014-11-01',
    eb3_fad: '2013-11-15',
    eb3_dof: '2014-08-15',
  },
  // Feb 2026: Verified from travel.state.gov. EB-2 FAD=Jul 15, 2013 (not 2014)
  {
    month: 'Feb 2026',
    eb1_fad: '2023-02-01',
    eb1_dof: '2023-08-01',
    eb2_fad: '2013-07-15',
    eb2_dof: '2013-12-01',
    eb3_fad: '2013-11-15',
    eb3_dof: '2014-08-15',
  },
  // Jan 2026: Verified from travel.state.gov.
  {
    month: 'Jan 2026',
    eb1_fad: '2023-02-01',
    eb1_dof: '2023-08-01',
    eb2_fad: '2013-07-15',
    eb2_dof: '2013-12-01',
    eb3_fad: '2013-11-15',
    eb3_dof: '2014-08-15',
  },
  // Dec 2025: Verified from travel.state.gov.
  {
    month: 'Dec 2025',
    eb1_fad: '2022-03-15',
    eb1_dof: '2023-04-15',
    eb2_fad: '2013-05-15',
    eb2_dof: '2013-12-01',
    eb3_fad: '2013-09-22',
    eb3_dof: '2014-08-15',
  },
  // Nov 2025: Verified from travel.state.gov.
  {
    month: 'Nov 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2023-04-15',
    eb2_fad: '2013-04-01',
    eb2_dof: '2013-12-01',
    eb3_fad: '2013-08-22',
    eb3_dof: '2014-08-15',
  },
  // Oct 2025: Verified from travel.state.gov. EB-2 FAD=Apr 1, 2013 (not Jun 2013)
  {
    month: 'Oct 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2023-04-15',
    eb2_fad: '2013-04-01',
    eb2_dof: '2013-12-01',
    eb3_fad: '2013-08-22',
    eb3_dof: '2014-08-15',
  },
  // Sep 2025: Verified from travel.state.gov. DoF jumped from Feb 2013 to Dec 2013 in Oct.
  {
    month: 'Sep 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-05-22',
    eb3_dof: '2013-06-08',
  },
  // Aug 2025: Verified from travel.state.gov.
  {
    month: 'Aug 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-05-22',
    eb3_dof: '2013-06-08',
  },
  // Jul 2025: Verified from travel.state.gov.
  {
    month: 'Jul 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-04-22',
    eb3_dof: '2013-06-08',
  },
  // Jun 2025: Verified from travel.state.gov.
  {
    month: 'Jun 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-04-15',
    eb3_dof: '2013-06-08',
  },
  // May 2025: Verified from travel.state.gov.
  {
    month: 'May 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-04-15',
    eb3_dof: '2013-06-08',
  },
  // Apr 2025: Verified from travel.state.gov.
  {
    month: 'Apr 2025',
    eb1_fad: '2022-02-15',
    eb1_dof: '2022-04-15',
    eb2_fad: '2013-01-01',
    eb2_dof: '2013-02-01',
    eb3_fad: '2013-04-01',
    eb3_dof: '2013-06-08',
  },
  // Mar 2025: Verified from travel.state.gov.
  {
    month: 'Mar 2025',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-12-01',
    eb2_dof: '2013-01-01',
    eb3_fad: '2013-02-01',
    eb3_dof: '2013-06-08',
  },
  // Feb 2025: Verified from travel.state.gov.
  {
    month: 'Feb 2025',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-10-15',
    eb2_dof: '2013-01-01',
    eb3_fad: '2012-12-15',
    eb3_dof: '2013-06-08',
  },
  // Jan 2025: Verified from travel.state.gov.
  {
    month: 'Jan 2025',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-10-01',
    eb2_dof: '2013-01-01',
    eb3_fad: '2012-12-01',
    eb3_dof: '2013-06-08',
  },
  // Dec 2024: Verified from travel.state.gov.
  {
    month: 'Dec 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-08-01',
    eb2_dof: '2013-01-01',
    eb3_fad: '2012-11-08',
    eb3_dof: '2013-06-08',
  },
  // Nov 2024: Verified from travel.state.gov.
  {
    month: 'Nov 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-07-15',
    eb2_dof: '2013-01-01',
    eb3_fad: '2012-11-01',
    eb3_dof: '2013-06-08',
  },
  // Oct 2024: Verified from travel.state.gov.
  {
    month: 'Oct 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-04-15',
    eb2_fad: '2012-07-15',
    eb2_dof: '2013-01-01',
    eb3_fad: '2012-11-01',
    eb3_dof: '2013-06-08',
  },
  // ── FY2024 (Oct 2023 – Sep 2024) — All verified from travel.state.gov ──
  {
    month: 'Sep 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-02-08',
    eb2_fad: '2012-07-15',
    eb2_dof: '2012-07-22',
    eb3_fad: '2012-10-22',
    eb3_dof: '2012-11-01',
  },
  {
    month: 'Aug 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-02-08',
    eb2_fad: '2012-07-15',
    eb2_dof: '2012-07-22',
    eb3_fad: '2012-10-22',
    eb3_dof: '2012-11-01',
  },
  {
    month: 'Jul 2024',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-02-08',
    eb2_fad: '2012-06-15',
    eb2_dof: '2012-06-22',
    eb3_fad: '2012-09-22',
    eb3_dof: '2012-10-01',
  },
  {
    month: 'Jun 2024',
    eb1_fad: '2021-03-01',
    eb1_dof: '2021-04-01',
    eb2_fad: '2012-04-15',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-08-22',
    eb3_dof: '2012-09-15',
  },
  {
    month: 'May 2024',
    eb1_fad: '2021-03-01',
    eb1_dof: '2021-04-01',
    eb2_fad: '2012-04-15',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-08-15',
    eb3_dof: '2012-09-15',
  },
  {
    month: 'Apr 2024',
    eb1_fad: '2021-03-01',
    eb1_dof: '2021-04-01',
    eb2_fad: '2012-04-15',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-08-15',
    eb3_dof: '2012-09-15',
  },
  {
    month: 'Mar 2024',
    eb1_fad: '2020-10-01',
    eb1_dof: '2021-01-01',
    eb2_fad: '2012-03-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-07-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Feb 2024',
    eb1_fad: '2020-09-01',
    eb1_dof: '2021-01-01',
    eb2_fad: '2012-03-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-07-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Jan 2024',
    eb1_fad: '2020-09-01',
    eb1_dof: '2021-01-01',
    eb2_fad: '2012-03-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-06-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Dec 2023',
    eb1_fad: '2017-01-01',
    eb1_dof: '2019-07-01',
    eb2_fad: '2012-01-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-05-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Nov 2023',
    eb1_fad: '2017-01-01',
    eb1_dof: '2019-07-01',
    eb2_fad: '2012-01-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-05-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Oct 2023',
    eb1_fad: '2017-01-01',
    eb1_dof: '2019-07-01',
    eb2_fad: '2012-01-01',
    eb2_dof: '2012-05-15',
    eb3_fad: '2012-05-01',
    eb3_dof: '2012-08-01',
  },
  // ── FY2023 (Oct 2022 – Sep 2023) — All verified from travel.state.gov ──
  // Note: EB-1 India was "C" (Current) Oct–Dec 2022; represented as bulletin month date.
  // Apr/Jul 2023: Severe retrogression for EB-1 India (to Jan 2011) and EB-3 India (to Jan 2009).
  {
    month: 'Sep 2023',
    eb1_fad: '2012-01-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2009-01-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Aug 2023',
    eb1_fad: '2012-01-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2009-01-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Jul 2023',
    eb1_fad: '2011-01-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2009-01-01',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Jun 2023',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'May 2023',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Apr 2023',
    eb1_fad: '2011-01-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-01-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Mar 2023',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-10-08',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Feb 2023',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-10-08',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Jan 2023',
    eb1_fad: '2022-02-01',
    eb1_dof: '2022-06-01',
    eb2_fad: '2011-10-08',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  // EB-1 India was "Current" (C) in Oct–Dec 2022; using bulletin month as proxy date
  {
    month: 'Dec 2022',
    eb1_fad: '2022-12-01',
    eb1_dof: '2022-12-01',
    eb2_fad: '2011-10-08',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-06-15',
    eb3_dof: '2012-08-01',
  },
  {
    month: 'Nov 2022',
    eb1_fad: '2022-11-01',
    eb1_dof: '2022-11-01',
    eb2_fad: '2012-04-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-04-01',
    eb3_dof: '2012-07-01',
  },
  {
    month: 'Oct 2022',
    eb1_fad: '2022-10-01',
    eb1_dof: '2022-10-01',
    eb2_fad: '2012-04-01',
    eb2_dof: '2012-05-01',
    eb3_fad: '2012-04-01',
    eb3_dof: '2012-07-01',
  },
];

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetweenDates(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / 30.44;
}

function monthsBetween(from: string, to: string): number {
  return monthsBetweenDates(parseDateStr(from), parseDateStr(to));
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(months * 30.44));
  return d;
}

function fmtDate(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDateStr(s: string): string {
  return fmtDate(parseDateStr(s));
}

function fmtCompactMonthYear(s: string): string {
  const d = parseDateStr(s);
  return `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function fmtBulletinMonthLabel(value: string): string {
  const [month, year] = value.split(' ');
  return `${month} '${year.slice(2)}`;
}

function fmtYear(d: Date): string {
  return d.getFullYear().toString();
}

function fmtDuration(months: number): string {
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${yrs} yr${yrs !== 1 ? 's' : ''} ${rem} mo` : `${yrs} yr${yrs !== 1 ? 's' : ''}`;
}

function movementLabel(
  prevStr: string,
  currStr: string
): {
  label: string;
  type: 'advancement' | 'retrogression' | 'stable';
  days: number;
} {
  const prev = parseDateStr(prevStr);
  const curr = parseDateStr(currStr);
  const days = Math.round((curr.getTime() - prev.getTime()) / 86400000);
  const months = Math.round(days / 30.44);
  const type = days > 5 ? 'advancement' : days < -5 ? 'retrogression' : 'stable';
  const label = type === 'stable' ? '—' : `${days > 0 ? '+' : ''}${months}mo (${days > 0 ? '+' : ''}${days}d)`;
  return { label, type, days };
}

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

// ─── EMPIRICAL ANALYSIS LAYER (v7 additions) ────────────────────────────────
// Enhances the density-weighted model with:
// - FY-month seasonality factors from historical bulletin data
// - Month-by-month forward projection (replaces one-shot gap conversion)
// - Independent DoF modeling from historical DoF-FAD gap (rolling median)
// - Backtesting with MAE for transparent confidence reporting
//
// Existing density model and calibrated rates are preserved.

type BulletinFadKey = 'eb1_fad' | 'eb2_fad' | 'eb3_fad';
type BulletinDofKey = 'eb1_dof' | 'eb2_dof' | 'eb3_dof';

/** Compute month-over-month FAD advances (in PD-months) from bulletin history */
function computeHistoricalAdvances(fadKey: BulletinFadKey) {
  const bulletins = [...HISTORICAL_BULLETINS].reverse(); // chronological order
  const advances: { fyMonth: number; advance: number; month: string }[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 1; i < bulletins.length; i++) {
    const prevFad = bulletins[i - 1][fadKey] as string;
    const currFad = bulletins[i][fadKey] as string;
    const advance = monthsBetween(prevFad, currFad);
    const calMonth = monthNames.indexOf(bulletins[i].month.split(' ')[0]);
    const fyMonth = calMonth >= 9 ? calMonth - 8 : calMonth + 4; // Oct=1, Sep=12
    advances.push({ fyMonth, advance, month: bulletins[i].month });
  }
  return advances;
}

/** Compute FY-month seasonal factors from historical advances.
 *  Factor >1 = above-average movement that FY-month; <1 = below-average. */
function computeSeasonalFactors(advances: { fyMonth: number; advance: number }[]) {
  const byFyMonth: Record<number, number[]> = {};
  for (const a of advances) {
    if (!byFyMonth[a.fyMonth]) byFyMonth[a.fyMonth] = [];
    byFyMonth[a.fyMonth].push(a.advance);
  }

  const allAdvances = advances.map(a => a.advance).sort((a, b) => a - b);
  const overallMedian = allAdvances.length > 0 ? allAdvances[Math.floor(allAdvances.length / 2)] : 0.5;

  const factors: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const vals = byFyMonth[m];
    if (!vals || vals.length === 0) {
      factors[m] = 1.0;
    } else {
      const sorted = [...vals].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      factors[m] = overallMedian > 0 ? med / overallMedian : 1.0;
    }
  }
  return factors;
}

/** Compute historical DoF-FAD gap in months. Returns rolling median. */
function computeDofFadGap(fadKey: BulletinFadKey, dofKey: BulletinDofKey): number {
  const gaps: number[] = [];
  for (const b of HISTORICAL_BULLETINS) {
    const gap = monthsBetween(b[fadKey] as string, b[dofKey] as string);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 6;
  const sorted = [...gaps].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Backtest: at each historical point, predict next N months of FAD movement
 *  using only prior data + density model. Returns MAE in PD-months. */
function backtestModel(fadKey: BulletinFadKey, fadAdvanceRate: number, density: { category: string; refApprovals: number } | undefined, horizonMonths: number = 6): { mae: number; predictions: number } {
  const bulletins = [...HISTORICAL_BULLETINS].reverse(); // chronological
  if (bulletins.length < horizonMonths + 6) return { mae: 0, predictions: 0 };

  const errors: number[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let t = 6; t < bulletins.length - horizonMonths; t++) {
    // Build seasonal factors from history up to point t
    const histAdvances: { fyMonth: number; advance: number }[] = [];
    for (let i = 1; i <= t; i++) {
      const advance = monthsBetween(bulletins[i - 1][fadKey] as string, bulletins[i][fadKey] as string);
      const calMonth = monthNames.indexOf(bulletins[i].month.split(' ')[0]);
      const fyMonth = calMonth >= 9 ? calMonth - 8 : calMonth + 4;
      histAdvances.push({ fyMonth, advance });
    }
    const seasonal = computeSeasonalFactors(histAdvances);

    // Predict month-by-month with density + seasonality
    let predictedAdvancePD = 0;
    let pdCursor = bulletins[t][fadKey] as string;

    for (let h = 1; h <= horizonMonths; h++) {
      const futureIdx = t + h;
      if (futureIdx >= bulletins.length) break;

      const calMonth = monthNames.indexOf(bulletins[futureIdx].month.split(' ')[0]);
      const fyMonth = calMonth >= 9 ? calMonth - 8 : calMonth + 4;
      const seasonFactor = seasonal[fyMonth] ?? 1.0;

      let effectiveRate = fadAdvanceRate * seasonFactor;
      if (density) {
        const cursorYear = parseDateStr(pdCursor).getFullYear();
        const yearDemand = getHybridDensity(density.category, cursorYear) ?? density.refApprovals;
        const densityFactor = Math.sqrt(yearDemand / density.refApprovals);
        effectiveRate = effectiveRate / densityFactor;
      }

      predictedAdvancePD += effectiveRate;
      // Advance PD cursor
      const d = parseDateStr(pdCursor);
      d.setDate(d.getDate() + Math.round(effectiveRate * 30.44));
      pdCursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const actualAdvance = monthsBetween(bulletins[t][fadKey] as string, bulletins[Math.min(t + horizonMonths, bulletins.length - 1)][fadKey] as string);

    errors.push(Math.abs(predictedAdvancePD - actualAdvance));
  }

  if (errors.length === 0) return { mae: 0, predictions: 0 };
  const mae = errors.reduce((s, e) => s + e, 0) / errors.length;
  return { mae: Math.round(mae * 10) / 10, predictions: errors.length };
}

/**
 * Core projection function (v7 — Density + Seasonality Month-by-Month Model).
 *
 * Enhances the density-weighted model with FY-month seasonal adjustments and
 * month-by-month forward projection. Keeps all existing density data and
 * calibrated rates.
 *
 * For each projected calendar month:
 *   fyMonth         = fiscal year month (Oct=1 .. Sep=12)
 *   seasonFactor    = historical median advance for that FY-month / overall median
 *   densityFactor   = sqrt(yearApprovals / refApprovals) for the PD-year cursor
 *   monthAdvance    = fadAdvanceRate × seasonFactor / densityFactor
 *
 * Sums calendar months until the PD gap is consumed.
 * DoF modeled independently via historical DoF-FAD gap median.
 */
function computeProjection(currentFAD: string, targetDate: string, fadAdvanceRate: number, dofLeadMonths: number, gcLagMonths: number, density?: { category: string; refApprovals: number }, fadKey?: BulletinFadKey, dofKey?: BulletinDofKey) {
  const gapPDMonths = monthsBetween(currentFAD, targetDate);

  if (gapPDMonths <= 0) {
    return {
      isAlreadyCurrent: true,
      monthsFromToday: 0,
      fadDate: parseDateStr(currentFAD),
      dofDate: parseDateStr(currentFAD),
      gcDate: parseDateStr(currentFAD),
      gapPDMonths: 0,
    };
  }

  // Compute seasonal factors from bulletin history (if fadKey available)
  const seasonal = fadKey ? computeSeasonalFactors(computeHistoricalAdvances(fadKey)) : null;

  // Month-by-month forward projection with density + seasonality
  let remainingPD = gapPDMonths;
  let calendarMonths = 0;
  let projMonth = TODAY.getMonth(); // 0-indexed calendar month
  let pdCursorDate = parseDateStr(currentFAD);

  while (remainingPD > 0.01 && calendarMonths < 600) {
    const fyMonth = projMonth >= 9 ? projMonth - 8 : projMonth + 4;
    const seasonFactor = seasonal?.[fyMonth] ?? 1.0;

    // Start with calibrated rate × seasonal adjustment
    let effectiveRate = fadAdvanceRate * seasonFactor;

    // Apply hybrid density weighting for the PD-year the cursor is in
    // Uses I-485 inventory (actual queue depth) where available,
    // falls back to I-140 approvals for years beyond inventory coverage
    if (density) {
      const pdYear = pdCursorDate.getFullYear();
      const yearDemand = getHybridDensity(density.category, pdYear) ?? density.refApprovals;
      const densityFactor = Math.sqrt(yearDemand / density.refApprovals);
      effectiveRate = effectiveRate / densityFactor;
    }

    const monthAdvance = Math.max(effectiveRate, 0.001);
    if (remainingPD <= monthAdvance) {
      calendarMonths += remainingPD / monthAdvance;
      remainingPD = 0;
    } else {
      remainingPD -= monthAdvance;
      calendarMonths += 1;
    }

    // Advance PD cursor
    pdCursorDate = new Date(pdCursorDate);
    pdCursorDate.setDate(pdCursorDate.getDate() + Math.round(monthAdvance * 30.44));

    projMonth = (projMonth + 1) % 12;
  }

  const fadDate = addMonths(TODAY, calendarMonths);

  // Independent DoF: use historical median gap if bulletin keys available
  const empiricalDofLead = fadKey && dofKey ? computeDofFadGap(fadKey, dofKey) : dofLeadMonths;
  const dofDate = addMonths(fadDate, -empiricalDofLead);
  const gcDate = addMonths(fadDate, gcLagMonths);

  return {
    isAlreadyCurrent: false,
    monthsFromToday: Math.round(calendarMonths),
    fadDate,
    dofDate,
    gcDate,
    gapPDMonths: Math.round(gapPDMonths),
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

/**
 * Returns the next visa bulletin release date (second Tuesday of next month).
 * Bulletins for month M are released in month M-1 on the second Tuesday.
 */
function getNextBulletinDate(): Date {
  const now = new Date();
  // The next bulletin covers the month after the one it's released in.
  // We look for the second Tuesday of the current month; if it's already past,
  // we look at next month instead.
  function secondTuesdayOf(year: number, month: number): Date {
    // month is 0-indexed
    const d = new Date(year, month, 1);
    // Find first Tuesday
    const dayOfWeek = d.getDay(); // 0=Sun, 2=Tue
    const daysUntilTue = (2 - dayOfWeek + 7) % 7;
    d.setDate(1 + daysUntilTue + 7); // second Tuesday = first Tuesday + 7
    return d;
  }
  const thisMonthRelease = secondTuesdayOf(now.getFullYear(), now.getMonth());
  if (now < thisMonthRelease) return thisMonthRelease;
  // Already past — next release is second Tuesday of next month
  const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  return secondTuesdayOf(nextYear, nextMonth);
}

export default function Home() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EB_CATEGORIES>('EB2'); // default to EB-2
  const [targetDate, setTargetDate] = useState('2016-08-01');
  const [lastToastDate, setLastToastDate] = useState('');
  const [dateFlash, setDateFlash] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showSimulatorControls, setShowSimulatorControls] = useState(false);
  // Bulletin Tracker: fiscal year groups — FY2026 expanded by default
  const [expandedFYs, setExpandedFYs] = useState<Set<string>>(new Set(['FY2026']));
  const toggleFY = (fy: string) =>
    setExpandedFYs(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  const fadStarRowRef = useRef<HTMLTableRowElement>(null);
  const dofStarRowRef = useRef<HTMLTableRowElement>(null);
  const [activeHistoricalPoint, setActiveHistoricalPoint] = useState<any | null>(null);

  // Simulator controls (affect scenario rates)
  const [spilloverLevel, setSpilloverLevel] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [banContinues, setBanContinues] = useState<'2027' | '2028' | '2029'>('2028');
  const [wastageLevel, setWastageLevel] = useState<'low' | 'moderate' | 'high'>('moderate');

  const cat = EB_CATEGORIES[selectedCategory];

  // ── Next bulletin countdown (pure computation, no fetch) ──
  const nextBulletinDays = useMemo(() => {
    const next = getNextBulletinDate();
    const diff = Math.ceil((next.getTime() - Date.now()) / 86400000);
    return Math.max(0, diff);
  }, []);

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
    const base = { ...cat.rates };
    // Spillover adjustment
    const spilloverMultiplier = spilloverLevel === 'high' ? 1.25 : spilloverLevel === 'low' ? 0.75 : 1.0;
    // Ban duration adjustment (longer ban = more spillover years = higher sustained rate)
    const banMultiplier = banContinues === '2029' ? 1.15 : banContinues === '2027' ? 0.85 : 1.0;
    // Wastage adjustment (higher wastage = fewer effective visas = lower rate)
    const wastageMultiplier = wastageLevel === 'high' ? 0.8 : wastageLevel === 'low' ? 1.1 : 1.0;
    const combined = spilloverMultiplier * banMultiplier * wastageMultiplier;
    return {
      optimistic: +(base.optimistic * combined).toFixed(3),
      base: +(base.base * combined).toFixed(3),
      conservative: +(base.conservative * combined).toFixed(3),
      pessimistic: +(base.pessimistic * combined).toFixed(3),
    };
  }, [selectedCategory, spilloverLevel, banContinues, wastageLevel, cat.rates]);

  // Bulletin keys for the selected category
  const fadKey: BulletinFadKey = selectedCategory === 'EB1' ? 'eb1_fad' : selectedCategory === 'EB3' ? 'eb3_fad' : 'eb2_fad';
  const dofKey: BulletinDofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';

  // Compute projections for all scenarios (hybrid density + seasonality + month-by-month)
  const projections = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeProjection>> = {};
    const density = cat.density
      ? {
          category: cat.density.category,
          refApprovals: computeMeanDensity(cat.density.category),
        }
      : undefined;
    for (const key of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>) {
      result[key] = computeProjection(cat.currentFAD, targetDate, adjustedRates[key], cat.dofLeadMonths, cat.gcLagMonths, density, fadKey, dofKey);
    }
    return result;
  }, [selectedCategory, targetDate, adjustedRates, cat, fadKey, dofKey]);

  // Backtest MAE for the base-case rate (6-month horizon)
  const backtestResult = useMemo(() => {
    const density = cat.density
      ? {
          category: cat.density.category,
          refApprovals: computeMeanDensity(cat.density.category),
        }
      : undefined;
    return backtestModel(fadKey, cat.rates.base, density, 6);
  }, [selectedCategory, cat, fadKey]);

  // Empirical DoF lead (independent model)
  const empiricalDofLead = useMemo(() => {
    return Math.round(computeDofFadGap(fadKey, dofKey) * 10) / 10;
  }, [fadKey, dofKey]);

  const baseProjection = projections.base;
  const gapMonths = Math.max(0, Math.round(monthsBetween(cat.currentFAD, targetDate)));

  // Chart data: historical FAD movement
  // Uses timestamp (ms) on Y-axis for accurate date spacing; X-axis shows bulletin months
  const historicalChartData = useMemo(() => {
    const raw = [...HISTORICAL_BULLETINS].reverse().map((b, i) => {
      const key = selectedCategory === 'EB1' ? 'eb1_fad' : selectedCategory === 'EB3' ? 'eb3_fad' : 'eb2_fad';
      const dofKey = selectedCategory === 'EB1' ? 'eb1_dof' : selectedCategory === 'EB3' ? 'eb3_dof' : 'eb2_dof';
      const fadDate = parseDateStr(b[key as keyof typeof b] as string);
      const dofDate = parseDateStr(b[dofKey as keyof typeof b] as string);
      return {
        month: b.month,
        idx: i,
        fad: fadDate.getTime(),
        dof: dofDate.getTime(),
        fadLabel: fmtDate(fadDate),
        dofLabel: fmtDate(dofDate),
      };
    });

    // Clip: compute a floor to prevent deep retrogression dips from distorting the Y-axis
    // Use the 10th percentile of FAD values as the floor
    const sortedFads = raw.map(d => d.fad).sort((a, b) => a - b);
    const p10 = sortedFads[Math.floor(sortedFads.length * 0.1)];
    return raw.map(d => ({
      ...d,
      fad: Math.max(d.fad, p10),
      dof: Math.max(d.dof, p10),
      fadRaw: d.fad, // keep unclipped for tooltip
      dofRaw: d.dof,
    }));
  }, [selectedCategory]);

  // Y-axis domain: ensure target PD is visible, with some padding
  const chartYDomain = useMemo(() => {
    const allVals = historicalChartData.flatMap(d => [d.fad, d.dof]);
    const targetTs = parseDateStr(targetDate).getTime();
    allVals.push(targetTs);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }, [historicalChartData, targetDate]);

  // FY boundary indices (Oct of each year) for vertical reference lines
  const fyBoundaries = useMemo(() => {
    return historicalChartData.filter(d => d.month.startsWith('Oct ')).map(d => d.month);
  }, [historicalChartData]);

  // Acceleration zone: find Oct 2025 and Apr 2026 indices
  const accelZone = useMemo(() => {
    const start = historicalChartData.find(d => d.month === 'Oct 2025')?.month;
    const end = historicalChartData.find(d => d.month === 'Apr 2026')?.month;
    return start && end ? { x1: start, x2: end } : null;
  }, [historicalChartData]);

  const historicalXAxisTicks = useMemo(() => {
    return Array.from(
      new Set(
        historicalChartData
          .filter((d, index) => {
            const isAnchor = index === 0 || index === historicalChartData.length - 1;
            const isDesktopTick = d.month.startsWith('Apr ') || d.month.startsWith('Oct ');
            const isMobileTick = d.month.startsWith('Oct ');
            return isAnchor || (isMobile ? isMobileTick : isDesktopTick);
          })
          .map(d => d.month)
      )
    );
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

  useEffect(() => {
    setActiveHistoricalPoint(historicalChartData[historicalChartData.length - 1] ?? null);
  }, [historicalChartData]);

  const activeHistoricalInsight = useMemo(() => {
    if (!activeHistoricalPoint) return null;
    return getHistoricalPointInsight(activeHistoricalPoint, targetDate);
  }, [activeHistoricalPoint, targetDate]);

  // Demand density chart data: pending I-485s + scaled I-140 by PD year
  const demandDensityData = useMemo(() => {
    const catKey = selectedCategory;
    const i485 = I485_INDIA_PENDING[catKey] ?? {};
    const i140 = I140_INDIA_APPROVALS[catKey] ?? {};

    // Compute I-140 → I-485 scale factor at overlap year
    const overlapYears = Object.keys(i485)
      .map(Number)
      .filter(y => i485[y] > 0 && i140[y] !== undefined);
    const overlapYear = overlapYears.length > 0 ? Math.max(...overlapYears) : null;
    const scaleFactor = overlapYear ? i485[overlapYear] / i140[overlapYear] : 1;

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
    const baseFadDate = baseProjection?.fadDate;
    const fadMonthYear = baseFadDate ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][baseFadDate.getMonth()]} ${baseFadDate.getFullYear()}` : 'unknown';
    const baseDofDate = baseProjection?.dofDate;
    const dofMonthYear = baseDofDate ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][baseDofDate.getMonth()]} ${baseDofDate.getFullYear()}` : null;
    const sentence = dofMonthYear ? `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) — can file I-485 around ${dofMonthYear}, become current around ${fadMonthYear} (base case). ${url}` : `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) is estimated to become current around ${fadMonthYear} (base case). ${url}`;
    try {
      await navigator.clipboard.writeText(sentence);
      setShareCopied(true);
      toast.success('Estimate copied to clipboard!', {
        description: sentence.length > 80 ? sentence.slice(0, 80) + '…' : sentence,
        duration: 4000,
        position: 'bottom-right',
      });
      setTimeout(() => setShareCopied(false), 3000);
    } catch {
      // Fallback: show in prompt
      window.prompt('Copy this to share your estimate:', sentence);
    }
  }, [generateShareUrl, baseProjection, cat.label, targetDate]);

  const generateExport = () => {
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

    // ── Section: Base Case Projection ──
    checkPage(38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('BASE CASE PROJECTION', margin, y);
    y += 4;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F');
    const bp = projections.base;
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
        sub: 'Base case estimate',
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
    const methodLines = ['Uses the FAD Advance Rate Model: months_to_FAD = gap_PD_months ÷ fad_advance_rate', 'Rates are calibrated from research documents and historical visa bulletin data.', 'DoF (Date for Filing) leads FAD by approximately 6 months.', 'GC receipt follows FAD by approximately 12–18 months.'];
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
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{nextBulletinDays === 0 ? 'Today' : nextBulletinDays === 1 ? 'Tomorrow' : `+${nextBulletinDays}d`}</span>
                </div>
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
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Calendar className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">{nextBulletinDays === 0 ? 'New bulletin today' : nextBulletinDays === 1 ? 'Tomorrow' : `+${nextBulletinDays}d`}</span>
              </div>
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
            {baseProjection.isAlreadyCurrent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-emerald-700">Already Current!</p>
                <p className="text-sm text-slate-600 mt-1">{fmtDateStr(targetDate)} is already current as of the April 2026 bulletin.</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 text-white relative -mt-2 md:-mt-0">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-1">Your Projection</h2>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-mono text-slate-400">{fmtDateStr(targetDate)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-600 text-slate-300 px-2 py-0.5 rounded-full">Base Case</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Filing Date (DoF)</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight">{fmtDate(baseProjection.dofDate)}</p>
                    <p className="text-xs text-slate-500 mt-1.5">Can file I-485</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Final Action Date</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight">{fmtDate(baseProjection.fadDate)}</p>
                    <p className="text-xs text-slate-500 mt-1.5">Visa becomes available</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">GC Receipt Est.</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight">{fmtDate(baseProjection.gcDate)}</p>
                    <p className="text-xs text-slate-500 mt-1.5">~{fmtDuration(cat.gcLagMonths)} after FAD</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Time to FAD</p>
                    <p className="text-2xl md:text-xl font-bold font-mono leading-tight">{fmtDuration(baseProjection.monthsFromToday)}</p>
                    <p className="text-xs text-slate-500 mt-1">Base case estimate</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-5 border-t border-slate-600 pt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <p>Base case assumes moderate spillover (30-40k extra EB visas in FY2027). See Scenarios tab for full range.</p>
                  <div className="flex items-center gap-3 text-[10px] shrink-0">
                    {backtestResult.predictions > 0 && (
                      <span className="flex items-center gap-1 bg-slate-600/50 px-2 py-0.5 rounded-full" title={`6-month backtest on ${backtestResult.predictions} rolling windows`}>
                        <Info className="w-3 h-3" />
                        MAE: ±{backtestResult.mae} mo
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-slate-600/50 px-2 py-0.5 rounded-full" title="DoF-FAD gap derived from historical bulletin data">
                      DoF lead: {empiricalDofLead} mo
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario Range — 4 tiles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scenario Range — All Outcomes</p>
                <button
                  onClick={() => {
                    setActiveTab('scenarios');
                    setShowSimulatorControls(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <span className="text-sm">&#9881;&#65039;</span>
                  Adjust assumptions
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-slate-400" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, (typeof SCENARIOS)[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                  const p = projections[key];
                  const isBase = key === 'base';
                  return (
                    <div key={key} className={`bg-white rounded-xl border border-slate-200 border-l-4 p-4 ${isBase ? 'ring-1 ring-slate-300' : ''}`} style={{ borderLeftColor: s.color }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">{s.label}</span>
                        {isBase && <span className="text-xs bg-slate-800 text-white px-1.5 py-0.5 rounded font-semibold">Base</span>}
                      </div>
                      <p className="text-sm font-bold font-mono text-slate-900 leading-tight">{p.isAlreadyCurrent ? 'Current' : fmtDate(p.fadDate)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">FAD</p>
                      {!p.isAlreadyCurrent && (
                        <>
                          <p className="text-xs font-mono text-slate-600 mt-1.5">{fmtDate(p.dofDate)}</p>
                          <p className="text-xs text-slate-400">DoF (file I-485)</p>
                        </>
                      )}
                      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">{s.probability} probability</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historical Chart */}
            <Card className="overflow-hidden gap-0 border-slate-200 bg-white p-0 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 md:text-base">{cat.label} India priority date movement</h3>
                  <p className="mt-1 text-xs text-slate-500">X-axis is bulletin month. Y-axis is priority date, so the lines move up as cutoff dates advance.</p>
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
                        onClick={(state: any) => {
                          const point = state?.activePayload?.[0]?.payload;
                          if (point) setActiveHistoricalPoint(point);
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
                          {activeHistoricalPoint?.idx === historicalChartData.length - 1 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Latest</span>}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{isMobile ? 'Tap the chart to inspect earlier months.' : 'Hover the chart to inspect earlier months.'}</p>
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
                    <p className="text-sm font-bold text-slate-900">+10 months in Apr 2026</p>
                    <p className="text-xs text-slate-500 mt-1">Largest single-month jump in EB-2 India history. Oct 2025–Apr 2026: +15.5 PD-months in 7 bulletins.</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Pending Inventory</p>
                    <p className="text-sm font-bold text-slate-900">{cat.pendingInventory.toLocaleString()} I-485s</p>
                    <p className="text-xs text-slate-500 mt-1">USCIS Oct 2025 data. Total EB-2 India backlog: ~350k–400k principal applicants.</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Key Risk</p>
                    <p className="text-sm font-bold text-slate-900">Retrogression possible</p>
                    <p className="text-xs text-slate-500 mt-1">Apr 2026 bulletin warns "retrogression may be necessary later in the fiscal year."</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Methodology toggle */}
            <button onClick={() => setShowMethodology(v => !v)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors">
              <Info className="w-3.5 h-3.5" />
              {showMethodology ? 'Hide' : 'Show'} methodology
              {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showMethodology && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Hybrid Density + Seasonality Month-by-Month Model (v7)</p>
                <p>
                  Projects FAD forward <strong>one calendar month at a time</strong>, applying both demand density and FY-month seasonal adjustments at each step.
                </p>
                <p>
                  For each month: <code className="bg-slate-200 px-1 rounded">effective_rate = base_rate × season_factor ÷ √(demand ÷ ref_demand)</code>
                </p>
                <p>
                  <strong>Hybrid density:</strong> Uses <strong>USCIS I-485 pending inventory</strong> (Oct 2025) where available — actual queue depth by PD year. Falls back to <strong>I-140 approval counts</strong> (FY2025 Q3) for PD years beyond inventory coverage, scaled to I-485 magnitude at the overlap year. Reference = weighted mean across all years. EB-2 India: PD-2014 = 17,092 pending, PD-2015 = 21,559 (scaled), PD-2016 = 32,436 (scaled, densest).
                </p>
                <p>
                  <strong>Seasonality:</strong> Derived from 43 months of verified bulletin data. Each FY-month gets a factor based on its historical median advance vs overall median.
                </p>
                <p>
                  <strong>DoF model:</strong> Independent — uses rolling median of historical DoF-FAD gap instead of fixed offset.
                </p>
                <p>Scenario rates calibrated against 43 months of verified visa bulletin data (Oct 2022–Apr 2026). Data sources: DOS Visa Bulletins (travel.state.gov), USCIS I-485 Inventory & I-140 Performance Data (uscis.gov), Cato Institute policy analysis.</p>
                <p>
                  DoF estimate = FAD estimate − {cat.dofLeadMonths} months. GC receipt estimate = FAD estimate + {cat.gcLagMonths} months.
                </p>
                <p className="text-slate-400">Disclaimer: Estimates are probabilistic and may change with policy shifts, retrogression, or legislative action.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SCENARIOS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'scenarios' && (
          <div className="space-y-6">
            {/* ── Scenarios header row ── */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Scenario Analysis</h2>
                <p className="text-xs text-slate-500 mt-0.5">Four outcomes based on current policy assumptions</p>
              </div>
              <button onClick={generateExport} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 border border-slate-800 rounded-lg shadow-sm hover:bg-slate-700 hover:border-slate-700 active:scale-95 transition-all">
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>

            {/* ── Adjust Assumptions (collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setShowSimulatorControls(v => !v)} className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-base">&#9881;&#65039;</span>
                  <span>Adjust Assumptions</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    Spillover: {spilloverLevel} · Ban: through {banContinues} · Wastage: {wastageLevel}
                  </span>
                </div>
                {showSimulatorControls ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showSimulatorControls && (
                <div className="border-t border-slate-100 p-5 space-y-5">
                  {/* Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Spillover Level</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: 'low' as const,
                            label: 'Low (~30k extra EB visas)',
                            sub: 'Partial ban, limited spillover',
                          },
                          {
                            val: 'moderate' as const,
                            label: 'Moderate (~50k extra)',
                            sub: 'Base case assumption',
                          },
                          {
                            val: 'high' as const,
                            label: 'High (~70k+ extra)',
                            sub: 'Full ban, max spillover',
                          },
                        ].map(o => (
                          <button key={o.val} onClick={() => setSpilloverLevel(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${spilloverLevel === o.val ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={spilloverLevel === o.val ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Ban Duration</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: '2027' as const,
                            label: 'Ends Oct 2027 (1 FY)',
                            sub: 'Court reversal (CLINIC v. Rubio pending)',
                          },
                          {
                            val: '2028' as const,
                            label: 'Through Sept 2028 (2 FY)',
                            sub: 'Base case — sustained policy',
                          },
                          {
                            val: '2029' as const,
                            label: 'Through Sept 2029 (3 FY)',
                            sub: 'Full term continuation',
                          },
                        ].map(o => (
                          <button key={o.val} onClick={() => setBanContinues(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${banContinues === o.val ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={banContinues === o.val ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">GC Wastage Level</label>
                      <div className="space-y-2">
                        {[
                          {
                            val: 'low' as const,
                            label: 'Low (5–10%)',
                            sub: 'Efficient consular processing',
                          },
                          {
                            val: 'moderate' as const,
                            label: 'Moderate (15–20%)',
                            sub: 'Typical processing friction',
                          },
                          {
                            val: 'high' as const,
                            label: 'High (25–30%)',
                            sub: 'Systemic delays (as in FY2021)',
                          },
                        ].map(o => (
                          <button key={o.val} onClick={() => setWastageLevel(o.val)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${wastageLevel === o.val ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={wastageLevel === o.val ? 'text-slate-300' : 'text-slate-400'}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Explainer cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
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
                        Projects FAD forward <strong>month by month</strong>. Each step adjusts for demand density (I-485 inventory + I-140 data) and FY-month seasonality. These controls scale the base advance rate — the combined multiplier applies to every projected month.
                      </p>
                      <div className="mt-2 text-xs text-slate-500 font-mono bg-white rounded px-2 py-1 leading-relaxed">each month: rate × (spillover × ban × wastage) × season ÷ √density</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Projections for {fmtDateStr(targetDate)}</strong> — {cat.label} India. The critical variable is whether the FY2027 visa spillover materializes at scale. Use <strong>Adjust Assumptions</strong> above to see how spillover, ban duration, and wastage affect your timeline.
            </div>

            {/* Scenario cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, (typeof SCENARIOS)[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                const p = projections[key];
                return (
                  <div key={key} className="bg-white rounded-xl border-l-4 border border-slate-200 p-5" style={{ borderLeftColor: s.color }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{s.label}</h3>
                        <p className="text-xs text-slate-500">{s.probability} probability</p>
                      </div>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{adjustedRates[key]} PD-mo/mo</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{s.description}</p>
                    <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 mb-0.5">DoF Reaches</p>
                        <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtDate(p.dofDate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">FAD Reaches</p>
                        <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtDate(p.fadDate)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">GC Receipt</p>
                        <p className="font-bold font-mono text-slate-900">{p.isAlreadyCurrent ? 'Current' : fmtDate(p.gcDate)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{p.isAlreadyCurrent ? 'Already current' : `FAD in ${fmtDuration(p.monthsFromToday)}`}</div>
                  </div>
                );
              })}
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

            {/* Research-backed scenario table */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Research-Backed Ranges (Aug 2016 PD)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Scenario</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">DoF Reaches Aug 2016</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">FAD Reaches Aug 2016</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">GC Receipt</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, (typeof SCENARIOS)[keyof typeof SCENARIOS]]>).map(([key, s]) => (
                      <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold" style={{ color: s.color }}>
                          {s.label}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.dofRange}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.fadRange}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.gcRange}</td>
                        <td className="px-3 py-2 text-slate-600">{s.probability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">Sources: DOS Visa Bulletins (travel.state.gov), USCIS I-485 Inventory & I-140 Performance Data (uscis.gov)</p>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            BULLETIN TRACKER TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
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
                <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-w-[140px]">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{label}</p>
                  {v6 !== null && (
                    <p className={`text-base font-bold font-mono mt-0.5 ${paceColor(v6)}`}>
                      6mo: {paceLabel(v6)}
                      {v12 !== null && <span className={`ml-2 text-sm font-normal ${paceColor(v12)}`}>· 12mo: {paceLabel(v12)}</span>}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{cat.label} avg</p>
                </div>
              );
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 text-sm text-slate-600">
                    Historical visa bulletins for India. Δ columns show month-over-month movement.
                    <span className="text-emerald-600 font-semibold"> Green = advancement</span>,<span className="text-red-600 font-semibold"> Red = retrogression</span>.
                  </div>
                  <div className="flex gap-3 shrink-0 flex-wrap">
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

              // Find the first row where the selected FAD >= user's priority date (first month it became current)
              let firstCurrentIdx: number | null = null;
              for (let i = HISTORICAL_BULLETINS.length - 1; i >= 0; i--) {
                const fadVal = HISTORICAL_BULLETINS[i][selFadKey as keyof (typeof HISTORICAL_BULLETINS)[0]] as string;
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
              HISTORICAL_BULLETINS.forEach((b, idx) => {
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
                            const fy = fyOf(HISTORICAL_BULLETINS[firstCurrentIdx!].month);
                            setExpandedFYs(prev => {
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
                      const isOpen = expandedFYs.has(fy);
                      const startMo = HISTORICAL_BULLETINS[indices[indices.length - 1]].month;
                      const endMo = HISTORICAL_BULLETINS[indices[0]].month;
                      const hasStarRow = firstCurrentIdx !== null && indices.includes(firstCurrentIdx);
                      return (
                        <div key={fy} className="rounded-lg border border-slate-200 overflow-hidden">
                          <button onClick={() => toggleFY(fy)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isOpen ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
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
                                    const b = HISTORICAL_BULLETINS[idx];
                                    const prev = idx < HISTORICAL_BULLETINS.length - 1 ? HISTORICAL_BULLETINS[idx + 1] : null;
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

              // Find first row where selected DoF >= user's priority date
              let firstCurrentIdx: number | null = null;
              for (let i = HISTORICAL_BULLETINS.length - 1; i >= 0; i--) {
                const dofVal = HISTORICAL_BULLETINS[i][selDofKey as keyof (typeof HISTORICAL_BULLETINS)[0]] as string;
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
              HISTORICAL_BULLETINS.forEach((b, idx) => {
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
                            const fy = fyOfD(HISTORICAL_BULLETINS[firstCurrentIdx!].month);
                            setExpandedFYs(prev => {
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
                      const isOpen = expandedFYs.has(fy);
                      const startMo = HISTORICAL_BULLETINS[indices[indices.length - 1]].month;
                      const endMo = HISTORICAL_BULLETINS[indices[0]].month;
                      const hasStarRow = firstCurrentIdx !== null && indices.includes(firstCurrentIdx);
                      return (
                        <div key={fy} className="rounded-lg border border-slate-200 overflow-hidden">
                          <button onClick={() => toggleFY(fy)} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isOpen ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
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
                                    const b = HISTORICAL_BULLETINS[idx];
                                    const prev = idx < HISTORICAL_BULLETINS.length - 1 ? HISTORICAL_BULLETINS[idx + 1] : null;
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
    </div>
  );
}
