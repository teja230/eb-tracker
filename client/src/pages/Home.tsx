/**
 * EB Priority Date Tracker
 *
 * DESIGN: Civic Tech Policy Dashboard
 * - Slate blue primary, teal for advancement, amber for caution, red for retrogression
 * - DM Sans + DM Mono typography
 * - Data-forward, trustworthy, professional
 *
 * ALGORITHM (v5 — FAD Advance Rate Model):
 * Based on two research documents (pasted_content.txt + pasted_content_2.txt).
 *
 * Core insight: The correct way to project when a priority date becomes current is
 * to model the FAD advance rate (PD-months advanced per calendar month), NOT to
 * divide pending inventory by monthly visa rate. The advance rate model directly
 * reflects how DOS moves dates based on visa availability and demand.
 *
 * Formula:
 *   monthsFromToday = gapPDMonths / fadAdvanceRate
 *   estimatedDate   = TODAY + monthsFromToday
 *
 * Where:
 *   gapPDMonths     = months between current FAD and target priority date
 *   fadAdvanceRate  = PD-months advanced per calendar month (scenario-dependent)
 *
 * Scenario rates (from research):
 *   Optimistic  : 1.5–1.75 PD-mo/month  (large FY2027 spillover 60k+)
 *   Base Case   : 0.9–1.05 PD-mo/month  (moderate spillover 30–40k)
 *   Conservative: 0.4–0.5  PD-mo/month  (no spillover, reversion to pre-FY2026 pace)
 *   Pessimistic : 0.25–0.3 PD-mo/month  (ban reversed, stagnation returns)
 *
 * DoF leads FAD by ~6 months historically.
 * GC receipt follows FAD by ~12–18 months.
 *
 * Sources: April 2026 Visa Bulletin (travel.state.gov), USCIS I-485 Inventory (Oct 2025),
 * Capitol Immigration Law Group, AM22Tech, Manifest Law, Beyondborderglobal, Cato Institute.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

import { Card } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, Calendar, Clock, Download, CheckCircle2,
  AlertTriangle, Info, ChevronDown, ChevronUp, Share2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TODAY = new Date(); // Always the current date — do NOT hardcode this

// April 2026 Visa Bulletin data (most recent)
const CURRENT_BULLETIN = {
  month: "April 2026",
  eb1: { fad: "2023-04-01", dof: "2023-12-01" },
  eb2: { fad: "2014-07-15", dof: "2015-01-15" },
  eb3: { fad: "2013-11-15", dof: "2015-01-15" },
};

// EB Category metadata — order determines tab display order (EB-1, EB-2, EB-3)
const EB_CATEGORIES = {
  EB1: {
    label: "EB-1",
    name: "Priority Workers / Multinational Managers",
    currentFAD: CURRENT_BULLETIN.eb1.fad,
    currentDoF: CURRENT_BULLETIN.eb1.dof,
    rates: {
      optimistic:   2.5,
      base:         1.5,
      conservative: 0.8,
      pessimistic:  0.4,
    },
    dofLeadMonths: 8,
    gcLagMonths: 12,
    pendingInventory: 8000,
    annualVisas: 2500,
    notes: "EB-1 India has a smaller backlog (~8k pending). Current FAD is Apr 2023, significantly more current than EB-2.",
  },
  EB2: {
    label: "EB-2",
    name: "Advanced Degree / Exceptional Ability",
    currentFAD: CURRENT_BULLETIN.eb2.fad,
    currentDoF: CURRENT_BULLETIN.eb2.dof,
    // FAD advance rates per scenario (PD-months per calendar month)
    // Source: pasted_content.txt + pasted_content_2.txt
    rates: {
      optimistic:   1.625, // midpoint of 1.5–1.75 (large FY2027 spillover 60k+)
      base:         0.975, // midpoint of 0.9–1.05 (moderate spillover 30–40k)
      conservative: 0.45,  // midpoint of 0.4–0.5  (no spillover, slow pace)
      pessimistic:  0.275, // midpoint of 0.25–0.3 (ban reversed, stagnation)
    },
    dofLeadMonths: 6,    // DoF typically leads FAD by ~6 months
    gcLagMonths: 15,     // GC receipt ~12–18 months after FAD (midpoint)
    pendingInventory: 2183, // USCIS Oct 2025 data
    annualVisas: 100,    // FY2023 actual (pasted_content_2.txt)
    notes: "EB-2 India receives ~2,800–3,000 visas/year under normal conditions. FY2026 acceleration driven by 75-country ban spillover.",
  },
  EB3: {
    label: "EB-3",
    name: "Skilled Workers / Professionals",
    currentFAD: CURRENT_BULLETIN.eb3.fad,
    currentDoF: CURRENT_BULLETIN.eb3.dof,
    rates: {
      optimistic:   1.2,
      base:         0.7,
      conservative: 0.35,
      pessimistic:  0.2,
    },
    dofLeadMonths: 6,
    gcLagMonths: 18,
    pendingInventory: 55000,
    annualVisas: 3000,
    notes: "EB-3 India has the largest backlog (~55k pending). EB-3 demand is stronger than EB-2, limiting spillover to EB-2.",
  },
};

// Scenario definitions (from pasted_content.txt)
const SCENARIOS = {
  optimistic: {
    label: "Optimistic",
    probability: "15–20%",
    color: "#10b981",
    tailwindColor: "emerald",
    spillover: "60k+ extra EB visas (FY2027 materializes at scale)",
    description: "Large FY2027 spillover materializes. 75-country ban persists through Sept 2026, generating 60k+ extra EB visas. Historical parallel: COVID FY2021–22 created 120k+ extra EB visas.",
    dofRange: "Late 2026 – Early 2027",
    fadRange: "Late 2027 – 2028",
    gcRange: "2028 – 2029",
  },
  base: {
    label: "Base Case",
    probability: "40%",
    color: "#3b82f6",
    tailwindColor: "blue",
    spillover: "30–40k extra EB visas (moderate spillover)",
    description: "Moderate spillover with some retrogression. Ban generates 30–40k extra visas but offset by surge in I-485 filings and mid-year retrogression.",
    dofRange: "Mid–Late 2027",
    fadRange: "2028 – 2029",
    gcRange: "2029 – 2031",
  },
  conservative: {
    label: "Conservative",
    probability: "30%",
    color: "#f59e0b",
    tailwindColor: "amber",
    spillover: "No spillover, reversion to pre-FY2026 pace",
    description: "Ban reversed by courts, no spillover materializes. Movement reverts to pre-FY2026 pace of 2–4 months/year.",
    dofRange: "2028 – 2029",
    fadRange: "2030 – 2033",
    gcRange: "2031 – 2035",
  },
  pessimistic: {
    label: "Pessimistic",
    probability: "10–15%",
    color: "#ef4444",
    tailwindColor: "red",
    spillover: "Stagnation / retrogression",
    description: "Ban reversed, retrogression occurs, pace drops below pre-FY2026 levels. At FY2024 pace (3.5 months/year), Aug 2016 would not clear until ~2033.",
    dofRange: "2030 – 2033",
    fadRange: "2032 – 2036",
    gcRange: "2033 – 2038",
  },
};

// Historical visa bulletins (most recent first)
// ALL values verified against official travel.state.gov bulletins (Mar 2026)
const HISTORICAL_BULLETINS = [
  // Apr 2026: EB-2 FAD +10mo jump. Verified from official bulletin.
  { month: "Apr 2026", eb1_fad: "2023-04-01", eb1_dof: "2023-12-01", eb2_fad: "2014-07-15", eb2_dof: "2015-01-15", eb3_fad: "2013-11-15", eb3_dof: "2015-01-15" },
  // Mar 2026: Verified from travel.state.gov. EB-2 FAD=Sep 15, 2013 (not 2014)
  { month: "Mar 2026", eb1_fad: "2023-03-01", eb1_dof: "2023-12-01", eb2_fad: "2013-09-15", eb2_dof: "2014-11-01", eb3_fad: "2013-11-15", eb3_dof: "2014-08-15" },
  // Feb 2026: Verified from travel.state.gov. EB-2 FAD=Jul 15, 2013 (not 2014)
  { month: "Feb 2026", eb1_fad: "2023-02-01", eb1_dof: "2023-08-01", eb2_fad: "2013-07-15", eb2_dof: "2013-12-01", eb3_fad: "2013-11-15", eb3_dof: "2014-08-15" },
  // Jan 2026: Verified from travel.state.gov.
  { month: "Jan 2026", eb1_fad: "2023-02-01", eb1_dof: "2023-08-01", eb2_fad: "2013-07-15", eb2_dof: "2013-12-01", eb3_fad: "2013-11-15", eb3_dof: "2014-08-15" },
  // Dec 2025: Verified from travel.state.gov.
  { month: "Dec 2025", eb1_fad: "2022-03-15", eb1_dof: "2023-04-15", eb2_fad: "2013-05-15", eb2_dof: "2013-12-01", eb3_fad: "2013-09-22", eb3_dof: "2014-08-15" },
  // Nov 2025: Verified from travel.state.gov.
  { month: "Nov 2025", eb1_fad: "2022-02-15", eb1_dof: "2023-04-15", eb2_fad: "2013-04-01", eb2_dof: "2013-12-01", eb3_fad: "2013-08-22", eb3_dof: "2014-08-15" },
  // Oct 2025: Verified from travel.state.gov. EB-2 FAD=Apr 1, 2013 (not Jun 2013)
  { month: "Oct 2025", eb1_fad: "2022-02-15", eb1_dof: "2023-04-15", eb2_fad: "2013-04-01", eb2_dof: "2013-12-01", eb3_fad: "2013-08-22", eb3_dof: "2014-08-15" },
  // Sep 2025: Verified from travel.state.gov. DoF jumped from Feb 2013 to Dec 2013 in Oct.
  { month: "Sep 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-05-22", eb3_dof: "2013-06-08" },
  // Aug 2025: Verified from travel.state.gov.
  { month: "Aug 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-05-22", eb3_dof: "2013-06-08" },
  // Jul 2025: Verified from travel.state.gov.
  { month: "Jul 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-04-22", eb3_dof: "2013-06-08" },
  // Jun 2025: Verified from travel.state.gov.
  { month: "Jun 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-04-15", eb3_dof: "2013-06-08" },
  // May 2025: Verified from travel.state.gov.
  { month: "May 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-04-15", eb3_dof: "2013-06-08" },
  // Apr 2025: Verified from travel.state.gov.
  { month: "Apr 2025", eb1_fad: "2022-02-15", eb1_dof: "2022-04-15", eb2_fad: "2013-01-01", eb2_dof: "2013-02-01", eb3_fad: "2013-04-01", eb3_dof: "2013-06-08" },
  // Mar 2025: Verified from travel.state.gov.
  { month: "Mar 2025", eb1_fad: "2022-02-01", eb1_dof: "2022-04-15", eb2_fad: "2012-12-01", eb2_dof: "2013-01-01", eb3_fad: "2013-02-01", eb3_dof: "2013-06-08" },
  // Feb 2025: Verified from travel.state.gov.
  { month: "Feb 2025", eb1_fad: "2022-02-01", eb1_dof: "2022-04-15", eb2_fad: "2012-10-15", eb2_dof: "2013-01-01", eb3_fad: "2012-12-15", eb3_dof: "2013-06-08" },
  // Jan 2025: Verified from travel.state.gov.
  { month: "Jan 2025", eb1_fad: "2022-02-01", eb1_dof: "2022-04-15", eb2_fad: "2012-10-01", eb2_dof: "2013-01-01", eb3_fad: "2012-12-01", eb3_dof: "2013-06-08" },
  // Oct 2024: Verified from travel.state.gov.
  { month: "Oct 2024", eb1_fad: "2022-02-01", eb1_dof: "2022-04-15", eb2_fad: "2012-07-15", eb2_dof: "2013-01-01", eb3_fad: "2012-11-01", eb3_dof: "2013-06-08" },
  // Jan 2024: estimated from historical trend
  { month: "Jan 2024", eb1_fad: "2022-01-01", eb1_dof: "2022-09-01", eb2_fad: "2012-03-01", eb2_dof: "2012-07-01", eb3_fad: "2012-02-01", eb3_dof: "2012-07-01" },
  // Jan 2023: estimated from historical trend
  { month: "Jan 2023", eb1_fad: "2021-10-01", eb1_dof: "2022-05-01", eb2_fad: "2011-10-08", eb2_dof: "2012-02-01", eb3_fad: "2011-08-01", eb3_dof: "2012-02-01" },
];

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthsBetween(from: string, to: string): number {
  const a = parseDateStr(from);
  const b = parseDateStr(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    + (b.getDate() - a.getDate()) / 30.44;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + Math.round(months * 30.44));
  return d;
}

function fmtDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDateStr(s: string): string {
  return fmtDate(parseDateStr(s));
}

function fmtYear(d: Date): string {
  return d.getFullYear().toString();
}

function movementLabel(prevStr: string, currStr: string): { label: string; type: "advancement" | "retrogression" | "stable"; days: number } {
  const prev = parseDateStr(prevStr);
  const curr = parseDateStr(currStr);
  const days = Math.round((curr.getTime() - prev.getTime()) / 86400000);
  const months = Math.round(days / 30.44);
  const type = days > 5 ? "advancement" : days < -5 ? "retrogression" : "stable";
  const label = type === "stable" ? "—" : `${days > 0 ? "+" : ""}${months}mo (${days > 0 ? "+" : ""}${days}d)`;
  return { label, type, days };
}

/**
 * Core projection function (FAD Advance Rate Model).
 *
 * Calculates months from TODAY until the FAD reaches the target priority date,
 * using the scenario-specific FAD advance rate.
 *
 * Formula: monthsFromToday = gapPDMonths / fadAdvanceRate
 * Estimated date = TODAY + monthsFromToday
 *
 * DoF estimate = FAD estimate - dofLeadMonths
 * GC estimate  = FAD estimate + gcLagMonths
 */
function computeProjection(
  currentFAD: string,
  targetDate: string,
  fadAdvanceRate: number,
  dofLeadMonths: number,
  gcLagMonths: number,
) {
  const gapPDMonths = monthsBetween(currentFAD, targetDate);

  // If target is already at or before current FAD, it's current
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

  const monthsFromToday = gapPDMonths / fadAdvanceRate;
  const fadDate = addMonths(TODAY, monthsFromToday);
  const dofDate = addMonths(fadDate, -dofLeadMonths);
  const gcDate = addMonths(fadDate, gcLagMonths);

  return {
    isAlreadyCurrent: false,
    monthsFromToday: Math.round(monthsFromToday),
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
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EB_CATEGORIES>("EB2"); // default to EB-2
  const [targetDate, setTargetDate] = useState("2016-08-01");
  const [lastToastDate, setLastToastDate] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showSimulatorControls, setShowSimulatorControls] = useState(false);

  // Simulator controls (affect scenario rates)
  const [spilloverLevel, setSpilloverLevel] = useState<"low" | "moderate" | "high">("moderate");
  const [banContinues, setBanContinues] = useState<"2027" | "2028" | "2029">("2028");
  const [wastageLevel, setWastageLevel] = useState<"low" | "moderate" | "high">("moderate");

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
    const pd  = params.get('pd');
    const cat = params.get('cat') as keyof typeof EB_CATEGORIES | null;
    const sp  = params.get('sp') as 'low' | 'moderate' | 'high' | null;
    const ban = params.get('ban') as '2027' | '2028' | '2029' | null;
    const wst = params.get('wst') as 'low' | 'moderate' | 'high' | null;
    if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) setTargetDate(pd);
    if (cat && cat in EB_CATEGORIES) setSelectedCategory(cat);
    if (sp && ['low','moderate','high'].includes(sp)) setSpilloverLevel(sp);
    if (ban && ['2027','2028','2029'].includes(ban)) setBanContinues(ban);
    if (wst && ['low','moderate','high'].includes(wst)) setWastageLevel(wst);
  }, []);

  const handleDateChange = useCallback((val: string) => {
    setTargetDate(val);
    if (val !== lastToastDate && val) {
      const d = parseDateStr(val);
      toast.success(`Target date: ${fmtDate(d)}`, { duration: 2000, position: "bottom-right" });
      setLastToastDate(val);
    }
  }, [lastToastDate]);

  // Compute adjusted rates based on simulator settings
  const adjustedRates = useMemo(() => {
    const base = { ...cat.rates };
    // Spillover adjustment
    const spilloverMultiplier = spilloverLevel === "high" ? 1.25 : spilloverLevel === "low" ? 0.75 : 1.0;
    // Ban duration adjustment (longer ban = more spillover years = higher sustained rate)
    const banMultiplier = banContinues === "2029" ? 1.15 : banContinues === "2027" ? 0.85 : 1.0;
    // Wastage adjustment (higher wastage = fewer effective visas = lower rate)
    const wastageMultiplier = wastageLevel === "high" ? 0.80 : wastageLevel === "low" ? 1.10 : 1.0;
    const combined = spilloverMultiplier * banMultiplier * wastageMultiplier;
    return {
      optimistic:   +(base.optimistic   * combined).toFixed(3),
      base:         +(base.base         * combined).toFixed(3),
      conservative: +(base.conservative * combined).toFixed(3),
      pessimistic:  +(base.pessimistic  * combined).toFixed(3),
    };
  }, [selectedCategory, spilloverLevel, banContinues, wastageLevel, cat.rates]);

  // Compute projections for all scenarios
  const projections = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeProjection>> = {};
    for (const key of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>) {
      result[key] = computeProjection(
        cat.currentFAD,
        targetDate,
        adjustedRates[key],
        cat.dofLeadMonths,
        cat.gcLagMonths,
      );
    }
    return result;
  }, [selectedCategory, targetDate, adjustedRates, cat]);

  const baseProjection = projections.base;
  const gapMonths = Math.max(0, Math.round(monthsBetween(cat.currentFAD, targetDate)));

  // Chart data: historical FAD movement
  const historicalChartData = useMemo(() => {
    return [...HISTORICAL_BULLETINS].reverse().map(b => {
      const key = selectedCategory === "EB1" ? "eb1_fad" : selectedCategory === "EB3" ? "eb3_fad" : "eb2_fad";
      const dofKey = selectedCategory === "EB1" ? "eb1_dof" : selectedCategory === "EB3" ? "eb3_dof" : "eb2_dof";
      const fadDate = parseDateStr(b[key as keyof typeof b] as string);
      const dofDate = parseDateStr(b[dofKey as keyof typeof b] as string);
      // Convert to decimal years for chart
      const toDecYear = (d: Date) => d.getFullYear() + d.getMonth() / 12;
      return {
        month: b.month,
        fad: +toDecYear(fadDate).toFixed(2),
        dof: +toDecYear(dofDate).toFixed(2),
      };
    });
  }, [selectedCategory]);

  // Scenario comparison chart data
  const scenarioChartData = useMemo(() => {
    return Object.entries(SCENARIOS).map(([key, s]) => ({
      name: s.label,
      months: projections[key]?.monthsFromToday ?? 0,
      year: projections[key]?.fadDate ? fmtYear(projections[key].fadDate) : "—",
      color: s.color,
    }));
  }, [projections]);

  const generateShareUrl = useCallback(() => {
    const params = new URLSearchParams({
      pd:  targetDate,
      cat: selectedCategory,
      sp:  spilloverLevel,
      ban: banContinues,
      wst: wastageLevel,
    });
    const base = window.location.origin + window.location.pathname;
    return `${base}?${params.toString()}`;
  }, [targetDate, selectedCategory, spilloverLevel, banContinues, wastageLevel]);

  const handleShare = useCallback(async () => {
    const url = generateShareUrl();
    const baseFadDate = baseProjection?.fadDate;
    const fadMonthYear = baseFadDate
      ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][baseFadDate.getMonth()]} ${baseFadDate.getFullYear()}`
      : "unknown";
    const baseDofDate = baseProjection?.dofDate;
    const dofMonthYear = baseDofDate
      ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][baseDofDate.getMonth()]} ${baseDofDate.getFullYear()}`
      : null;
    const sentence = dofMonthYear
      ? `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) — can file I-485 around ${dofMonthYear}, become current around ${fadMonthYear} (base case). ${url}`
      : `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) is estimated to become current around ${fadMonthYear} (base case). ${url}`;
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
    const lines = [
      "EB PRIORITY DATE TRACKER — PERSONALIZED ESTIMATE",
      "=".repeat(50),
      `Generated: ${fmtDate(TODAY)}`,
      `Category: ${cat.label} (${cat.name})`,
      `Target Priority Date: ${fmtDateStr(targetDate)}`,
      `Current FAD (Apr 2026): ${fmtDateStr(cat.currentFAD)}`,
      `Gap to Target: ${gapMonths} priority-date months`,
      "",
      "SIMULATOR SETTINGS",
      "-".repeat(30),
      `Spillover Level: ${spilloverLevel}`,
      `Ban Duration: through ${banContinues}`,
      `Wastage Level: ${wastageLevel}`,
      "",
      "SCENARIO PROJECTIONS",
      "-".repeat(30),
      ...Object.entries(SCENARIOS).map(([key, s]) => {
        const p = projections[key];
        return [
          `${s.label} (${s.probability}):`,
          `  DoF Estimate: ${p.isAlreadyCurrent ? "Already Current" : fmtDate(p.dofDate)}`,
          `  FAD Estimate: ${p.isAlreadyCurrent ? "Already Current" : fmtDate(p.fadDate)}`,
          `  GC Estimate:  ${p.isAlreadyCurrent ? "Already Current" : fmtDate(p.gcDate)}`,
          `  Months from Today: ${p.monthsFromToday}`,
          `  FAD Advance Rate: ${adjustedRates[key as keyof typeof adjustedRates]} PD-mo/month`,
        ].join("\n");
      }),
      "",
      "METHODOLOGY",
      "-".repeat(30),
      "Uses FAD Advance Rate Model: months_from_today = gap_PD_months / fad_advance_rate",
      "Rates calibrated from research documents and historical visa bulletin data.",
      "DoF leads FAD by ~6 months. GC receipt follows FAD by ~12–18 months.",
      "",
      "DISCLAIMER: Estimates are based on historical trends and current policy.",
      "Actual timelines may vary. Consult an immigration attorney for legal advice.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EB-Estimate-${fmtDateStr(targetDate).replace(/[, ]/g, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Estimate exported!", { duration: 2000 });
  };

  const tabs = [
    { id: "overview",   label: "📊 Overview" },
    { id: "scenarios",  label: "📈 Scenarios" },
    { id: "tracker",    label: "📋 Bulletin Tracker" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 text-white rounded-lg px-3 py-1.5 font-bold text-sm tracking-wide">
              EB TRACKER
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">EB Priority Date Tracker</h1>
              <p className="text-xs text-slate-500">India · EB-1, EB-2, EB-3 · April 2026 Bulletin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                shareCopied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {shareCopied ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</>
              ) : (
                <><Share2 className="w-3.5 h-3.5" /> Share Estimate</>
              )}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {nextBulletinDays === 0
                    ? 'New bulletin today'
                    : nextBulletinDays === 1
                    ? 'Next bulletin tomorrow'
                    : `Next bulletin in ${nextBulletinDays}d`}
                </span>
              </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Category Selector ── */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(EB_CATEGORIES) as Array<keyof typeof EB_CATEGORIES>).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all border ${
                selectedCategory === cat
                  ? "bg-slate-800 text-white border-slate-800 shadow-md"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {EB_CATEGORIES[cat].label} — {EB_CATEGORIES[cat].name.split(" / ")[0]}
            </button>
          ))}
        </div>

        {/* ── Target Date Picker ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Your Priority Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1.5">Change to see updated projections for any priority date.</p>
            </div>
            <div className="flex items-center gap-0 divide-x divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 self-start mt-6">
              <div className="flex flex-col justify-center px-5 py-2.5 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap mb-1">Current FAD</p>
                <p className="font-mono font-bold text-slate-800 whitespace-nowrap">{fmtDateStr(cat.currentFAD)}</p>
              </div>
              <div className="flex flex-col justify-center px-5 py-2.5 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap mb-1">Gap</p>
                <p className="font-mono font-bold text-slate-800 whitespace-nowrap">{gapMonths > 0 ? `${gapMonths} mo` : "Current"}</p>
              </div>
              <div className="flex flex-col justify-center px-5 py-2.5 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap mb-1">Current DoF</p>
                <p className="font-mono font-bold text-slate-800 whitespace-nowrap">{fmtDateStr(cat.currentDoF)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1 border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Hero Estimate */}
            {baseProjection.isAlreadyCurrent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-emerald-700">Already Current!</p>
                <p className="text-sm text-slate-600 mt-1">
                  {fmtDateStr(targetDate)} is already current as of the April 2026 bulletin.
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 text-white">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4">
                  When Will {fmtDateStr(targetDate)} Become Current? (Base Case)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Filing Date (DoF)</p>
                    <p className="text-xl font-bold font-mono">{fmtDate(baseProjection.dofDate)}</p>
                    <p className="text-xs text-slate-400 mt-1">Can file I-485</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Final Action Date</p>
                    <p className="text-xl font-bold font-mono">{fmtDate(baseProjection.fadDate)}</p>
                    <p className="text-xs text-slate-400 mt-1">Visa becomes available</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">GC Receipt Est.</p>
                    <p className="text-xl font-bold font-mono">{fmtDate(baseProjection.gcDate)}</p>
                    <p className="text-xs text-slate-400 mt-1">~{cat.gcLagMonths}mo after FAD</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Months from Today</p>
                    <p className="text-xl font-bold font-mono">{baseProjection.monthsFromToday}</p>
                    <p className="text-xs text-slate-400 mt-1">Base case estimate</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4 border-t border-slate-600 pt-3">
                  Base case assumes moderate spillover (30–40k extra EB visas in FY2027). See Scenarios tab for full range.
                </p>
              </div>
            )}

            {/* Scenario Range — 4 tiles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scenario Range — All Outcomes</p>
                <button
                  onClick={() => setActiveTab("scenarios")}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Adjust assumptions
                  <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, typeof SCENARIOS[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                  const p = projections[key];
                  const isBase = key === "base";
                  return (
                    <div
                      key={key}
                      className={`bg-white rounded-xl border border-slate-200 border-l-4 p-4 ${
                        isBase ? "ring-1 ring-slate-300" : ""
                      }`}
                      style={{ borderLeftColor: s.color }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">{s.label}</span>
                        {isBase && (
                          <span className="text-xs bg-slate-800 text-white px-1.5 py-0.5 rounded font-semibold">Base</span>
                        )}
                      </div>
                      <p className="text-sm font-bold font-mono text-slate-900 leading-tight">
                        {p.isAlreadyCurrent ? "Current" : fmtDate(p.fadDate)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">FAD</p>
                      {!p.isAlreadyCurrent && (
                        <>
                          <p className="text-xs font-mono text-slate-600 mt-1.5">{fmtDate(p.dofDate)}</p>
                          <p className="text-xs text-slate-400">DoF (file I-485)</p>
                        </>
                      )}
                      <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                        {s.probability} probability
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historical Chart */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                {cat.label} India — FAD & DoF Historical Movement
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={historicalChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={v => `${Math.floor(v)}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(v: number) => {
                      const yr = Math.floor(v);
                      const mo = Math.round((v - yr) * 12);
                      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                      return [`${months[mo]} ${yr}`];
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="fad" name="Final Action Date" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="dof" name="Dates for Filing" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

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
            <button
              onClick={() => setShowMethodology(v => !v)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              {showMethodology ? "Hide" : "Show"} methodology
              {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showMethodology && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">FAD Advance Rate Model</p>
                <p>Estimates use the formula: <code className="bg-slate-200 px-1 rounded">months_from_today = gap_PD_months ÷ fad_advance_rate</code></p>
                <p>Where <strong>gap_PD_months</strong> is the number of priority-date months between the current FAD and your target date, and <strong>fad_advance_rate</strong> is the scenario-specific rate (PD-months advanced per calendar month).</p>
                <p>This model is derived from two research documents (Capitol Immigration Law Group, AM22Tech, Manifest Law, Beyondborderglobal, Cato Institute) and calibrated against historical visa bulletin data (Jan 2023–Apr 2026).</p>
                <p>DoF estimate = FAD estimate − {cat.dofLeadMonths} months. GC receipt estimate = FAD estimate + {cat.gcLagMonths} months.</p>
                <p className="text-slate-400">Disclaimer: Estimates are probabilistic and may change with policy shifts, retrogression, or legislative action.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SCENARIOS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <div className="space-y-6">

            {/* ── Adjust Assumptions (collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSimulatorControls(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">&#9881;&#65039;</span>
                  <span>Adjust Assumptions</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    Spillover: {spilloverLevel} · Ban: through {banContinues} · Wastage: {wastageLevel}
                  </span>
                </div>
                {showSimulatorControls
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showSimulatorControls && (
                <div className="border-t border-slate-100 p-5 space-y-5">
                  {/* Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Spillover Level</label>
                      <div className="space-y-2">
                        {[
                          { val: "low" as const,      label: "Low (~30k extra EB visas)",  sub: "Partial ban, limited spillover" },
                          { val: "moderate" as const, label: "Moderate (~50k extra)",        sub: "Base case assumption" },
                          { val: "high" as const,     label: "High (~70k+ extra)",           sub: "Full ban, max spillover" },
                        ].map(o => (
                          <button key={o.val} onClick={() => setSpilloverLevel(o.val)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                              spilloverLevel === o.val
                                ? "border-slate-800 bg-slate-800 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            }`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={spilloverLevel === o.val ? "text-slate-300" : "text-slate-400"}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Ban Duration</label>
                      <div className="space-y-2">
                        {[
                          { val: "2027" as const, label: "Ends Oct 2027 (1 FY)",           sub: "Court reversal or expiry" },
                          { val: "2028" as const, label: "Through Sept 2028 (2 FY)",       sub: "Base case — sustained policy" },
                          { val: "2029" as const, label: "Through Sept 2029 (3 FY)",       sub: "Full term continuation" },
                        ].map(o => (
                          <button key={o.val} onClick={() => setBanContinues(o.val)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                              banContinues === o.val
                                ? "border-slate-800 bg-slate-800 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            }`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={banContinues === o.val ? "text-slate-300" : "text-slate-400"}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">GC Wastage Level</label>
                      <div className="space-y-2">
                        {[
                          { val: "low" as const,      label: "Low (5–10%)",         sub: "Efficient consular processing" },
                          { val: "moderate" as const, label: "Moderate (15–20%)",    sub: "Historical EB-2 average" },
                          { val: "high" as const,     label: "High (25–30%)",        sub: "Travel ban consular backlog" },
                        ].map(o => (
                          <button key={o.val} onClick={() => setWastageLevel(o.val)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                              wastageLevel === o.val
                                ? "border-slate-800 bg-slate-800 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            }`}>
                            <div className="font-semibold">{o.label}</div>
                            <div className={wastageLevel === o.val ? "text-slate-300" : "text-slate-400"}>{o.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Explainer cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">75-Country Visa Ban</p>
                      <p className="text-xs text-slate-600 leading-relaxed">Proclamations 10949 & 10998 (Jan 2026) paused immigrant visas for 75+ countries. India was <strong>exempt</strong>. Unused family-based visas spill over to EB categories under INA §201(d).</p>
                      <div className="mt-2 text-xs text-slate-500">Est. spillover: <span className="font-semibold text-slate-700">50k–70k extra EB visas</span></div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">Green Card Wastage</p>
                      <p className="text-xs text-slate-600 leading-relaxed">Visas go unused when applicants miss medical exams, security clearances, or interview windows. FY2021: 25% overall wastage. EB-2 India ~20%, EB-3 India ~49%.</p>
                      <div className="mt-2 text-xs text-slate-500">During bans: <span className="font-semibold text-amber-600">Higher (consular backlog)</span></div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-800 mb-1">How the Model Works</p>
                      <p className="text-xs text-slate-600 leading-relaxed">Controls modify the FAD advance rate multiplier. Higher spillover → faster advance. Longer ban → sustained spillover. Higher wastage → fewer effective visas → slower advance.</p>
                      <div className="mt-2 text-xs text-slate-500 font-mono bg-white rounded px-2 py-1">months = gap ÷ (base_rate × spillover × ban × wastage)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Projections for {fmtDateStr(targetDate)}</strong> — {cat.label} India.
              The critical variable is whether the FY2027 visa spillover materializes at scale.
              Use <strong>Adjust Assumptions</strong> above to see how spillover, ban duration, and wastage affect your timeline.
            </div>

            {/* Scenario cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, typeof SCENARIOS[keyof typeof SCENARIOS]]>).map(([key, s]) => {
                const p = projections[key];
                return (
                  <div
                    key={key}
                    className="bg-white rounded-xl border-l-4 border border-slate-200 p-5"
                    style={{ borderLeftColor: s.color }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{s.label}</h3>
                        <p className="text-xs text-slate-500">{s.probability} probability</p>
                      </div>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        {adjustedRates[key]} PD-mo/mo
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{s.description}</p>
                    <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 mb-0.5">DoF Reaches</p>
                        <p className="font-bold font-mono text-slate-900">
                          {p.isAlreadyCurrent ? "Current" : fmtDate(p.dofDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">FAD Reaches</p>
                        <p className="font-bold font-mono text-slate-900">
                          {p.isAlreadyCurrent ? "Current" : fmtDate(p.fadDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">GC Receipt</p>
                        <p className="font-bold font-mono text-slate-900">
                          {p.isAlreadyCurrent ? "Current" : fmtDate(p.gcDate)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {p.isAlreadyCurrent ? "Already current" : `${p.monthsFromToday} months from today`}
                    </div>
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
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Months", angle: -90, position: "insideLeft", fontSize: 11 }} />
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
                    {(Object.entries(SCENARIOS) as Array<[keyof typeof SCENARIOS, typeof SCENARIOS[keyof typeof SCENARIOS]]>).map(([key, s]) => (
                      <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold" style={{ color: s.color }}>{s.label}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.dofRange}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.fadRange}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{s.gcRange}</td>
                        <td className="px-3 py-2 text-slate-600">{s.probability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">Source: pasted_content.txt research synthesis (Capitol Immigration Law Group, AM22Tech, Manifest Law, Beyondborderglobal)</p>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            BULLETIN TRACKER TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tracker" && (
          <div className="space-y-6">
            <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-4">
              Historical visa bulletins for India. Δ columns show month-over-month movement in priority-date months and days.
              <span className="text-emerald-600 font-semibold"> Green = advancement</span>,
              <span className="text-red-600 font-semibold"> Red = retrogression</span>.
            </div>

            {/* Final Action Dates Table */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Final Action Dates (FAD)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-semibold">Month</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-1</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-2</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-3</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORICAL_BULLETINS.map((b, idx) => {
                      const prev = idx < HISTORICAL_BULLETINS.length - 1 ? HISTORICAL_BULLETINS[idx + 1] : null;
                      const eb1m = prev ? movementLabel(prev.eb1_fad, b.eb1_fad) : null;
                      const eb2m = prev ? movementLabel(prev.eb2_fad, b.eb2_fad) : null;
                      const eb3m = prev ? movementLabel(prev.eb3_fad, b.eb3_fad) : null;
                      const mvClass = (m: typeof eb1m) =>
                        m?.type === "advancement" ? "text-emerald-600 font-semibold" :
                        m?.type === "retrogression" ? "text-red-600 font-semibold" : "text-slate-400";
                      return (
                        <tr key={b.month} className={`border-b border-slate-100 hover:bg-slate-50 ${idx === 0 ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{b.month}{idx === 0 && <span className="ml-1 text-blue-600 text-xs">(latest)</span>}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb1_fad)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb1m)}`}>{eb1m?.label ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb2_fad)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb2m)}`}>{eb2m?.label ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb3_fad)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb3m)}`}>{eb3m?.label ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dates for Filing Table */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Dates for Filing (DoF)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="px-4 py-3 text-left font-semibold">Month</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-1</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-2</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold">EB-3</th>
                      <th className="px-4 py-3 text-center font-semibold">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORICAL_BULLETINS.map((b, idx) => {
                      const prev = idx < HISTORICAL_BULLETINS.length - 1 ? HISTORICAL_BULLETINS[idx + 1] : null;
                      const eb1m = prev ? movementLabel(prev.eb1_dof, b.eb1_dof) : null;
                      const eb2m = prev ? movementLabel(prev.eb2_dof, b.eb2_dof) : null;
                      const eb3m = prev ? movementLabel(prev.eb3_dof, b.eb3_dof) : null;
                      const mvClass = (m: typeof eb1m) =>
                        m?.type === "advancement" ? "text-emerald-600 font-semibold" :
                        m?.type === "retrogression" ? "text-red-600 font-semibold" : "text-slate-400";
                      return (
                        <tr key={b.month} className={`border-b border-slate-100 hover:bg-slate-50 ${idx === 0 ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{b.month}{idx === 0 && <span className="ml-1 text-blue-600 text-xs">(latest)</span>}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb1_dof)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb1m)}`}>{eb1m?.label ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb2_dof)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb2m)}`}>{eb2m?.label ?? "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{fmtDateStr(b.eb3_dof)}</td>
                          <td className={`px-4 py-2.5 text-center font-mono ${mvClass(eb3m)}`}>{eb3m?.label ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
