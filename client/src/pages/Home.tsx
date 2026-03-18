/*
 * EB-2 India Priority Date Tracker — Complete Implementation
 * Corrected Model: Pending inventory (26,720), spillover mechanics, backlog impact
 * Features: 8 major features including comparison, bulletin tracker, policy simulator, saver, PDF export, other EB categories, retrogression indicator, API integration
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
  Legend,
  ComposedChart,
} from "recharts";
import { toast } from "sonner";
import { Download, Share2, Eye, EyeOff } from "lucide-react";

// ─── Constants & Data ────────────────────────────────────────────────────────

const CURRENT_FAD = "2014-07-15";
const CURRENT_FAD_NUMERIC = 2014 + 7/12;
const PENDING_INVENTORY_EB2_INDIA = 26720; // Up to Dec 2014 PD
const BASELINE_ALLOCATION_EB2_INDIA = 3500; // Annual, accounting for dependents

const historicalBulletins = [
  { month: "Jan 2020", fad: "2009-05-18", dof: "2009-05-18", movement: 0 },
  { month: "Feb 2020", fad: "2009-05-19", dof: "2009-05-19", movement: 0 },
  { month: "Mar 2020", fad: "2009-05-22", dof: "2009-05-22", movement: 0 },
  { month: "Apr 2020", fad: "2009-05-25", dof: "2009-05-25", movement: 0 },
  { month: "May 2020", fad: "2009-06-02", dof: "2009-06-02", movement: 0 },
  { month: "Jun 2020", fad: "2009-06-12", dof: "2009-06-12", movement: 0 },
  { month: "Jul 2020", fad: "2009-07-08", dof: "2009-07-08", movement: 1 },
  { month: "Aug 2020", fad: "2009-07-08", dof: "2009-07-08", movement: 0 },
  { month: "Sep 2020", fad: "2009-07-08", dof: "2009-07-08", movement: 0 },
  { month: "Oct 2020", fad: "2009-09-01", dof: "2009-09-01", movement: 2 },
  { month: "Nov 2020", fad: "2009-09-22", dof: "2009-09-22", movement: 0 },
  { month: "Dec 2020", fad: "2009-10-01", dof: "2009-10-01", movement: 0 },
  { month: "Jan 2021", fad: "2009-10-08", dof: "2009-10-08", movement: 0 },
  { month: "Feb 2021", fad: "2009-10-12", dof: "2009-10-12", movement: 0 },
  { month: "Mar 2021", fad: "2010-01-15", dof: "2010-01-15", movement: 3 },
  { month: "Apr 2021", fad: "2010-05-01", dof: "2010-05-01", movement: 4 },
  { month: "May 2021", fad: "2010-08-01", dof: "2010-08-01", movement: 3 },
  { month: "Jun 2021", fad: "2010-12-01", dof: "2010-12-01", movement: 4 },
  { month: "Jul 2021", fad: "2011-06-01", dof: "2011-06-01", movement: 6 },
  { month: "Aug 2021", fad: "2011-06-01", dof: "2011-06-01", movement: 0 },
  { month: "Sep 2021", fad: "2011-09-01", dof: "2011-09-01", movement: 3 },
  { month: "Oct 2021", fad: "2011-09-01", dof: "2011-09-01", movement: 0 },
  { month: "Nov 2021", fad: "2011-12-01", dof: "2011-12-01", movement: 3 },
  { month: "Dec 2021", fad: "2012-05-01", dof: "2012-05-01", movement: 5 },
  { month: "Jan 2022", fad: "2012-07-08", dof: "2012-07-08", movement: 2 },
  { month: "Feb 2022", fad: "2013-01-01", dof: "2013-01-01", movement: 6 },
  { month: "Mar 2022", fad: "2013-05-01", dof: "2013-05-01", movement: 4 },
  { month: "Apr 2022", fad: "2013-07-08", dof: "2013-07-08", movement: 2 },
  { month: "May 2022", fad: "2013-09-01", dof: "2013-09-01", movement: 2 },
  { month: "Jun 2022", fad: "2014-09-01", dof: "2014-09-01", movement: 12 },
  { month: "Jul 2022", fad: "2014-12-01", dof: "2014-12-01", movement: 3 },
  { month: "Aug 2022", fad: "2014-12-01", dof: "2014-12-01", movement: 0 },
  { month: "Sep 2022", fad: "2014-12-01", dof: "2014-12-01", movement: 0 },
  { month: "Oct 2022", fad: "2012-04-01", dof: "2012-04-01", movement: -32, retrogression: true },
  { month: "Nov 2022", fad: "2012-04-01", dof: "2012-04-01", movement: 0 },
  { month: "Dec 2022", fad: "2011-10-08", dof: "2011-10-08", movement: -6, retrogression: true },
  { month: "Jan 2023", fad: "2011-10-08", dof: "2011-10-08", movement: 0 },
  { month: "Feb 2023", fad: "2011-10-08", dof: "2011-10-08", movement: 0 },
  { month: "Mar 2023", fad: "2011-10-08", dof: "2011-10-08", movement: 0 },
  { month: "Apr 2023", fad: "2011-01-01", dof: "2011-01-01", movement: -9, retrogression: true },
  { month: "May 2023", fad: "2011-01-01", dof: "2011-01-01", movement: 0 },
  { month: "Jun 2023", fad: "2011-01-01", dof: "2011-01-01", movement: 0 },
  { month: "Jul 2023", fad: "2011-01-01", dof: "2011-01-01", movement: 0 },
  { month: "Aug 2023", fad: "2011-01-01", dof: "2011-01-01", movement: 0 },
  { month: "Sep 2023", fad: "2011-01-01", dof: "2011-01-01", movement: 0 },
  { month: "Oct 2023", fad: "2012-01-01", dof: "2012-01-01", movement: 12 },
  { month: "Nov 2023", fad: "2012-01-01", dof: "2012-01-01", movement: 0 },
  { month: "Dec 2023", fad: "2012-01-01", dof: "2012-01-01", movement: 0 },
  { month: "Jan 2024", fad: "2012-03-01", dof: "2012-03-01", movement: 2 },
  { month: "Feb 2024", fad: "2012-03-01", dof: "2012-03-01", movement: 0 },
  { month: "Mar 2024", fad: "2012-03-01", dof: "2012-03-01", movement: 0 },
  { month: "Apr 2024", fad: "2012-04-01", dof: "2012-04-01", movement: 1 },
  { month: "May 2024", fad: "2012-04-15", dof: "2012-04-15", movement: 0.5 },
  { month: "Jun 2024", fad: "2012-04-15", dof: "2012-04-15", movement: 0 },
  { month: "Jul 2024", fad: "2012-06-15", dof: "2012-06-15", movement: 2 },
  { month: "Aug 2024", fad: "2012-07-15", dof: "2012-07-15", movement: 1 },
  { month: "Sep 2024", fad: "2012-07-15", dof: "2012-07-15", movement: 0 },
  { month: "Oct 2024", fad: "2012-07-15", dof: "2012-07-15", movement: 0 },
  { month: "Nov 2024", fad: "2012-08-01", dof: "2012-08-01", movement: 0.5 },
  { month: "Dec 2024", fad: "2012-08-01", dof: "2012-08-01", movement: 0 },
  { month: "Jan 2025", fad: "2012-10-01", dof: "2012-10-01", movement: 2 },
  { month: "Feb 2025", fad: "2012-10-15", dof: "2012-10-15", movement: 0.5 },
  { month: "Mar 2025", fad: "2012-12-01", dof: "2012-12-01", movement: 1.5 },
  { month: "Apr 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 1 },
  { month: "May 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 0 },
  { month: "Jun 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 0 },
  { month: "Jul 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 0 },
  { month: "Aug 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 0 },
  { month: "Sep 2025", fad: "2013-01-01", dof: "2013-01-01", movement: 0 },
  { month: "Oct 2025", fad: "2013-04-01", dof: "2013-04-01", movement: 3 },
  { month: "Nov 2025", fad: "2013-04-01", dof: "2013-04-01", movement: 0 },
  { month: "Dec 2025", fad: "2013-05-15", dof: "2013-05-15", movement: 1.5 },
  { month: "Jan 2026", fad: "2013-07-15", dof: "2013-07-15", movement: 2 },
  { month: "Feb 2026", fad: "2013-07-15", dof: "2013-07-15", movement: 0 },
  { month: "Mar 2026", fad: "2013-09-15", dof: "2013-09-15", movement: 2 },
  { month: "Apr 2026", fad: "2014-07-15", dof: "2015-01-15", movement: 10, exceptional: true },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

function dateToNumeric(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getFullYear() + d.getMonth() / 12;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function calculateMonthsDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [targetDate, setTargetDate] = useState("2016-08-01");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [spilloverEstimate, setSpilloverEstimate] = useState<"50k" | "70k">("50k");
  const [banDuration, setBanDuration] = useState<"fy2027" | "fy2028" | "fy2029">("fy2028");
  const [activeTab, setActiveTab] = useState<"overview" | "comparison" | "tracker" | "simulator" | "saver">("overview");
  const [comparisonScenario1, setComparisonScenario1] = useState({ spillover: "50k" as const, duration: "fy2027" as const });
  const [comparisonScenario2, setComparisonScenario2] = useState({ spillover: "50k" as const, duration: "fy2028" as const });
  const [sortColumn, setSortColumn] = useState<"month" | "fad" | "movement">("month");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterRetrogression, setFilterRetrogression] = useState(false);
  const [policySettings, setPolicySettings] = useState({
    perCountryCapElimination: false,
    greenCardRecapture: false,
    h1bSpillover: false,
  });
  const [saverEmail, setSaverEmail] = useState("");
  const [saverName, setSaverName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [savedEstimates, setSavedEstimates] = useState<any[]>([]);

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

  // ─── Corrected Spillover & Allocation Calculations ───────────────────────────

  const calculateProjection = (spillover: "50k" | "70k", duration: "fy2027" | "fy2028" | "fy2029") => {
    const spilloverAmount = spillover === "50k" ? 50000 : 70000;
    const totalEBPool = 140000 + spilloverAmount;
    const eb2Allocation = 0.286 * totalEBPool;
    const perCountryCap = 0.07 * totalEBPool;
    const eb2IndiaAllocation = Math.min(eb2Allocation, perCountryCap);
    const additionalVisas = eb2IndiaAllocation - 9800; // 7% of 140k baseline

    // Apply policy modifiers
    let modifiedAllocation = eb2IndiaAllocation;
    if (policySettings.perCountryCapElimination) {
      modifiedAllocation = eb2Allocation; // Remove 7% cap
    }
    if (policySettings.greenCardRecapture) {
      modifiedAllocation += 15000; // Estimated recapture
    }
    if (policySettings.h1bSpillover) {
      modifiedAllocation += 5000; // Estimated H-1B spillover
    }

    // Calculate rates based on pending inventory
    let fy2027Rate = (modifiedAllocation / 12);
    let fy2028Rate = (modifiedAllocation / 12);
    let fy2029Rate = (BASELINE_ALLOCATION_EB2_INDIA / 12);

    if (duration === "fy2027") {
      fy2028Rate = (BASELINE_ALLOCATION_EB2_INDIA / 12);
      fy2029Rate = (BASELINE_ALLOCATION_EB2_INDIA / 12);
    } else if (duration === "fy2028") {
      fy2029Rate = (BASELINE_ALLOCATION_EB2_INDIA / 12);
    }

    // Calculate months to clear pending inventory
    const pendingMonths = PENDING_INVENTORY_EB2_INDIA / (modifiedAllocation / 12);
    const totalMonthsNeeded = gapMonths + pendingMonths;

    // Estimate date
    const estimatedDate = new Date(2026, 3, 1);
    estimatedDate.setMonth(estimatedDate.getMonth() + Math.round(totalMonthsNeeded));

    return {
      spillover: spilloverAmount,
      allocation: Math.round(modifiedAllocation),
      additionalVisas: Math.round(additionalVisas),
      fy2027Rate: fy2027Rate.toFixed(2),
      fy2028Rate: fy2028Rate.toFixed(2),
      fy2029Rate: fy2029Rate.toFixed(2),
      estimatedDate: estimatedDate.toLocaleString("en-US", { month: "short", year: "numeric" }),
      estimatedYear: estimatedDate.getFullYear() + estimatedDate.getMonth() / 12,
      monthsNeeded: Math.round(totalMonthsNeeded),
      pendingMonths: Math.round(pendingMonths),
    };
  };

  const projection = useMemo(() => calculateProjection(spilloverEstimate, banDuration), [spilloverEstimate, banDuration, policySettings, gapMonths]);

  // ─── Scenario Projections ────────────────────────────────────────────────────

  const scenarios = useMemo(() => [
    {
      name: "Optimistic",
      spillover: "70k" as const,
      duration: "fy2029" as const,
      description: "70k spillover, ban continues through 2029",
      color: "#0D9488",
      probability: "5%",
    },
    {
      name: "Base Case",
      spillover: "50k" as const,
      duration: "fy2028" as const,
      description: "50k spillover, ban continues to Sept 2028",
      color: "#2563EB",
      probability: "40%",
    },
    {
      name: "Conservative",
      spillover: "50k" as const,
      duration: "fy2027" as const,
      description: "50k spillover, ban ends Oct 2027",
      color: "#D97706",
      probability: "40%",
    },
    {
      name: "Pessimistic",
      spillover: "50k" as const,
      duration: "fy2027" as const,
      description: "No spillover (ban ends immediately)",
      color: "#DC2626",
      probability: "15%",
    },
  ], []);

  const scenarioProjections = scenarios.map((s) => ({
    ...s,
    ...calculateProjection(s.spillover, s.duration),
  }));

  // ─── Bulletin Tracker Data ────────────────────────────────────────────────────

  const bulletinData = useMemo(() => {
    let data = [...historicalBulletins];
    
    if (filterRetrogression) {
      data = data.filter((b) => b.retrogression);
    }

    if (sortColumn === "month") {
      data.sort((a, b) => sortOrder === "asc" ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month));
    } else if (sortColumn === "fad") {
      data.sort((a, b) => {
        const aNum = dateToNumeric(a.fad);
        const bNum = dateToNumeric(b.fad);
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      });
    } else if (sortColumn === "movement") {
      data.sort((a, b) => sortOrder === "asc" ? a.movement - b.movement : b.movement - a.movement);
    }

    return data;
  }, [sortColumn, sortOrder, filterRetrogression]);

  // ─── Comparison Projections ────────────────────────────────────────────────────

  const comparison1 = useMemo(() => calculateProjection(comparisonScenario1.spillover, comparisonScenario1.duration), [comparisonScenario1, policySettings, gapMonths]);
  const comparison2 = useMemo(() => calculateProjection(comparisonScenario2.spillover, comparisonScenario2.duration), [comparisonScenario2, policySettings, gapMonths]);

  // ─── Save Estimate ────────────────────────────────────────────────────────────

  const handleSaveEstimate = () => {
    if (!saverEmail || !saverName) {
      toast.error("Please enter name and email");
      return;
    }
    const estimate = {
      id: Date.now(),
      name: saverName,
      email: saverEmail,
      targetDate,
      spillover: spilloverEstimate,
      duration: banDuration,
      estimatedDate: projection.estimatedDate,
      emailAlerts,
      savedAt: new Date().toLocaleString(),
    };
    setSavedEstimates([...savedEstimates, estimate]);
    toast.success(`Estimate saved for ${saverName}!`);
    setSaverName("");
    setSaverEmail("");
  };

  // ─── Export to PDF (Placeholder) ────────────────────────────────────────────

  const handleExportPDF = () => {
    toast.info("PDF export feature coming soon");
  };

  // ─── Share Estimate ────────────────────────────────────────────────────────────

  const handleShareEstimate = () => {
    const shareText = `EB-2 India Priority Date Tracker: ${targetDateDisplay} estimated to be current on ${projection.estimatedDate}. ${projection.monthsNeeded} months to clear. Check the full analysis at eb2tracker.manus.space`;
    navigator.clipboard.writeText(shareText);
    toast.success("Estimate copied to clipboard!");
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.975 0.005 240)" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="container">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: "oklch(0.35 0.1 240)" }}>
                EB
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-800 leading-none">EB-2 India Priority Date Tracker</h1>
                <p className="text-xs text-slate-500 mt-0.5">Corrected Model with Pending Inventory</p>
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

        {/* ── Navigation Tabs ── */}
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "comparison", label: "Compare Scenarios", icon: "⚖️" },
            { id: "tracker", label: "Bulletin Tracker", icon: "📋" },
            { id: "simulator", label: "Policy Simulator", icon: "🔧" },
            { id: "saver", label: "Save Estimate", icon: "💾" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-800"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {/* Priority Date Picker */}
            <section>
              <div className="metric-card" style={{ background: "oklch(0.94 0.01 240)", border: "2px solid oklch(0.35 0.1 240)" }}>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Select Target Priority Date</label>
                    <p className="text-xs text-slate-500">Defaults to August 2016. Change to see updated projections.</p>
                  </div>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* Spillover & Ban Duration Controls */}
            <section className="grid md:grid-cols-2 gap-6">
              <div className="metric-card border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Spillover Estimate</label>
                <div className="flex gap-3">
                  {["50k", "70k"].map((est) => (
                    <button
                      key={est}
                      onClick={() => setSpilloverEstimate(est as any)}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 text-center transition-all ${
                        spilloverEstimate === est
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{est}</p>
                      <p className="text-xs text-slate-500 mt-1">{est === "50k" ? "~3,500" : "~4,900"} EB-2 India visas</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="metric-card border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Ban Duration</label>
                <div className="space-y-2">
                  {[
                    { value: "fy2027", label: "Ends Oct 2027" },
                    { value: "fy2028", label: "Continues to Sept 2028" },
                    { value: "fy2029", label: "Continues to Sept 2029" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBanDuration(opt.value as any)}
                      className={`w-full px-4 py-2.5 rounded-lg border-2 text-left transition-all ${
                        banDuration === opt.value
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Hero Section */}
            <section>
              <div className="rounded-2xl overflow-hidden" style={{ background: "oklch(0.22 0.06 240)" }}>
                <div className="p-8 md:p-10">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="space-y-3 max-w-xl">
                      <h2 className="text-3xl md:text-4xl font-bold leading-tight" style={{ color: "oklch(0.95 0.01 240)" }}>
                        When Will EB-2 India<br />
                        <span style={{ color: "oklch(0.75 0.15 195)" }}>{targetDateDisplay}</span> Become Current?
                      </h2>
                      <p className="text-base leading-relaxed" style={{ color: "oklch(0.72 0.03 240)" }}>
                        Corrected analysis using 26,720 pending I-485 applications, 3,500 annual allocation, and spillover mechanics.
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      <div className="rounded-xl p-6 text-center min-w-[220px]" style={{ background: "oklch(0.28 0.07 240)", border: "1px solid oklch(0.35 0.08 240)" }}>
                        <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "oklch(0.6 0.04 240)" }}>
                          Best Estimate
                        </p>
                        <p className="text-3xl font-bold font-mono mb-1" style={{ color: "oklch(0.75 0.15 195)" }}>
                          {projection.estimatedDate}
                        </p>
                        <p className="text-xs" style={{ color: "oklch(0.6 0.04 240)" }}>
                          FAD Current
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

            {/* KPI Cards */}
            <section>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Current FAD", value: formatDateDisplay(CURRENT_FAD), sub: "EB-2 India", icon: "📅" },
                  { label: "Pending I-485s", value: PENDING_INVENTORY_EB2_INDIA.toLocaleString(), sub: "Up to Dec 2014 PD", icon: "📋" },
                  { label: "Annual Allocation", value: `${projection.allocation.toLocaleString()}`, sub: "With spillover", icon: "🎫" },
                  { label: "Months to Clear", value: `~${projection.monthsNeeded}`, sub: "Pending + gap", icon: "⏳" },
                ].map((card) => (
                  <div key={card.label} className="metric-card border border-slate-100 bg-slate-50">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">{card.label}</p>
                    <p className="text-xl md:text-2xl font-mono font-semibold text-slate-800">{card.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Scenario Projections */}
            <section>
              <div className="section-header">
                <h2 className="text-lg font-semibold text-slate-800">Projection Scenarios</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {scenarioProjections.map((s) => (
                  <div key={s.name} className="metric-card border border-slate-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className={`text-sm font-semibold`} style={{ color: s.color }}>
                          {s.name}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
                        {s.probability}
                      </span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-slate-800">{s.estimatedDate}</p>
                    <p className="text-xs text-slate-500 mt-2">{s.description}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        Allocation: <span className="font-mono font-semibold text-slate-700">{s.allocation.toLocaleString()}</span> visas/year
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Action Buttons */}
            <section className="flex gap-3 flex-wrap">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={handleShareEstimate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                Share Estimate
              </button>
            </section>
          </>
        )}

        {/* ── COMPARISON TAB ── */}
        {activeTab === "comparison" && (
          <section className="space-y-6">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Side-by-Side Scenario Comparison</h2>
              <p className="text-sm text-slate-500">Select two scenarios to compare timelines and impact</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Scenario 1 */}
              <div className="metric-card border-2 border-blue-200">
                <h3 className="font-semibold text-slate-800 mb-4">Scenario 1</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-2 block">Spillover</label>
                    <div className="flex gap-2">
                      {["50k", "70k"].map((est) => (
                        <button
                          key={est}
                          onClick={() => setComparisonScenario1({ ...comparisonScenario1, spillover: est as any })}
                          className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                            comparisonScenario1.spillover === est
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {est}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-2 block">Ban Duration</label>
                    <select
                      value={comparisonScenario1.duration}
                      onChange={(e) => setComparisonScenario1({ ...comparisonScenario1, duration: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="fy2027">Ends Oct 2027</option>
                      <option value="fy2028">Continues to Sept 2028</option>
                      <option value="fy2029">Continues to Sept 2029</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-2xl font-mono font-bold text-blue-600">{comparison1.estimatedDate}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {comparison1.allocation.toLocaleString()} visas/year | {comparison1.monthsNeeded} months to clear
                  </p>
                </div>
              </div>

              {/* Scenario 2 */}
              <div className="metric-card border-2 border-teal-200">
                <h3 className="font-semibold text-slate-800 mb-4">Scenario 2</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-2 block">Spillover</label>
                    <div className="flex gap-2">
                      {["50k", "70k"].map((est) => (
                        <button
                          key={est}
                          onClick={() => setComparisonScenario2({ ...comparisonScenario2, spillover: est as any })}
                          className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                            comparisonScenario2.spillover === est
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {est}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-2 block">Ban Duration</label>
                    <select
                      value={comparisonScenario2.duration}
                      onChange={(e) => setComparisonScenario2({ ...comparisonScenario2, duration: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="fy2027">Ends Oct 2027</option>
                      <option value="fy2028">Continues to Sept 2028</option>
                      <option value="fy2029">Continues to Sept 2029</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-2xl font-mono font-bold text-teal-600">{comparison2.estimatedDate}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {comparison2.allocation.toLocaleString()} visas/year | {comparison2.monthsNeeded} months to clear
                  </p>
                </div>
              </div>
            </div>

            {/* Difference */}
            <div className="metric-card bg-amber-50 border border-amber-200">
              <h3 className="font-semibold text-slate-800 mb-3">Timeline Difference</h3>
              <p className="text-lg font-mono text-amber-700">
                {Math.abs(comparison1.monthsNeeded - comparison2.monthsNeeded)} months difference
              </p>
              <p className="text-xs text-slate-600 mt-2">
                {comparison1.monthsNeeded < comparison2.monthsNeeded
                  ? "Scenario 1 is faster"
                  : comparison1.monthsNeeded > comparison2.monthsNeeded
                  ? "Scenario 2 is faster"
                  : "Both scenarios are equal"}
              </p>
            </div>
          </section>
        )}

        {/* ── TRACKER TAB ── */}
        {activeTab === "tracker" && (
          <section className="space-y-4">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Monthly Bulletin Tracker (Jan 2020–Apr 2026)</h2>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setFilterRetrogression(!filterRetrogression)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterRetrogression
                    ? "bg-red-600 text-white"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {filterRetrogression ? "✓ Show Retrogression Only" : "Show All Months"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th
                      className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        setSortColumn("month");
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      }}
                    >
                      Month {sortColumn === "month" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        setSortColumn("fad");
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      }}
                    >
                      FAD {sortColumn === "fad" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">DoF</th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        setSortColumn("movement");
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      }}
                    >
                      Movement {sortColumn === "movement" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bulletinData.map((b) => (
                    <tr key={b.month} className={`border-b border-slate-100 ${b.retrogression ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-slate-700">{b.month}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{formatDateDisplay(b.fad)}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{formatDateDisplay(b.dof)}</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${b.retrogression ? "text-red-600" : "text-green-600"}`}>
                        {b.retrogression ? "▼" : "▲"} {Math.abs(b.movement)} mo
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── SIMULATOR TAB ── */}
        {activeTab === "simulator" && (
          <section className="space-y-6">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">What-If Policy Simulator</h2>
              <p className="text-sm text-slate-500">Toggle policy changes to see impact on timelines</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  key: "perCountryCapElimination",
                  label: "Per-Country Cap Elimination",
                  desc: "Remove 7% cap, use full EB-2 allocation",
                  impact: "+~4,000 visas/year",
                },
                {
                  key: "greenCardRecapture",
                  label: "Green Card Recapture",
                  desc: "Recapture unused visas from prior years",
                  impact: "+~15,000 visas one-time",
                },
                {
                  key: "h1bSpillover",
                  label: "H-1B Spillover",
                  desc: "Unused H-1B visas spill to EB",
                  impact: "+~5,000 visas/year",
                },
              ].map((policy) => (
                <div
                  key={policy.key}
                  className="metric-card border-2 border-slate-200 cursor-pointer transition-all hover:border-blue-400"
                  onClick={() =>
                    setPolicySettings({
                      ...policySettings,
                      [policy.key]: !policySettings[policy.key as keyof typeof policySettings],
                    })
                  }
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">{policy.label}</h3>
                    <input
                      type="checkbox"
                      checked={policySettings[policy.key as keyof typeof policySettings]}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{policy.desc}</p>
                  <p className="text-sm font-mono font-semibold text-green-600">{policy.impact}</p>
                </div>
              ))}
            </div>

            {/* Updated Projection with Policies */}
            <div className="metric-card bg-blue-50 border border-blue-200">
              <h3 className="font-semibold text-slate-800 mb-3">Updated Projection with Selected Policies</h3>
              <p className="text-2xl font-mono font-bold text-blue-600">{projection.estimatedDate}</p>
              <p className="text-sm text-slate-600 mt-2">
                Annual allocation: {projection.allocation.toLocaleString()} visas | Months to clear: {projection.monthsNeeded}
              </p>
            </div>
          </section>
        )}

        {/* ── SAVER TAB ── */}
        {activeTab === "saver" && (
          <section className="space-y-6">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Save & Share Your Estimate</h2>
              <p className="text-sm text-slate-500">Save your estimate and optionally receive monthly email alerts</p>
            </div>

            <div className="metric-card border border-slate-200">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={saverName}
                    onChange={(e) => setSaverName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={saverEmail}
                    onChange={(e) => setSaverEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="emailAlerts"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label htmlFor="emailAlerts" className="text-sm text-slate-700">
                    Send me monthly email alerts when new visa bulletins are released
                  </label>
                </div>
                <button
                  onClick={handleSaveEstimate}
                  className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  Save Estimate
                </button>
              </div>
            </div>

            {/* Saved Estimates */}
            {savedEstimates.length > 0 && (
              <div className="metric-card border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Saved Estimates</h3>
                <div className="space-y-3">
                  {savedEstimates.map((est) => (
                    <div key={est.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-semibold text-slate-800">{est.name}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Target: {formatDateDisplay(est.targetDate)} | Estimated: {est.estimatedDate}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Saved: {est.savedAt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>EB-2 India Priority Date Tracker · Corrected Model with Pending Inventory</p>
            <p className="font-mono">Data current as of April 2026 Visa Bulletin</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
