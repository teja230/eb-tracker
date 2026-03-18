/*
 * EB-2 India Priority Date Tracker — Home Page
 * Design: Civic Tech Policy Dashboard
 * Palette: Slate blue primary, teal positive, amber caution, red negative
 * Typography: DM Sans + DM Mono
 */

import { useState, useEffect, useRef } from "react";
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
  Legend,
} from "recharts";

// ─── Data ────────────────────────────────────────────────────────────────────

// Historical EB-2 India Final Action Dates
// Each entry: { label, date (numeric for chart), displayDate, movement (months) }
const historicalData = [
  // 2020
  { label: "Jan 2020", date: 2020.0, displayDate: "May 18, 2009", movement: 0 },
  { label: "Feb 2020", date: 2020.08, displayDate: "May 19, 2009", movement: 0 },
  { label: "Mar 2020", date: 2020.17, displayDate: "May 22, 2009", movement: 0 },
  { label: "Apr 2020", date: 2020.25, displayDate: "May 25, 2009", movement: 0 },
  { label: "May 2020", date: 2020.33, displayDate: "Jun 2, 2009", movement: 0 },
  { label: "Jun 2020", date: 2020.42, displayDate: "Jun 12, 2009", movement: 0 },
  { label: "Jul 2020", date: 2020.5, displayDate: "Jul 8, 2009", movement: 1 },
  { label: "Aug 2020", date: 2020.58, displayDate: "Jul 8, 2009", movement: 0 },
  { label: "Sep 2020", date: 2020.67, displayDate: "Jul 8, 2009", movement: 0 },
  { label: "Oct 2020", date: 2020.75, displayDate: "Sep 1, 2009", movement: 2 },
  { label: "Nov 2020", date: 2020.83, displayDate: "Sep 22, 2009", movement: 0 },
  { label: "Dec 2020", date: 2020.92, displayDate: "Oct 1, 2009", movement: 0 },
  // 2021
  { label: "Jan 2021", date: 2021.0, displayDate: "Oct 8, 2009", movement: 0 },
  { label: "Feb 2021", date: 2021.08, displayDate: "Oct 12, 2009", movement: 0 },
  { label: "Mar 2021", date: 2021.17, displayDate: "Jan 15, 2010", movement: 3 },
  { label: "Apr 2021", date: 2021.25, displayDate: "May 1, 2010", movement: 4 },
  { label: "May 2021", date: 2021.33, displayDate: "Aug 1, 2010", movement: 3 },
  { label: "Jun 2021", date: 2021.42, displayDate: "Dec 1, 2010", movement: 4 },
  { label: "Jul 2021", date: 2021.5, displayDate: "Jun 1, 2011", movement: 6 },
  { label: "Aug 2021", date: 2021.58, displayDate: "Jun 1, 2011", movement: 0 },
  { label: "Sep 2021", date: 2021.67, displayDate: "Sep 1, 2011", movement: 3 },
  { label: "Oct 2021", date: 2021.75, displayDate: "Sep 1, 2011", movement: 0 },
  { label: "Nov 2021", date: 2021.83, displayDate: "Dec 1, 2011", movement: 3 },
  { label: "Dec 2021", date: 2021.92, displayDate: "May 1, 2012", movement: 5 },
  // 2022
  { label: "Jan 2022", date: 2022.0, displayDate: "Jul 8, 2012", movement: 2 },
  { label: "Feb 2022", date: 2022.08, displayDate: "Jan 1, 2013", movement: 6 },
  { label: "Mar 2022", date: 2022.17, displayDate: "May 1, 2013", movement: 4 },
  { label: "Apr 2022", date: 2022.25, displayDate: "Jul 8, 2013", movement: 2 },
  { label: "May 2022", date: 2022.33, displayDate: "Sep 1, 2013", movement: 2 },
  { label: "Jun 2022", date: 2022.42, displayDate: "Sep 1, 2014", movement: 12 },
  { label: "Jul 2022", date: 2022.5, displayDate: "Dec 1, 2014", movement: 3 },
  { label: "Aug 2022", date: 2022.58, displayDate: "Dec 1, 2014", movement: 0 },
  { label: "Sep 2022", date: 2022.67, displayDate: "Dec 1, 2014", movement: 0 },
  { label: "Oct 2022", date: 2022.75, displayDate: "Apr 1, 2012", movement: -32, retrogression: true },
  { label: "Nov 2022", date: 2022.83, displayDate: "Apr 1, 2012", movement: 0 },
  { label: "Dec 2022", date: 2022.92, displayDate: "Oct 8, 2011", movement: -6, retrogression: true },
  // 2023
  { label: "Jan 2023", date: 2023.0, displayDate: "Oct 8, 2011", movement: 0 },
  { label: "Feb 2023", date: 2023.08, displayDate: "Oct 8, 2011", movement: 0 },
  { label: "Mar 2023", date: 2023.17, displayDate: "Oct 8, 2011", movement: 0 },
  { label: "Apr 2023", date: 2023.25, displayDate: "Jan 1, 2011", movement: -9, retrogression: true },
  { label: "May 2023", date: 2023.33, displayDate: "Jan 1, 2011", movement: 0 },
  { label: "Jun 2023", date: 2023.42, displayDate: "Jan 1, 2011", movement: 0 },
  { label: "Jul 2023", date: 2023.5, displayDate: "Jan 1, 2011", movement: 0 },
  { label: "Aug 2023", date: 2023.58, displayDate: "Jan 1, 2011", movement: 0 },
  { label: "Sep 2023", date: 2023.67, displayDate: "Jan 1, 2011", movement: 0 },
  { label: "Oct 2023", date: 2023.75, displayDate: "Jan 1, 2012", movement: 12 },
  { label: "Nov 2023", date: 2023.83, displayDate: "Jan 1, 2012", movement: 0 },
  { label: "Dec 2023", date: 2023.92, displayDate: "Jan 1, 2012", movement: 0 },
  // 2024
  { label: "Jan 2024", date: 2024.0, displayDate: "Mar 1, 2012", movement: 2 },
  { label: "Feb 2024", date: 2024.08, displayDate: "Mar 1, 2012", movement: 0 },
  { label: "Mar 2024", date: 2024.17, displayDate: "Mar 1, 2012", movement: 0 },
  { label: "Apr 2024", date: 2024.25, displayDate: "Apr 1, 2012", movement: 1 },
  { label: "May 2024", date: 2024.33, displayDate: "Apr 15, 2012", movement: 0.5 },
  { label: "Jun 2024", date: 2024.42, displayDate: "Apr 15, 2012", movement: 0 },
  { label: "Jul 2024", date: 2024.5, displayDate: "Jun 15, 2012", movement: 2 },
  { label: "Aug 2024", date: 2024.58, displayDate: "Jul 15, 2012", movement: 1 },
  { label: "Sep 2024", date: 2024.67, displayDate: "Jul 15, 2012", movement: 0 },
  { label: "Oct 2024", date: 2024.75, displayDate: "Jul 15, 2012", movement: 0 },
  { label: "Nov 2024", date: 2024.83, displayDate: "Jul 15, 2012", movement: 0 },
  { label: "Dec 2024", date: 2024.92, displayDate: "Aug 1, 2012", movement: 0.5 },
  // 2025
  { label: "Jan 2025", date: 2025.0, displayDate: "Oct 1, 2012", movement: 2 },
  { label: "Feb 2025", date: 2025.08, displayDate: "Oct 15, 2012", movement: 0.5 },
  { label: "Mar 2025", date: 2025.17, displayDate: "Dec 1, 2012", movement: 1.5 },
  { label: "Apr 2025", date: 2025.25, displayDate: "Jan 1, 2013", movement: 1 },
  { label: "May 2025", date: 2025.33, displayDate: "Jan 1, 2013", movement: 0 },
  { label: "Jun 2025", date: 2025.42, displayDate: "Jan 1, 2013", movement: 0 },
  { label: "Jul 2025", date: 2025.5, displayDate: "Jan 1, 2013", movement: 0 },
  { label: "Aug 2025", date: 2025.58, displayDate: "Jan 1, 2013", movement: 0 },
  { label: "Sep 2025", date: 2025.67, displayDate: "Jan 1, 2013", movement: 0 },
  { label: "Oct 2025", date: 2025.75, displayDate: "Apr 1, 2013", movement: 3 },
  { label: "Nov 2025", date: 2025.83, displayDate: "Apr 1, 2013", movement: 0 },
  { label: "Dec 2025", date: 2025.92, displayDate: "May 15, 2013", movement: 1.5 },
  // 2026
  { label: "Jan 2026", date: 2026.0, displayDate: "Jul 15, 2013", movement: 2 },
  { label: "Feb 2026", date: 2026.08, displayDate: "Jul 15, 2013", movement: 0 },
  { label: "Mar 2026", date: 2026.17, displayDate: "Sep 15, 2013", movement: 2 },
  { label: "Apr 2026", date: 2026.25, displayDate: "Jul 15, 2014", movement: 10, exceptional: true },
];

// Convert date string to numeric year for chart
function dateToNumeric(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getFullYear() + (d.getMonth()) / 12;
}

// Chart data with numeric FAD values
const chartData = historicalData.map((d) => ({
  ...d,
  fadNumeric: dateToNumeric(d.displayDate),
}));

// Projection data
const projectionScenarios = [
  {
    name: "Optimistic",
    description: "Recent 12-month momentum sustained (~17 months/year)",
    annualRate: 17,
    estimatedDate: "Sep 2027",
    estimatedYear: 2027.67,
    color: "#0D9488",
    bgColor: "bg-teal-50",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
    dotColor: "bg-teal-500",
    probability: "Low",
    note: "Requires April 2026-level jumps to continue every year",
  },
  {
    name: "Base Case",
    description: "3-year average pace (~7 months/year)",
    annualRate: 7,
    estimatedDate: "Oct 2029",
    estimatedYear: 2029.75,
    color: "#2563EB",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    dotColor: "bg-blue-500",
    probability: "Moderate",
    note: "Assumes consistent spillover from EB-1 and family-based categories",
  },
  {
    name: "Conservative",
    description: "Slow movement (~2.5 months/year)",
    annualRate: 2.5,
    estimatedDate: "Apr 2036",
    estimatedYear: 2036.25,
    color: "#D97706",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    dotColor: "bg-amber-500",
    probability: "Moderate-High",
    note: "Reflects typical 2024–2025 pace without significant spillover",
  },
  {
    name: "Pessimistic",
    description: "Stagnant with retrogressions (~1.5 months/year)",
    annualRate: 1.5,
    estimatedDate: "2042+",
    estimatedYear: 2042,
    color: "#DC2626",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    dotColor: "bg-red-500",
    probability: "Low",
    note: "If per-country caps remain and demand increases further",
  },
];

// Annual movement summary
const annualMovement = [
  { year: "FY2020", months: 2, note: "Slow" },
  { year: "FY2021", months: 31, note: "Surge" },
  { year: "FY2022", months: 41, note: "Peak then retrogress" },
  { year: "FY2023", months: 9, note: "Net after retrogression" },
  { year: "FY2024", months: 6, note: "Slow" },
  { year: "FY2025", months: 7, note: "Moderate" },
  { year: "FY2026*", months: 14, note: "Partial (thru Apr)" },
];

// Key events
const keyEvents = [
  { date: "Jun–Jul 2022", event: "EB-2 India surges to Dec 2014 — largest advance in years", type: "positive" },
  { date: "Oct 2022", event: "Massive retrogression: FAD drops from Dec 2014 to Apr 2012 (-32 months)", type: "negative" },
  { date: "Dec 2022", event: "Further retrogression to Oct 2011", type: "negative" },
  { date: "Apr 2023", event: "Additional retrogression to Jan 2011 (-9 months)", type: "negative" },
  { date: "Oct 2023", event: "New fiscal year: FAD jumps +12 months to Jan 2012", type: "positive" },
  { date: "Oct 2025", event: "FAD advances +3 months to Apr 2013 (fiscal year start)", type: "positive" },
  { date: "Mar 2026", event: "Dates for Filing jumps +11 months — USCIS honors DOF chart", type: "positive" },
  { date: "Apr 2026", event: "FAD surges +10 months to Jul 2014 — biggest FAD jump since 2022", type: "exceptional" },
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const isRetrogression = d.retrogression;
    const isExceptional = d.exceptional;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm max-w-[220px]">
        <p className="font-semibold text-slate-800 mb-1">{d.label}</p>
        <p className="font-mono text-slate-700">FAD: <span className="font-medium">{d.displayDate}</span></p>
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

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const duration = 1000;
          const step = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            setDisplayed(Math.floor(progress * value));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{displayed.toLocaleString()}{suffix}</span>;
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function PriorityDateProgress() {
  // From Jan 2009 (approx start) to Aug 2016 (target)
  // Current: Jul 2014
  const startNumeric = 2009.0;
  const targetNumeric = 2016.58; // Aug 2016
  const currentNumeric = 2014.54; // Jul 15, 2014

  const totalRange = targetNumeric - startNumeric;
  const currentProgress = currentNumeric - startNumeric;
  const progressPct = (currentProgress / totalRange) * 100;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-mono text-slate-500">
        <span>Jan 2009</span>
        <span className="text-blue-700 font-semibold">Current: Jul 15, 2014</span>
        <span className="text-amber-600 font-semibold">Target: Aug 2016</span>
      </div>
      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-500"
          style={{ left: "100%" }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{progressPct.toFixed(1)}% of the way to target</span>
        <span className="text-amber-600">~25 months remaining</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

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
                <p className="text-xs text-slate-500 mt-0.5">August 2016 Forecast Report</p>
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
                    <span style={{ color: "oklch(0.75 0.15 195)" }}>August 2016</span> Become Current?
                  </h2>
                  <p className="text-base leading-relaxed" style={{ color: "oklch(0.72 0.03 240)" }}>
                    Analysis of recent visa bulletin movements, pending inventory data, and structural constraints to estimate when the August 2016 priority date will reach the Final Action Date cutoff.
                  </p>
                </div>

                {/* Key stat */}
                <div className="flex-shrink-0">
                  <div className="rounded-xl p-6 text-center min-w-[200px]"
                    style={{ background: "oklch(0.28 0.07 240)", border: "1px solid oklch(0.35 0.08 240)" }}>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "oklch(0.6 0.04 240)" }}>
                      Best Estimate Range
                    </p>
                    <p className="text-4xl font-bold font-mono mb-1" style={{ color: "oklch(0.75 0.15 195)" }}>
                      2029–2036
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.6 0.04 240)" }}>
                      Final Action Date current
                    </p>
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid oklch(0.35 0.08 240)" }}>
                      <p className="text-xs" style={{ color: "oklch(0.6 0.04 240)" }}>Filing Date (DOF)</p>
                      <p className="text-lg font-mono font-semibold" style={{ color: "oklch(0.85 0.1 70)" }}>
                        2028–2031
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
            <h2 className="text-lg font-semibold text-slate-800">Current Status</h2>
            <span className="text-sm text-slate-500 font-mono">April 2026 Visa Bulletin</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Final Action Date",
                value: "Jul 15, 2014",
                sub: "EB-2 India FAD",
                color: "text-blue-700",
                accent: "bg-blue-50 border-blue-100",
                icon: "📅",
              },
              {
                label: "Dates for Filing",
                value: "Jan 15, 2015",
                sub: "Can file I-485 now",
                color: "text-teal-700",
                accent: "bg-teal-50 border-teal-100",
                icon: "📋",
              },
              {
                label: "Gap to Target",
                value: "~25 months",
                sub: "Jul 2014 → Aug 2016",
                color: "text-amber-700",
                accent: "bg-amber-50 border-amber-100",
                icon: "⏳",
              },
              {
                label: "Annual Allocation",
                value: "~2,800–5,000",
                sub: "Visas/year for India EB-2",
                color: "text-slate-700",
                accent: "bg-slate-50 border-slate-100",
                icon: "🎫",
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
              <h2 className="text-lg font-semibold text-slate-800">Priority Date Progress Toward August 2016</h2>
            </div>
            <PriorityDateProgress />
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-sm text-amber-800">
                <strong>April 2026 milestone:</strong> The FAD jumped 10 months in a single bulletin — the largest advance since mid-2022. The Dates for Filing chart crossed into 2015 for the first time. However, the target date of August 2016 remains approximately 25 priority-date months away from the current FAD.
              </p>
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
                    domain={[2009, 2016]}
                    tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "DM Mono" }}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.floor(v)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Target line */}
                  <ReferenceLine
                    y={2016.58}
                    stroke="#D97706"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={{ value: "Target: Aug 2016", position: "insideTopRight", fontSize: 11, fill: "#D97706", fontFamily: "DM Mono" }}
                  />
                  {/* Current FAD line */}
                  <ReferenceLine
                    y={2014.54}
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
                Target: Aug 2016
              </div>
            </div>
          </div>
        </section>

        {/* ── Annual Movement Bar Chart ── */}
        <section>
          <div className="metric-card">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Net Annual Movement by Fiscal Year</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Net priority date months advanced per fiscal year (Oct–Sep), after accounting for retrogressions.</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualMovement} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "DM Mono" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "DM Mono" }} tickLine={false} unit=" mo" />
                  <Tooltip
                    formatter={(v: number) => [`${v} months`, "Net advance"]}
                    contentStyle={{ fontFamily: "DM Mono", fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                  />
                  <Bar dataKey="months" radius={[4, 4, 0, 0]}>
                    {annualMovement.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.months >= 20 ? "#0D9488" :
                          entry.months >= 10 ? "#2563EB" :
                          entry.months >= 5 ? "#6366F1" :
                          "#D97706"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 mt-2">* FY2026 partial data through April 2026 bulletin</p>
          </div>
        </section>

        {/* ── Scenario Projections ── */}
        <section>
          <div className="section-header">
            <h2 className="text-lg font-semibold text-slate-800">Projection Scenarios</h2>
            <span className="text-sm text-slate-500">When August 2016 FAD becomes current</span>
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
                    {s.probability} probability
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-mono font-bold text-slate-800">{s.estimatedDate}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-mono">{s.annualRate} mo/yr</p>
                    <p className="text-xs text-slate-400">advance rate</p>
                  </div>
                </div>

                {activeScenario === s.name && (
                  <div className={`mt-3 pt-3 border-t ${s.borderColor}`}>
                    <p className={`text-xs ${s.textColor}`}>{s.note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scenario comparison chart */}
          <div className="metric-card mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Scenario Comparison — Estimated Year FAD Reaches August 2016</h3>
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
                    domain={[2026, 2044]}
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

        {/* ── Key Events Timeline ── */}
        <section>
          <div className="metric-card">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Key Events Timeline</h2>
            </div>
            <div className="space-y-3">
              {keyEvents.map((event, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-28 text-right">
                    <span className="text-xs font-mono text-slate-400">{event.date}</span>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                      event.type === "positive" ? "bg-blue-500" :
                      event.type === "exceptional" ? "bg-teal-500" :
                      "bg-red-500"
                    }`} />
                    {i < keyEvents.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[16px]" />}
                  </div>
                  <div className={`flex-1 pb-3 text-sm leading-relaxed ${
                    event.type === "positive" ? "text-slate-700" :
                    event.type === "exceptional" ? "text-teal-700 font-medium" :
                    "text-red-700"
                  }`}>
                    {event.event}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Factors ── */}
        <section>
          <div className="section-header">
            <h2 className="text-lg font-semibold text-slate-800">Factors Affecting the Estimate</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="metric-card border border-teal-100">
              <h3 className="text-sm font-semibold text-teal-700 mb-3 flex items-center gap-2">
                <span className="text-base">↑</span> Positive Factors (Could Accelerate)
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  "April 2026 showed exceptional +10 month FAD jump",
                  "Family-based visa spillover expected in Oct 2026 (~50k visas)",
                  "Travel restrictions reducing immigrant visa demand from some countries",
                  "EB-1 India dates advancing, reducing EB-2 demand",
                  "Duplicate petitions being cleared as people get GCs via EB-3",
                  "USCIS processing efficiency improvements",
                ].map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-teal-500 flex-shrink-0 mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="metric-card border border-red-100">
              <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <span className="text-base">↓</span> Negative Factors (Could Slow)
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  "~26,720 pending I-485s for PD up to Dec 2014 alone",
                  "2015 had ~31,579 approved I-140s; 2016 had ~47,548",
                  "Per-country cap limits India to ~7% of annual EB-2 allocation",
                  "Base annual allocation: only ~2,800 visas/year for India EB-2",
                  "Risk of retrogression if demand exceeds supply",
                  "New applicants filing under Dates for Filing chart adding to queue",
                ].map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Inventory Stats ── */}
        <section>
          <div className="metric-card">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Backlog Inventory Snapshot</h2>
            </div>
            <p className="text-sm text-slate-500 mb-5">Based on USCIS October 2025 I-485 pending inventory data and I-140 approval statistics.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Pending I-485s up to Dec 2014", value: 26720, suffix: "", color: "text-blue-700" },
                { label: "Approved I-140s in 2015", value: 31579, suffix: "", color: "text-amber-700" },
                { label: "Approved I-140s in 2016", value: 47548, suffix: "", color: "text-red-700" },
                { label: "Effective demand (40% consume visa)", value: 31000, suffix: "+", color: "text-slate-700" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className={`text-2xl font-mono font-bold ${stat.color}`}>
                    <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600">
                <strong>Key insight:</strong> At 5,000 visas/year for India EB-2 (with spillover), clearing the effective demand for 2015–2016 priority dates (~31,000 cases) would take approximately <strong>6–7 years</strong> — placing the FAD for August 2016 in the <strong>2032–2036 range</strong> under base conditions.
              </p>
            </div>
          </div>
        </section>

        {/* ── Summary Table ── */}
        <section>
          <div className="metric-card">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Summary: August 2016 Priority Date Forecast</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scenario</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Annual Rate</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">DOF Current</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">FAD Current</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { scenario: "Optimistic", rate: "~17 mo/yr", dof: "~2028", fad: "~Sep 2027", prob: "Low", color: "text-teal-700" },
                    { scenario: "Base Case", rate: "~7 mo/yr", dof: "~2029", fad: "~Oct 2029", prob: "Moderate", color: "text-blue-700" },
                    { scenario: "Conservative", rate: "~2.5 mo/yr", dof: "~2031", fad: "~Apr 2036", prob: "Moderate-High", color: "text-amber-700" },
                    { scenario: "Pessimistic", rate: "~1.5 mo/yr", dof: "~2033+", fad: "~2042+", prob: "Low", color: "text-red-700" },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className={`py-3 px-3 font-semibold font-mono ${row.color}`}>{row.scenario}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{row.rate}</td>
                      <td className="py-3 px-3 font-mono text-slate-700">{row.dof}</td>
                      <td className={`py-3 px-3 font-mono font-semibold ${row.color}`}>{row.fad}</td>
                      <td className="py-3 px-3 text-slate-500">{row.prob}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Methodology ── */}
        <section>
          <div className="metric-card border border-slate-100">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Methodology & Disclaimers</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Data Sources</h3>
                <ul className="space-y-1.5">
                  <li className="flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>U.S. Department of State Visa Bulletins (official monthly releases)</li>
                  <li className="flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>USCIS I-485 Pending Inventory Report (October 2025)</li>
                  <li className="flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>USCIS I-140 Approval Data by Fiscal Year and Country</li>
                  <li className="flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>Immigration law firm analyses (RN Law Group, Manifest Law, Beyond Border)</li>
                  <li className="flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>Community analysis from r/EB2 and r/USCIS forums</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Important Disclaimers</h3>
                <ul className="space-y-1.5">
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>This is not legal advice. Consult a qualified immigration attorney.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Priority date movement is highly unpredictable and subject to retrogression.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Legislative changes (e.g., per-country cap reform) could dramatically alter timelines.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Projections are based on historical patterns and do not guarantee future movement.</li>
                  <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">⚠</span>Report current as of April 2026 Visa Bulletin.</li>
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
            <p>EB-2 India Priority Date Tracker · Research Report · April 2026</p>
            <p className="font-mono">Data current as of April 2026 Visa Bulletin · Not legal advice</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
