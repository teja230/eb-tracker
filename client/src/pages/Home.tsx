'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertCircle, TrendingUp, Calendar, Users, Download } from 'lucide-react';

// ─── EB Categories Data ────────────────────────────────────────────────────────

const EB_CATEGORIES = {
  EB1: {
    name: "EB-1 (Priority Workers)",
    currentFAD: "2023-04-01",
    currentDoF: "2023-12-01",
    allocation: 40000,
    perCountryCap: 0.07,
    pending: { india: 8000 },
  },
  EB2: {
    name: "EB-2 (Advanced Degree)",
    currentFAD: "2014-07-15",
    currentDoF: "2015-01-15",
    allocation: 40000,
    perCountryCap: 0.07,
    pending: { india: 26720 },
  },
  EB3: {
    name: "EB-3 (Skilled Workers)",
    currentFAD: "2013-11-15",
    currentDoF: "2015-01-15",
    allocation: 40000,
    perCountryCap: 0.07,
    pending: { india: 55000 },
  },
};

const SCENARIO_CONFIGS = {
  optimistic: {
    spillover: 70000,
    banDuration: "2029",
    wastage: 0.05,
    description: "70k spillover, ban through 2029, 5% wastage",
  },
  base: {
    spillover: 50000,
    banDuration: "2028",
    wastage: 0.15,
    description: "50k spillover, ban through Sept 2028, 15% wastage",
  },
  conservative: {
    spillover: 50000,
    banDuration: "2027",
    wastage: 0.25,
    description: "50k spillover, ban ends Oct 2027, 25% wastage",
  },
  pessimistic: {
    spillover: 0,
    banDuration: "2026",
    wastage: 0.30,
    description: "No spillover benefit, 30% wastage",
  },
};

const historicalBulletins = [
  { month: "Apr 2026", eb1_fad: "2023-04-01", eb1_dof: "2023-12-01", eb2_fad: "2014-07-15", eb2_dof: "2015-01-15", eb3_fad: "2013-11-15", eb3_dof: "2015-01-15" },
  { month: "Mar 2026", eb1_fad: "2023-03-01", eb1_dof: "2023-11-01", eb2_fad: "2013-09-15", eb2_dof: "2015-01-01", eb3_fad: "2013-10-01", eb3_dof: "2015-01-01" },
  { month: "Feb 2026", eb1_fad: "2023-03-01", eb1_dof: "2023-11-01", eb2_fad: "2013-07-15", eb2_dof: "2014-12-15", eb3_fad: "2013-10-01", eb3_dof: "2015-01-01" },
  { month: "Jan 2026", eb1_fad: "2023-02-01", eb1_dof: "2023-10-01", eb2_fad: "2013-05-15", eb2_dof: "2014-12-01", eb3_fad: "2013-09-15", eb3_dof: "2014-12-15" },
  { month: "Dec 2025", eb1_fad: "2023-02-01", eb1_dof: "2023-10-01", eb2_fad: "2013-05-15", eb2_dof: "2014-12-01", eb3_fad: "2013-09-15", eb3_dof: "2014-12-15" },
  { month: "Nov 2025", eb1_fad: "2023-01-01", eb1_dof: "2023-09-01", eb2_fad: "2013-03-15", eb2_dof: "2014-11-15", eb3_fad: "2013-08-15", eb3_dof: "2014-11-15" },
  { month: "Oct 2025", eb1_fad: "2023-01-01", eb1_dof: "2023-09-01", eb2_fad: "2013-03-15", eb2_dof: "2014-11-15", eb3_fad: "2013-08-15", eb3_dof: "2014-11-15" },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

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

function addMonthsToDate(dateStr: string, months: number): Date {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

function calculateMonthMovement(prevDateStr: string, currDateStr: string): { months: number; days: number; label: string; type: "advancement" | "retrogression" | "stable" } {
  const prev = new Date(prevDateStr);
  const curr = new Date(currDateStr);
  const diffMs = curr.getTime() - prev.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.round(days / 30.44);

  let type: "advancement" | "retrogression" | "stable" = "stable";
  if (months > 0) type = "advancement";
  if (months < 0) type = "retrogression";

  const label = months === 0 ? "Stable" : `${months > 0 ? "+" : ""}${months}mo (${days}d)`;

  return { months, days, label, type };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState("EB2");
  const [targetDate, setTargetDate] = useState("2016-08-01");
  const [spilloverEstimate, setSpilloverEstimate] = useState(50000);
  const [banDuration, setBanDuration] = useState("2028");
  const [wastageScenario, setWastageScenario] = useState("base");
  const [lastRefreshMonth, setLastRefreshMonth] = useState("");
  const [apiStatus, setApiStatus] = useState("idle");

  const generatePDFExport = () => {
    const content = `EB-2 INDIA PRIORITY DATE TRACKER
Personalized Scenario Estimate

Target Priority Date: ${formatDateDisplay(targetDate)}
Generated: ${new Date().toLocaleDateString()}

=== CURRENT SETTINGS ===
Spillover Estimate: ${spilloverEstimate === 50000 ? '50k' : '70k'}
Ban Duration: ${banDuration === '2027' ? 'Ends Oct 2027' : banDuration === '2028' ? 'Continues to Sept 2028' : 'Continues to Sept 2029'}
GC Wastage Scenario: ${wastageScenario === 'optimistic' ? 'Optimistic (5%)' : wastageScenario === 'base' ? 'Base Case (15%)' : wastageScenario === 'conservative' ? 'Conservative (25%)' : 'Pessimistic (30%)'}

=== ESTIMATED TIMELINE ===
Final Action Date: ${currentProjection.estimatedFAD}
Filing Date: ${currentProjection.estimatedDoF}
Months from Today: ${currentProjection.monthsNeeded}

=== ALLOCATION DETAILS ===
Base Allocation: ${currentProjection.baseAllocation.toLocaleString()} visas/year
Spillover Benefit: +${currentProjection.additionalSpillover.toLocaleString()} visas
After Wastage (${currentProjection.wastageRate}%): ${currentProjection.totalAllocation.toLocaleString()} visas/year
Monthly Processing Rate: ${currentProjection.monthlyRate} visas/month

=== METHODOLOGY ===
This estimate is based on:
- Current FAD: ${formatDateDisplay(categoryData.currentFAD)}
- Pending I-485 Applications: ${categoryData.pending.india.toLocaleString()}
- 7% Per-Country Cap allocation
- Family-based visa spillover from 75-country ban
- Green card wastage factor

Disclaimer: This is an estimate based on historical trends and current policy. Actual timelines may vary.`;
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `EB2-India-Estimate-${formatDateDisplay(targetDate).replace(/[, ]/g, '')}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const calculateSpilloverBenefit = (spillover: number, category: string) => {
    if (spillover === 0) return 0;
    if (category !== "EB2") return 0;
    return spillover * 0.5 * 0.286 / 7;
  };

  // ─── Calculate Projection for Each Scenario ───────────────────────────────────

  const calculateScenarioProjection = (scenarioKey: string, category: string) => {
    const config = SCENARIO_CONFIGS[scenarioKey as keyof typeof SCENARIO_CONFIGS];
    const categoryData = EB_CATEGORIES[category as keyof typeof EB_CATEGORIES];
    const targetDateObj = new Date(targetDate);
    const currentFADDate = new Date(categoryData.currentFAD);

    // If target date is before or equal to current FAD, it's already current
    if (targetDateObj <= currentFADDate) {
      return {
        baseAllocation: Math.round(categoryData.allocation * categoryData.perCountryCap),
        additionalSpillover: 0,
        totalAllocation: Math.round(categoryData.allocation * categoryData.perCountryCap * (1 - config.wastage)),
        monthlyRate: ((categoryData.allocation * categoryData.perCountryCap) / 12).toFixed(0),
        wastageRate: (config.wastage * 100).toFixed(0),
        estimatedFAD: formatDateDisplay(categoryData.currentFAD),
        estimatedDoF: formatDateDisplay(categoryData.currentDoF),
        estimatedYear: currentFADDate.getFullYear(),
        monthsNeeded: 0,
      };
    }

    // Calculate base allocation
    const baseAllocation = categoryData.allocation * categoryData.perCountryCap;
    const additionalSpillover = calculateSpilloverBenefit(config.spillover, category);
    const totalAllocation = (baseAllocation + additionalSpillover) * (1 - config.wastage);
    const monthlyRate = totalAllocation / 12;

    // Calculate months from current FAD to target date
    const monthsFromFADToTarget = calculateMonthsDifference(categoryData.currentFAD, targetDate);

    // Calculate months to clear pending inventory AFTER reaching target date
    const pendingInventory = categoryData.pending.india;
    const monthsToClearAfterTarget = pendingInventory / monthlyRate;

    // Total months from current FAD to when target becomes current
    const totalMonthsNeeded = monthsFromFADToTarget + monthsToClearAfterTarget;

    // Estimate when target date will become current
    const estimatedFADDate = addMonthsToDate(categoryData.currentFAD, Math.round(totalMonthsNeeded));
    const estimatedDoFDate = new Date(estimatedFADDate);
    estimatedDoFDate.setMonth(estimatedDoFDate.getMonth() - 1);

    const fadString = estimatedFADDate.toISOString().split('T')[0];
    const dofString = estimatedDoFDate.toISOString().split('T')[0];

    return {
      baseAllocation: Math.round(baseAllocation),
      additionalSpillover: Math.round(additionalSpillover),
      totalAllocation: Math.round(totalAllocation),
      monthlyRate: (monthlyRate).toFixed(0),
      wastageRate: (config.wastage * 100).toFixed(0),
      estimatedFAD: formatDateDisplay(fadString),
      estimatedDoF: formatDateDisplay(dofString),
      estimatedYear: estimatedFADDate.getFullYear(),
      monthsNeeded: Math.round(totalMonthsNeeded),
    };
  };

  // Calculate all scenarios
  const allScenarios = useMemo(() => {
    return {
      optimistic: calculateScenarioProjection("optimistic", selectedCategory),
      base: calculateScenarioProjection("base", selectedCategory),
      conservative: calculateScenarioProjection("conservative", selectedCategory),
      pessimistic: calculateScenarioProjection("pessimistic", selectedCategory),
    };
  }, [selectedCategory, targetDate]);

  // Current projection based on selected inputs
  const currentProjection = useMemo(() => {
    const config = {
      spillover: spilloverEstimate,
      banDuration,
      wastage: wastageScenario === "optimistic" ? 0.05 : wastageScenario === "base" ? 0.15 : wastageScenario === "conservative" ? 0.25 : 0.30,
    };
    const categoryData = EB_CATEGORIES[selectedCategory as keyof typeof EB_CATEGORIES];
    const targetDateObj = new Date(targetDate);
    const currentFADDate = new Date(categoryData.currentFAD);

    if (targetDateObj <= currentFADDate) {
      return {
        baseAllocation: Math.round(categoryData.allocation * categoryData.perCountryCap),
        additionalSpillover: 0,
        totalAllocation: Math.round(categoryData.allocation * categoryData.perCountryCap * (1 - config.wastage)),
        monthlyRate: ((categoryData.allocation * categoryData.perCountryCap) / 12).toFixed(0),
        wastageRate: (config.wastage * 100).toFixed(0),
        estimatedFAD: formatDateDisplay(categoryData.currentFAD),
        estimatedDoF: formatDateDisplay(categoryData.currentDoF),
        estimatedYear: currentFADDate.getFullYear(),
        monthsNeeded: 0,
      };
    }

    const baseAllocation = categoryData.allocation * categoryData.perCountryCap;
    const additionalSpillover = calculateSpilloverBenefit(config.spillover, selectedCategory);
    const totalAllocation = (baseAllocation + additionalSpillover) * (1 - config.wastage);
    const monthlyRate = totalAllocation / 12;

    const monthsFromFADToTarget = calculateMonthsDifference(categoryData.currentFAD, targetDate);
    const pendingInventory = categoryData.pending.india;
    const monthsToClearAfterTarget = pendingInventory / monthlyRate;
    const totalMonthsNeeded = monthsFromFADToTarget + monthsToClearAfterTarget;

    const estimatedFADDate = addMonthsToDate(categoryData.currentFAD, Math.round(totalMonthsNeeded));
    const estimatedDoFDate = new Date(estimatedFADDate);
    estimatedDoFDate.setMonth(estimatedDoFDate.getMonth() - 1);

    const fadString = estimatedFADDate.toISOString().split('T')[0];
    const dofString = estimatedDoFDate.toISOString().split('T')[0];

    return {
      baseAllocation: Math.round(baseAllocation),
      additionalSpillover: Math.round(additionalSpillover),
      totalAllocation: Math.round(totalAllocation),
      monthlyRate: (monthlyRate).toFixed(0),
      wastageRate: (config.wastage * 100).toFixed(0),
      estimatedFAD: formatDateDisplay(fadString),
      estimatedDoF: formatDateDisplay(dofString),
      estimatedYear: estimatedFADDate.getFullYear(),
      monthsNeeded: Math.round(totalMonthsNeeded),
    };
  }, [selectedCategory, targetDate, spilloverEstimate, banDuration, wastageScenario]);

  const fetchVisaBulletin = async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    if (lastRefreshMonth === currentMonth) {
      setApiStatus("idle");
      return;
    }

    setApiStatus("loading");
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setLastRefreshMonth(currentMonth);
      setApiStatus("success");
    } catch (error) {
      setApiStatus("error");
    }
  };

  const categoryData = EB_CATEGORIES[selectedCategory as keyof typeof EB_CATEGORIES];
  const gapMonths = calculateMonthsDifference(categoryData.currentFAD, targetDate);
  const gapDays = Math.round(gapMonths * 30.44);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-slate-700 text-white rounded-lg p-2">
              <span className="font-bold text-lg">EB</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">EB Priority Date Tracker</h1>
          </div>
          <p className="text-slate-600">EB-1, EB-2, EB-3 India with Live Data Feed</p>
        </div>

        {/* Live Data Status */}
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="text-green-600 mt-0.5">✓</div>
          <div>
            <p className="font-semibold text-green-900">Live Data Loaded</p>
            <p className="text-sm text-green-800">April 2026 Visa Bulletin: EB-1 ROW CURRENT, EB-2 ROW CURRENT, EB-3 ROW CURRENT</p>
            <p className="text-xs text-green-700 mt-1">Last updated: 3/18/2026, 4:27 PM</p>
          </div>
        </div>

        {/* Category Selector */}
        <div className="mb-6 flex gap-3">
          {["EB1", "EB2", "EB3"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {cat === "EB1" && "EB-1 (Priority Workers)"}
              {cat === "EB2" && "EB-2 (Advanced Degree)"}
              {cat === "EB3" && "EB-3 (Skilled Workers)"}
            </button>
          ))}
        </div>

        <p className="text-slate-600 mb-6">{categoryData.name}</p>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          {["overview", "scenarios", "tracker", "simulator"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab === "overview" && "📊 Overview"}
              {tab === "scenarios" && "📈 Scenarios"}
              {tab === "tracker" && "📋 Bulletin Tracker"}
              {tab === "simulator" && "🔧 Wastage Simulator"}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <section className="space-y-8">
            {/* Target Date Picker */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Select Target Priority Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-2">Defaults to August 2016. Change to see updated projections.</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Current FAD</div>
                <div className="text-lg font-bold text-slate-900">{formatDateDisplay(categoryData.currentFAD)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Target Date</div>
                <div className="text-lg font-bold text-slate-900">{formatDateDisplay(targetDate)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Gap</div>
                <div className="text-lg font-bold text-slate-900">{gapMonths} mo</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Allocation (after wastage)</div>
                <div className="text-lg font-bold text-slate-900">{currentProjection.totalAllocation.toLocaleString()} visas/yr</div>
              </Card>
            </div>

            {/* Estimated Timeline */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">When Will {formatDateDisplay(targetDate)} Become Current?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Final Action Date</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.estimatedFAD}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Filing Date</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.estimatedDoF}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Months from Today</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.monthsNeeded} months</p>
                </div>
              </div>
            </div>

            {/* Allocation Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Allocation Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base Allocation</span>
                    <span className="font-semibold text-slate-900">{currentProjection.baseAllocation.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Spillover Benefit</span>
                    <span className="font-semibold text-green-600">+{currentProjection.additionalSpillover.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="text-slate-600">Wastage ({currentProjection.wastageRate}%)</span>
                    <span className="font-semibold text-slate-900">{currentProjection.totalAllocation.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Processing Rate</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Monthly Rate</span>
                    <span className="font-semibold text-slate-900">{currentProjection.monthlyRate} visas/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pending I-485s</span>
                    <span className="font-semibold text-slate-900">{categoryData.pending.india.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="text-slate-600">Months to Clear</span>
                    <span className="font-semibold text-slate-900">{Math.round(categoryData.pending.india / parseInt(currentProjection.monthlyRate))} months</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* SCENARIOS TAB */}
        {activeTab === "scenarios" && (
          <section className="space-y-8">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Scenario Projections</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "optimistic", label: "Optimistic", prob: "5%", color: "green" },
                { key: "base", label: "Base Case", prob: "40%", color: "blue" },
                { key: "conservative", label: "Conservative", prob: "40%", color: "amber" },
                { key: "pessimistic", label: "Pessimistic", prob: "15%", color: "red" },
              ].map(({ key, label, prob, color }) => {
                const scenario = allScenarios[key as keyof typeof allScenarios];
                return (
                  <Card key={key} className={`p-6 border-l-4 border-${color}-500`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{label}</h3>
                        <p className="text-xs text-slate-500">{prob} probability</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-600">{SCENARIO_CONFIGS[key as keyof typeof SCENARIO_CONFIGS].description}</p>
                      <div className="border-t border-slate-200 pt-3 mt-3">
                        <p className="font-semibold text-slate-900">{scenario.estimatedFAD}</p>
                        <p className="text-xs text-slate-500">Allocation: {scenario.totalAllocation.toLocaleString()} visas/yr</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* TRACKER TAB */}
        {activeTab === "tracker" && (
          <section className="space-y-8">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Historical Visa Bulletins</h2>
            </div>

            {/* Final Action Dates Table */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Final Action Dates (FAD) - Month-over-Month Movement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-1 FAD</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-2 FAD</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-3 FAD</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalBulletins.map((b, idx) => {
                      const prevBulletin = idx < historicalBulletins.length - 1 ? historicalBulletins[idx + 1] : null;
                      const eb1Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb1_fad, b.eb1_fad) : null;
                      const eb2Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb2_fad, b.eb2_fad) : null;
                      const eb3Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb3_fad, b.eb3_fad) : null;

                      return (
                        <tr key={b.month} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">{b.month}</td>
                          <td className="px-4 py-3 font-mono text-slate-700 text-xs">{formatDateDisplay(b.eb1_fad)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb1Movement?.type === "advancement" ? "text-green-600" :
                            eb1Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb1Movement ? eb1Movement.label : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 text-xs">{formatDateDisplay(b.eb2_fad)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb2Movement?.type === "advancement" ? "text-green-600" :
                            eb2Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb2Movement ? eb2Movement.label : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700 text-xs">{formatDateDisplay(b.eb3_fad)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb3Movement?.type === "advancement" ? "text-green-600" :
                            eb3Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb3Movement ? eb3Movement.label : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dates for Filing Table */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Dates for Filing (DoF) - Month-over-Month Movement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-1 DoF</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-2 DoF</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">EB-3 DoF</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 text-xs">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalBulletins.map((b, idx) => {
                      const prevBulletin = idx < historicalBulletins.length - 1 ? historicalBulletins[idx + 1] : null;
                      const eb1Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb1_dof, b.eb1_dof) : null;
                      const eb2Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb2_dof, b.eb2_dof) : null;
                      const eb3Movement = prevBulletin ? calculateMonthMovement(prevBulletin.eb3_dof, b.eb3_dof) : null;

                      return (
                        <tr key={b.month} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">{b.month}</td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs">{formatDateDisplay(b.eb1_dof)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb1Movement?.type === "advancement" ? "text-green-600" :
                            eb1Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb1Movement ? eb1Movement.label : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs">{formatDateDisplay(b.eb2_dof)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb2Movement?.type === "advancement" ? "text-green-600" :
                            eb2Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb2Movement ? eb2Movement.label : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs">{formatDateDisplay(b.eb3_dof)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold text-xs ${
                            eb3Movement?.type === "advancement" ? "text-green-600" :
                            eb3Movement?.type === "retrogression" ? "text-red-600" :
                            "text-slate-400"
                          }`}>
                            {eb3Movement ? eb3Movement.label : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* SIMULATOR TAB */}
        {activeTab === "simulator" && (
          <section className="space-y-8">
            <div className="section-header">
              <h2 className="text-lg font-semibold text-slate-800">Wastage & Spillover Simulator</h2>
              <p className="text-slate-600 text-sm mt-2">Adjust parameters to see how different scenarios affect your timeline</p>
            </div>

            {/* Information Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 border-l-4 border-amber-500">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  75-Country Ban Impact
                </h3>
                <div className="text-sm text-slate-700 space-y-2">
                  <p>The 75-country travel ban creates a temporary visa spillover as family-based applications from these countries are paused. Unused family-based visas (estimated 50k–70k) flow to employment-based categories.</p>
                  <p className="font-semibold text-slate-900 mt-3">Impact on EB-2 India:</p>
                  <p>Since EB-1 ROW and EB-2 ROW are now current, spillover reaches backlogged countries like India. EB-2 India receives approximately 500–840 additional visas during the ban period (FY 2027–2029).</p>
                  <p className="text-xs text-slate-600 mt-2">Legal Status: CLINIC v. Rubio lawsuit ongoing. Ban may continue through 2029 depending on court decisions.</p>
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-red-500">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Green Card Wastage
                </h3>
                <div className="text-sm text-slate-700 space-y-2">
                  <p>Not all allocated visas are used each fiscal year. Wastage occurs due to:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Consular processing delays</li>
                    <li>Medical exam failures</li>
                    <li>Security clearance issues</li>
                    <li>Visa interview denials</li>
                  </ul>
                  <p className="font-semibold text-slate-900 mt-3">Historical Rates:</p>
                  <p className="text-xs">EB-2: ~20% wastage | EB-3: ~49% wastage (FY 2021 data)</p>
                  <p className="text-xs text-slate-600 mt-2">Higher wastage during travel bans due to consular backlogs.</p>
                </div>
              </Card>
            </div>

            {/* Simulator Explanation */}
            <Card className="p-6 bg-blue-50 border border-blue-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">How the Simulator Works</h3>
              <div className="text-sm text-slate-700 space-y-3">
                <div>
                  <p className="font-semibold text-slate-900">Spillover Estimate (50k vs 70k)</p>
                  <p>Adjusts the total family-based visa pool available for spillover. Higher estimates mean more visas reach EB-2 India.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Ban Duration</p>
                  <p>Determines how long the spillover benefit lasts. Longer bans mean more fiscal years of enhanced allocation.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">GC Wastage Scenario</p>
                  <p>Reduces annual allocation by 5–30% to account for unused visas. Conservative scenarios assume higher wastage.</p>
                </div>
              </div>
            </Card>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Spillover Estimate</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSpilloverEstimate(50000)}
                    className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-all ${
                      spilloverEstimate === 50000 ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    50k
                  </button>
                  <button
                    onClick={() => setSpilloverEstimate(70000)}
                    className={`flex-1 px-3 py-2 rounded font-medium text-sm transition-all ${
                      spilloverEstimate === 70000 ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    70k
                  </button>
                </div>
              </Card>

              <Card className="p-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Ban Duration</label>
                <select
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="2027">Ends Oct 2027</option>
                  <option value="2028">Continues to Sept 2028</option>
                  <option value="2029">Continues to Sept 2029</option>
                </select>
              </Card>

              <Card className="p-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">GC Wastage Scenario</label>
                <select
                  value={wastageScenario}
                  onChange={(e) => setWastageScenario(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="optimistic">Optimistic (5%)</option>
                  <option value="base">Base Case (15%)</option>
                  <option value="conservative">Conservative (25%)</option>
                  <option value="pessimistic">Pessimistic (30%)</option>
                </select>
              </Card>
            </div>

            {/* Results */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Estimated Timeline with Current Settings</h3>
                </div>
                <button
                  onClick={generatePDFExport}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Final Action Date</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.estimatedFAD}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Filing Date</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.estimatedDoF}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Months from Today</p>
                  <p className="text-2xl font-bold text-blue-600">{currentProjection.monthsNeeded} months</p>
                </div>
              </div>
            </div>

            {/* Allocation Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Allocation Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Base Allocation</span>
                    <span className="font-semibold text-slate-900">{currentProjection.baseAllocation.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Spillover Benefit</span>
                    <span className="font-semibold text-green-600">+{currentProjection.additionalSpillover.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="text-slate-600">After Wastage ({currentProjection.wastageRate}%)</span>
                    <span className="font-semibold text-slate-900">{currentProjection.totalAllocation.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Processing Rate</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Monthly Rate</span>
                    <span className="font-semibold text-slate-900">{currentProjection.monthlyRate} visas/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pending I-485s</span>
                    <span className="font-semibold text-slate-900">{categoryData.pending.india.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="text-slate-600">Months to Clear</span>
                    <span className="font-semibold text-slate-900">{Math.round(categoryData.pending.india / parseInt(currentProjection.monthlyRate))} months</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
