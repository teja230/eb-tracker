/*
 * EB-2 India Priority Date Tracker — Home Page (Accurate Spillover Model)
 * Design: Civic Tech Policy Dashboard
 * Feature: 50k–70k spillover estimates, multi-year projections, legal status, date selection feedback
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { toast } from "sonner";

// ─── Utility Functions ────────────────────────────────────────────────────────

function dateToNumeric(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getFullYear() + d.getMonth() / 12;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function calculateMonthsDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

// ─── Data ────────────────────────────────────────────────────────────────────

const CURRENT_FAD = "2014-07-15";
const CURRENT_FAD_NUMERIC = dateToNumeric(CURRENT_FAD);

const historicalData = [
  { label: "Jan 2020", date: 2020.0, displayDate: "2009-05-18", movement: 0 },
  { label: "Feb 2020", date: 2020.08, displayDate: "2009-05-19", movement: 0 },
  { label: "Mar 2020", date: 2020.17, displayDate: "2009-05-22", movement: 0 },
  { label: "Apr 2020", date: 2020.25, displayDate: "2009-05-25", movement: 0 },
  { label: "May 2020", date: 2020.33, displayDate: "2009-06-02", movement: 0 },
  { label: "Jun 2020", date: 2020.42, displayDate: "2009-06-12", movement: 0 },
  { label: "Jul 2020", date: 2020.5, displayDate: "2009-07-08", movement: 1 },
  { label: "Aug 2020", date: 2020.58, displayDate: "2009-07-08", movement: 0 },
  { label: "Sep 2020", date: 2020.67, displayDate: "2009-07-08", movement: 0 },
  { label: "Oct 2020", date: 2020.75, displayDate: "2009-09-01", movement: 2 },
  { label: "Nov 2020", date: 2020.83, displayDate: "2009-09-22", movement: 0 },
  { label: "Dec 2020", date: 2020.92, displayDate: "2009-10-01", movement: 0 },
  { label: "Jan 2021", date: 2021.0, displayDate: "2009-10-08", movement: 0 },
  { label: "Feb 2021", date: 2021.08, displayDate: "2009-10-12", movement: 0 },
  { label: "Mar 2021", date: 2021.17, displayDate: "2010-01-15", movement: 3 },
  { label: "Apr 2021", date: 2021.25, displayDate: "2010-05-01", movement: 4 },
  { label: "May 2021", date: 2021.33, displayDate: "2010-08-01", movement: 3 },
  { label: "Jun 2021", date: 2021.42, displayDate: "2010-12-01", movement: 4 },
  { label: "Jul 2021", date: 2021.5, displayDate: "2011-06-01", movement: 6 },
  { label: "Aug 2021", date: 2021.58, displayDate: "2011-06-01", movement: 0 },
  { label: "Sep 2021", date: 2021.67, displayDate: "2011-09-01", movement: 3 },
  { label: "Oct 2021", date: 2021.75, displayDate: "2011-09-01", movement: 0 },
  { label: "Nov 2021", date: 2021.83, displayDate: "2011-12-01", movement: 3 },
  { label: "Dec 2021", date: 2021.92, displayDate: "2012-05-01", movement: 5 },
  { label: "Jan 2022", date: 2022.0, displayDate: "2012-07-08", movement: 2 },
  { label: "Feb 2022", date: 2022.08, displayDate: "2013-01-01", movement: 6 },
  { label: "Mar 2022", date: 2022.17, displayDate: "2013-05-01", movement: 4 },
  { label: "Apr 2022", date: 2022.25, displayDate: "2013-07-08", movement: 2 },
  { label: "May 2022", date: 2022.33, displayDate: "2013-09-01", movement: 2 },
  { label: "Jun 2022", date: 2022.42, displayDate: "2014-09-01", movement: 12 },
  { label: "Jul 2022", date: 2022.5, displayDate: "2014-12-01", movement: 3 },
  { label: "Aug 2022", date: 2022.58, displayDate: "2014-12-01", movement: 0 },
  { label: "Sep 2022", date: 2022.67, displayDate: "2014-12-01", movement: 0 },
  { label: "Oct 2022", date: 2022.75, displayDate: "2012-04-01", movement: -32, retrogression: true },
  { label: "Nov 2022", date: 2022.83, displayDate: "2012-04-01", movement: 0 },
  { label: "Dec 2022", date: 2022.92, displayDate: "2011-10-08", movement: -6, retrogression: true },
  { label: "Jan 2023", date: 2023.0, displayDate: "2011-10-08", movement: 0 },
  { label: "Feb 2023", date: 2023.08, displayDate: "2011-10-08", movement: 0 },
  { label: "Mar 2023", date: 2023.17, displayDate: "2011-10-08", movement: 0 },
  { label: "Apr 2023", date: 2023.25, displayDate: "2011-01-01", movement: -9, retrogression: true },
  { label: "May 2023", date: 2023.33, displayDate: "2011-01-01", movement: 0 },
  { label: "Jun 2023", date: 2023.42, displayDate: "2011-01-01", movement: 0 },
  { label: "Jul 2023", date: 2023.5, displayDate: "2011-01-01", movement: 0 },
  { label: "Aug 2023", date: 2023.58, displayDate: "2011-01-01", movement: 0 },
  { label: "Sep 2023", date: 2023.67, displayDate: "2011-01-01", movement: 0 },
  { label: "Oct 2023", date: 2023.75, displayDate: "2012-01-01", movement: 12 },
  { label: "Nov 2023", date: 2023.83, displayDate: "2012-01-01", movement: 0 },
  { label: "Dec 2023", date: 2023.92, displayDate: "2012-01-01", movement: 0 },
  { label: "Jan 2024", date: 2024.0, displayDate: "2012-03-01", movement: 2 },
  { label: "Feb 2024", date: 2024.08, displayDate: "2012-03-01", movement: 0 },
  { label: "Mar 2024", date: 2024.17, displayDate: "2012-03-01", movement: 0 },
  { label: "Apr 2024", date: 2024.25, displayDate: "2012-04-01", movement: 1 },
  { label: "May 2024", date: 2024.33, displayDate: "2012-04-15", movement: 0.5 },
  { label: "Jun 2024", date: 2024.42, displayDate: "2012-04-15", movement: 0 },
  { label: "Jul 2024", date: 2024.5, displayDate: "2012-06-15", movement: 2 },
  { label: "Aug 2024", date: 2024.58, displayDate: "2012-07-15", movement: 1 },
  { label: "Sep 2024", date: 2024.67, displayDate: "2012-07-15", movement: 0 },
  { label: "Oct 2024", date: 2024.75, displayDate: "2012-07-15", movement: 0 },
  { label: "Nov 2024", date: 2024.83, displayDate: "2012-07-15", movement: 0 },
  { label: "Dec 2024", date: 2024.92, displayDate: "2012-08-01", movement: 0.5 },
  { label: "Jan 2025", date: 2025.0, displayDate: "2012-10-01", movement: 2 },
  { label: "Feb 2025", date: 2025.08, displayDate: "2012-10-15", movement: 0.5 },
  { label: "Mar 2025", date: 2025.17, displayDate: "2012-12-01", movement: 1.5 },
  { label: "Apr 2025", date: 2025.25, displayDate: "2013-01-01", movement: 1 },
  { label: "May 2025", date: 2025.33, displayDate: "2013-01-01", movement: 0 },
  { label: "Jun 2025", date: 2025.42, displayDate: "2013-01-01", movement: 0 },
  { label: "Jul 2025", date: 2025.5, displayDate: "2013-01-01", movement: 0 },
  { label: "Aug 2025", date: 2025.58, displayDate: "2013-01-01", movement: 0 },
  { label: "Sep 2025", date: 2025.67, displayDate: "2013-01-01", movement: 0 },
  { label: "Oct 2025", date: 2025.75, displayDate: "2013-04-01", movement: 3 },
  { label: "Nov 2025", date: 2025.83, displayDate: "2013-04-01", movement: 0 },
  { label: "Dec 2025", date: 2025.92, displayDate: "2013-05-15", movement: 1.5 },
  { label: "Jan 2026", date: 2026.0, displayDate: "2013-07-15", movement: 2 },
  { label: "Feb 2026", date: 2026.08, displayDate: "2013-07-15", movement: 0 },
  { label: "Mar 2026", date: 2026.17, displayDate: "2013-09-15", movement: 2 },
  { label: "Apr 2026", date: 2026.25, displayDate: "2014-07-15", movement: 10, exceptional: true },
];

const chartData = historicalData.map((d) => ({
  ...d,
  fadNumeric: dateToNumeric(d.displayDate),
}));

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const isRetrogression = d.retrogression;
    const isExceptional = d.exceptional;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm max-w-[220px]">
        <p className="font-semibold text-slate-800 mb-1">{d.label}</p>
        <p className="font-mono text-slate-700">FAD: <span className="font-medium">{formatDateDisplay(d.displayDate)}</span></p>
        {d.movement !== 0 && (
          <p className={`mt-1 font-mono text-xs ${isRetrogression ? "text-red-600" : isExceptional ? "text-teal-600 font-semibold" : "text-blue-600"}`}>
            {isRetrogression ? "▼" : "▲"} {Math.abs(d.movement)} months {isRetrogression ? "(retrogression)" : isExceptional ? "(exceptional jump)" : ""}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [targetDate, setTargetDate] = useState("2016-08-01");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [spilloverEstimate, setSpilloverEstimate] = useState<"50k" | "70k">("50k");
  const [banDuration, setBanDuration] = useState<"fy2027" | "fy2028" | "fy2029">("fy2028");
  const prevTargetRef = useRef(targetDate);

  // Parse target date
  const targetDateNumeric = useMemo(() => dateToNumeric(targetDate), [targetDate]);
  const targetDateDisplay = useMemo(() => formatDateDisplay(targetDate), [targetDate]);

  // Show toast when date changes
  useEffect(() => {
    if (prevTargetRef.current !== targetDate) {
      const months = calculateMonthsDifference(CURRENT_FAD, targetDate);
      const years = (months / 12).toFixed(1);
      toast.success(`Target date updated: ${targetDateDisplay} (${months} months / ${years} years away)`, {
        duration: 3000,
        position: "top-center",
      });
      prevTargetRef.current = targetDate;
    }
  }, [targetDate, targetDateDisplay]);

  // Calculate gap
  const gapMonths = useMemo(() => {
    return calculateMonthsDifference(CURRENT_FAD, targetDate);
  }, [targetDate]);

  const gapYears = gapMonths / 12;

  // ─── Spillover Calculations ───────────────────────────────────────────────────

  // Spillover amounts
  const spilloverAmount = spilloverEstimate === "50k" ? 50000 : 70000;
  
  // EB-2 India allocation from spillover
  // Formula: min(28.6% of (140k + spillover), 7% of (140k + spillover))
  const totalEBPool = 140000 + spilloverAmount;
  const eb2Share = 0.286 * totalEBPool;
  const perCountryCap = 0.07 * totalEBPool;
  const eb2IndiaAllocation = Math.min(eb2Share, perCountryCap);
  const baselineAllocation = Math.min(0.286 * 140000, 0.07 * 140000); // ~9,800
  const additionalVisas = eb2IndiaAllocation - baselineAllocation;

  // Monthly rates based on allocation
  const baselineMonthlyRate = 2.5; // 9,800 / 12 ≈ 2.5 months/year
  const fy2027MonthlyRate = (additionalVisas + baselineAllocation) / 12; // ~3.5–4 months/year
  const fy2028MonthlyRate = fy2027MonthlyRate; // Same as FY 2027 if spillover continues
  const sustainedMonthlyRate = (additionalVisas * 0.7 + baselineAllocation) / 12; // ~3–3.5 months/year if spillover continues

  // Projection scenarios
  const projectionScenarios = useMemo(() => {
    let fy2027Rate = baselineMonthlyRate;
    let fy2028Rate = baselineMonthlyRate;
    let fy2029Rate = baselineMonthlyRate;
    let allocationNote = "Baseline (no spillover)";

    if (banDuration === "fy2027") {
      fy2027Rate = fy2027MonthlyRate;
      allocationNote = `FY 2027 spillover only (${spilloverEstimate} spillover)`;
    } else if (banDuration === "fy2028") {
      fy2027Rate = fy2027MonthlyRate;
      fy2028Rate = fy2027MonthlyRate;
      allocationNote = `FY 2027–2028 spillover (${spilloverEstimate} spillover)`;
    } else if (banDuration === "fy2029") {
      fy2027Rate = fy2027MonthlyRate;
      fy2028Rate = fy2027MonthlyRate;
      fy2029Rate = fy2027MonthlyRate;
      allocationNote = `FY 2027–2029 spillover (${spilloverEstimate} spillover)`;
    }

    const scenarios = [
      {
        name: "Optimistic",
        description: "Ban continues + sustained spillover (~5 months/year)",
        annualRate: 5,
        color: "#0D9488",
        bgColor: "bg-teal-50",
        textColor: "text-teal-700",
        borderColor: "border-teal-200",
        dotColor: "bg-teal-500",
        probability: "Low",
        note: "Requires ban to remain through 2029 and no legal reversals",
      },
      {
        name: "Base Case",
        description: `Ban continues through FY 2028 (~${fy2027Rate.toFixed(1)} mo/yr FY27, then ${fy2028Rate.toFixed(1)} mo/yr)`,
        annualRate: (fy2027Rate + fy2028Rate) / 2,
        color: "#2563EB",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
        dotColor: "bg-blue-500",
        probability: "High",
        note: allocationNote,
      },
      {
        name: "Conservative",
        description: "Ban ends by Oct 2027 (~3 mo/yr FY27, then 2.5 mo/yr)",
        annualRate: 2.75,
        color: "#D97706",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        borderColor: "border-amber-200",
        dotColor: "bg-amber-500",
        probability: "Moderate",
        note: "Court issues preliminary injunction in late 2026",
      },
      {
        name: "Pessimistic",
        description: "Ban ends immediately (~2.5 months/year baseline)",
        annualRate: 2.5,
        color: "#DC2626",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        dotColor: "bg-red-500",
        probability: "Low",
        note: "Unlikely given indefinite ban status",
      },
    ];

    return scenarios.map((s) => {
      const monthsNeeded = gapMonths / (s.annualRate / 12);
      const calendarMonthsNeeded = Math.round(monthsNeeded);
      const estimatedDate = new Date(2026, 3, 1); // April 2026
      estimatedDate.setMonth(estimatedDate.getMonth() + calendarMonthsNeeded);
      const estimatedYear = estimatedDate.getFullYear() + estimatedDate.getMonth() / 12;
      const estimatedDateStr = estimatedDate.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });

      return {
        ...s,
        estimatedDate: estimatedDateStr,
        estimatedYear,
        monthsNeeded: calendarMonthsNeeded,
      };
    });
  }, [gapMonths, spilloverEstimate, banDuration, fy2027MonthlyRate, fy2028MonthlyRate]);

  // Progress bar calculation
  const progressPct = useMemo(() => {
    const startNumeric = 2009.0;
    const totalRange = targetDateNumeric - startNumeric;
    const currentProgress = CURRENT_FAD_NUMERIC - startNumeric;
    return (currentProgress / totalRange) * 100;
  }, [targetDateNumeric]);

  const displayedData = showAllHistory ? chartData : chartData.slice(-30);

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.975 0.005 240)" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="container">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ background: "oklch(0.35 0.1 240)" }}>
                EB
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-800 leading-none">EB-2 India Priority Date Tracker</h1>
                <p className="text-xs text-slate-500 mt-0.5">Dynamic Forecast Report</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-badge" style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.35 0.1 240)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse inline-block" />
                April 2026 Bulletin
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-10">

        {/* ── Priority Date Picker ── */}
        <section className="animate-fade-in-up">
          <div className="metric-card" style={{ background: "oklch(0.94 0.01 240)", border: "2px solid oklch(0.35 0.1 240)" }}>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Select Target Priority Date
                </label>
                <p className="text-xs text-slate-500">
                  Change the date to see updated projections and gap analysis
                </p>
              </div>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                <strong>Target:</strong> <span className="font-mono font-semibold text-slate-800">{targetDateDisplay}</span>
                {" "}
                <span className="text-slate-500">({gapMonths} months / {gapYears.toFixed(2)} years from current FAD)</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Spillover & Ban Duration Controls ── */}
        <section className="animate-fade-in-up grid md:grid-cols-2 gap-6">
          {/* Spillover Estimate */}
          <div className="metric-card border border-slate-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Spillover Estimate
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  The 75-country ban pauses family-based visas, creating unused allocations that spill to employment-based categories in FY 2027.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSpilloverEstimate("50k")}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 text-center transition-all font-medium ${
                    spilloverEstimate === "50k"
                      ? "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-offset-1 ring-blue-400"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold">50,000 Spillover</p>
                  <p className="text-xs text-slate-600 mt-1">~3,500 EB-2 India visas</p>
                </button>
                <button
                  onClick={() => setSpilloverEstimate("70k")}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 text-center transition-all font-medium ${
                    spilloverEstimate === "70k"
                      ? "bg-teal-50 border-teal-300 text-teal-700 ring-2 ring-offset-1 ring-teal-400"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold">70,000 Spillover</p>
                  <p className="text-xs text-slate-600 mt-1">~4,900 EB-2 India visas</p>
                </button>
              </div>
            </div>
          </div>

          {/* Ban Duration */}
          <div className="metric-card border border-slate-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Ban Duration Assumption
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  The ban is indefinite with no expiration date. Legal challenges are ongoing (CLINIC v. Rubio).
                </p>
              </div>
              <div className="space-y-2">
                {[
                  { value: "fy2027", label: "Ban Ends Oct 2027", desc: "Court issues injunction" },
                  { value: "fy2028", label: "Ban Continues to Sept 2028", desc: "Most likely scenario" },
                  { value: "fy2029", label: "Ban Continues to Sept 2029", desc: "Full term duration" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setBanDuration(opt.value as any)}
                    className={`w-full px-4 py-2.5 rounded-lg border-2 text-left transition-all ${
                      banDuration === opt.value
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Hero Section ── */}
        <section className="animate-fade-in-up">
          <div className="rounded-2xl overflow-hidden" style={{ background: "oklch(0.22 0.06 240)" }}>
            <div className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="space-y-3 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium"
                    style={{ background: "oklch(0.55 0.18 195 / 0.2)", color: "oklch(0.75 0.15 195)" }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "oklch(0.75 0.15 195)" }} />
                    Research Report · March 2026
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight" style={{ color: "oklch(0.95 0.01 240)" }}>
                    When Will EB-2 India<br />
                    <span style={{ color: "oklch(0.75 0.15 195)" }}>{targetDateDisplay}</span> Become Current?
                  </h2>
                  <p className="text-base leading-relaxed" style={{ color: "oklch(0.72 0.03 240)" }}>
                    Analysis of 50k–70k family-based visa spillover, per-country cap constraints, ban legal status, and multi-year priority date movement projections.
                  </p>
                </div>

                {/* Key stat */}
                <div className="flex-shrink-0">
                  <div className="rounded-xl p-6 text-center min-w-[200px]"
                    style={{ background: "oklch(0.28 0.07 240)", border: "1px solid oklch(0.35 0.08 240)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "oklch(0.6 0.04 240)" }}>
                      Best Estimate Range
                    </p>
                    <p className="text-3xl font-bold font-mono mb-1" style={{ color: "oklch(0.75 0.15 195)" }}>
                      {projectionScenarios[1].estimatedDate}
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.6 0.04 240)" }}>
                      Final Action Date current (Base Case)
                    </p>
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid oklch(0.35 0.08 240)" }}>
                      <p className="text-xs" style={{ color: "oklch(0.6 0.04 240)" }}>Gap to close</p>
                      <p className="text-lg font-mono font-semibold" style={{ color: "oklch(0.85 0.1 70)" }}>
                        {gapMonths} months
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── KPI Cards ── */}
        <section>
          <div className="section-header">
            <h2 className="text-lg font-semibold text-slate-800">Current Status & Spillover Impact</h2>
            <span className="text-sm text-slate-500 font-mono">April 2026 Visa Bulletin</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Final Action Date",
                value: formatDateDisplay(CURRENT_FAD),
                sub: "EB-2 India FAD",
                color: "text-blue-700",
                accent: "bg-blue-50 border-blue-100",
                icon: "📅",
              },
              {
                label: "Baseline Allocation",
                value: "~9,800",
                sub: "EB-2 India visas/year",
                color: "text-slate-700",
                accent: "bg-slate-50 border-slate-100",
                icon: "🎫",
              },
              {
                label: "FY 2027 Spillover",
                value: `+${Math.round(additionalVisas).toLocaleString()}`,
                sub: `(${spilloverEstimate} spillover)`,
                color: "text-teal-700",
                accent: "bg-teal-50 border-teal-100",
                icon: "📈",
              },
              {
                label: "Gap to Target",
                value: `~${gapMonths} months`,
                sub: `${formatDateDisplay(CURRENT_FAD)} → ${targetDateDisplay}`,
                color: "text-amber-700",
                accent: "bg-amber-50 border-amber-100",
                icon: "⏳",
              },
            ].map((card) => (
              <div key={card.label} className={`metric-card border ${card.accent}`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <span className="text-lg">{card.icon}</span>
                </div>
                <p className={`text-xl md:text-2xl font-mono font-semibold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Progress Bar ── */}
        <section>
          <div className="metric-card">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Priority Date Progress</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-slate-500">
                <span>Jan 2009</span>
                <span className="text-blue-700 font-semibold">Current: {formatDateDisplay(CURRENT_FAD)}</span>
                <span className="text-amber-600 font-semibold">Target: {targetDateDisplay}</span>
              </div>
              <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-amber-500"
                  style={{ left: `${Math.max(0, Math.min(100, progressPct + (gapMonths / 96) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{Math.max(0, Math.min(100, progressPct)).toFixed(1)}% of the way to target</span>
                <span className="text-amber-600">~{gapMonths} months remaining</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Historical Chart ── */}
        <section>
          <div className="metric-card">
            <div className="flex items-start justify-between mb-6">
              <div className="section-header mb-0">
                <h2 className="text-lg font-semibold text-slate-800">Historical Final Action Date Movement</h2>
              </div>
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {showAllHistory ? "Show Recent (30 mo)" : "Show All (2020–2026)"}
              </button>
            </div>

            <div className="h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "DM Mono" }}
                    tickLine={false}
                    interval={showAllHistory ? 5 : 2}
                  />
                  <YAxis
                    domain={[2009, Math.max(2017, targetDateNumeric + 1)]}
                    tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "DM Mono" }}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.floor(v)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={targetDateNumeric}
                    stroke="#D97706"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={{ value: `Target: ${targetDateDisplay}`, position: "insideTopRight", fontSize: 11, fill: "#D97706", fontFamily: "DM Mono" }}
                  />
                  <ReferenceLine
                    y={CURRENT_FAD_NUMERIC}
                    stroke="#2563EB"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                    label={{ value: "Current FAD", position: "insideBottomRight", fontSize: 10, fill: "#2563EB", fontFamily: "DM Mono" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fadNumeric"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#fadGradient)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.retrogression) {
                        return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#DC2626" stroke="white" strokeWidth={2} />;
                      }
                      if (payload.exceptional) {
                        return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={6} fill="#0D9488" stroke="white" strokeWidth={2} />;
                      }
                      return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="#2563EB" />;
                    }}
                    activeDot={{ r: 6, fill: "#2563EB", stroke: "white", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
                FAD movement
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                Retrogression event
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-teal-500 flex-shrink-0" />
                Exceptional advance
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-0.5 bg-amber-500 flex-shrink-0" />
                Target date
              </div>
            </div>
          </div>
        </section>

        {/* ── Scenario Projections ── */}
        <section>
          <div className="section-header">
            <h2 className="text-lg font-semibold text-slate-800">Projection Scenarios</h2>
            <span className="text-sm text-slate-500">When {targetDateDisplay} FAD becomes current</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {projectionScenarios.map((s) => (
              <div
                key={s.name}
                className={`metric-card border cursor-pointer transition-all duration-200 ${s.borderColor} ${activeScenario === s.name ? "ring-2 ring-offset-1" : ""}`}
                onClick={() => setActiveScenario(activeScenario === s.name ? null : s.name)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dotColor}`} />
                    <span className={`text-sm font-semibold ${s.textColor}`}>{s.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${s.bgColor} ${s.textColor}`}>
                    {s.probability}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-mono font-bold text-slate-800">{s.estimatedDate}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-mono">{s.annualRate.toFixed(1)} mo/yr</p>
                    <p className="text-xs text-slate-400">average rate</p>
                  </div>
                </div>

                {activeScenario === s.name && (
                  <div className={`mt-3 pt-3 border-t ${s.borderColor}`}>
                    <p className={`text-xs ${s.textColor}`}>{s.note}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Months needed: <span className="font-mono font-semibold">{s.monthsNeeded}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scenario comparison chart */}
          <div className="metric-card mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Scenario Comparison — Estimated Year FAD Reaches {targetDateDisplay}</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectionScenarios}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[2026, Math.max(2040, projectionScenarios[3].estimatedYear + 2)]}
                    tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "DM Mono" }}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.floor(v)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748B", fontFamily: "DM Sans" }}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: number) => [`~${Math.floor(v)}`, "Estimated year"]}
                    contentStyle={{ fontFamily: "DM Mono", fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                  />
                  <Bar dataKey="estimatedYear" radius={[0, 4, 4, 0]}>
                    {projectionScenarios.map((s, i) => (
                      <Cell key={`cell-${i}`} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ── Methodology & Legal Status ── */}
        <section>
          <div className="metric-card border border-slate-100">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Methodology, Legal Status & Key Assumptions</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Spillover Mechanics (50k–70k)</h3>
                <p className="mb-2">The 75-country ban pauses family-based visa issuance starting Jan 21, 2026. If the ban remains through Sept 30, 2026 (end of FY 2026), approximately 50,000–70,000 family-based visas will go unused. These spill over to employment-based categories in FY 2027 (Oct 1, 2026 – Sept 30, 2027). EB-2 India receives 3,500–4,900 additional visas that fiscal year due to the 7% per-country cap and 28.6% EB-2 allocation formula.</p>
                <p className="text-xs text-slate-500 italic">If the ban continues into FY 2028, new spillover will occur, creating sustained acceleration.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Ban Legal Status & Duration</h3>
                <p className="mb-2"><strong>Current status:</strong> Indefinite pause, no expiration date announced. Lawsuit filed Feb 2, 2026 (CLINIC v. Rubio, Case 1:26-cv-00858) challenging the ban as unlawful. Arguments: exceeds statutory authority, violates due process, improper rulemaking.</p>
                <p className="text-xs text-slate-500"><strong>Likelihood:</strong> 70–80% ban continues through FY 2027; 40–50% through FY 2028; 20–30% through full term. Court decisions typically take 12–24 months.</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-700 text-sm">Important Disclaimers</h3>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Not legal advice. Consult an immigration attorney.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Spillover depends on ban remaining in effect through Sept 2026.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Priority date movement is unpredictable and subject to retrogression.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Legislative changes (per-country cap elimination, green card recapture) could dramatically alter timelines.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Court rulings on the ban could lift it at any time, eliminating spillover benefits.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>EB-2 India Priority Date Tracker · Dynamic Forecast Report</p>
            <p className="font-mono">Data current as of April 2026 Visa Bulletin | Legal challenges ongoing</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
