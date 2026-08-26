// Design: a civic-data dashboard foregrounds the current bulletin status before forecast detail.
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  useDeferredValue,
  lazy,
  Suspense,
} from "react";

import { CheckCircle2, Moon, Share2, Sun } from "lucide-react";
import { toast } from "sonner";

import ErrorBoundary from "@/components/ErrorBoundary";
import PriorityDatePicker from "@/components/PriorityDatePicker";
import { FloatingChatWidget } from "@/components/TrackerEnhancements";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CURRENT_BULLETIN,
  DATA_FRESHNESS,
  EB_CATEGORIES,
  SCENARIOS,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import { useForecastData } from "@/hooks/useForecastData";
import { useIsMobile } from "@/hooks/useMobile";
import { cutoffDateLabel } from "@/lib/bulletinStatus";
import { exportTrackerPdf } from "@/lib/pdfExport";
import {
  fmtDate,
  fmtDateStr,
  fmtDuration,
  isValidDateStr,
  parseDateStr,
} from "@/lib/trackerUtils";
import {
  DEFAULT_HISTORY_WINDOW,
  bulletinUrl,
  historicalCategoryKeys,
  type HistoricalChartPoint,
} from "@/pages/homeShared";
const OverviewTab = lazy(() =>
  import("@/pages/tabs/OverviewTab").then(m => ({ default: m.OverviewTab }))
);
const ScenariosTab = lazy(() =>
  import("@/pages/tabs/ScenariosTab").then(m => ({ default: m.ScenariosTab }))
);
const TrackerTab = lazy(() =>
  import("@/pages/tabs/TrackerTab").then(m => ({ default: m.TrackerTab }))
);
const CompareTab = lazy(() =>
  import("@/pages/tabs/CompareTab").then(m => ({ default: m.CompareTab }))
);

export default function Home() {
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const [isForecastPending, startForecastTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return ["overview", "scenarios", "tracker", "compare"].includes(tab ?? "")
      ? tab!
      : "overview";
  });
  const [selectedCategory, setSelectedCategory] =
    useState<TrackerCategoryKey>("EB2");
  const [targetDate, setTargetDate] = useState("2016-08-01");
  const [lastToastDate, setLastToastDate] = useState("");
  const [dateFlash, setDateFlash] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [expandedFadFYs, setExpandedFadFYs] = useState<Set<string>>(
    new Set(["FY2026"])
  );
  const [expandedDofFYs, setExpandedDofFYs] = useState<Set<string>>(
    new Set(["FY2026"])
  );
  const fadStarRowRef = useRef<HTMLTableRowElement>(null);
  const dofStarRowRef = useRef<HTMLTableRowElement>(null);
  const [activeHistoricalPoint, setActiveHistoricalPoint] =
    useState<HistoricalChartPoint | null>(null);
  const [historyWindow, setHistoryWindow] = useState(DEFAULT_HISTORY_WINDOW);
  const [spilloverLevel, setSpilloverLevel] = useState<
    "low" | "moderate" | "high"
  >("high");
  const [banContinues, setBanContinues] = useState<"2027" | "2028" | "2029">(
    "2029"
  );
  const [wastageLevel, setWastageLevel] = useState<"low" | "moderate" | "high">(
    "low"
  );

  const deferredSpillover = useDeferredValue(spilloverLevel);
  const deferredBan = useDeferredValue(banContinues);
  const deferredWastage = useDeferredValue(wastageLevel);
  const isAssumptionPending =
    deferredSpillover !== spilloverLevel ||
    deferredBan !== banContinues ||
    deferredWastage !== wastageLevel;

  const cat = EB_CATEGORIES[selectedCategory];
  const currentFadUnavailable = cat.currentFADStatus === "unavailable";
  const { fadKey, dofKey } = historicalCategoryKeys(selectedCategory);

  const {
    adjustedRates,
    backtestResult,
    categoryComparisonRows,
    currentCutoffs,
    demandDensityData,
    fullHistoricalChartData,
    gapMonths,
    historicalChartData,
    historicalXAxisTicks,
    historicalYAxisTicks,
    historyWindowSummary,
    isArchiveHistoryWindow,
    isFullHistoryWindow,
    isRecentHistoryWindow,
    overviewAssumptionSummary,
    overviewProjection,
    pendingInventoryTotal,
    projections,
    recentPaceInsight,
    sensitivityByOption,
    sensitivityRows,
    trackerSourceLinks,
    accelZone,
    activeHistoricalInsight,
    chartYDomain,
    fyBoundaries,
    forecastContext,
    forecastPolicies,
    forecastStartMonthIndex,
  } = useForecastData({
    selectedCategory,
    targetDate,
    spilloverLevel,
    banContinues,
    wastageLevel,
    deferredSpillover,
    deferredBan,
    deferredWastage,
    historyWindow,
    activeHistoricalPoint,
    isMobile,
    fadKey,
    dofKey,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pd = params.get("pd");
    const catParam = params.get("cat") as keyof typeof EB_CATEGORIES | null;
    const sp = params.get("sp") as "low" | "moderate" | "high" | null;
    const ban = params.get("ban") as "2027" | "2028" | "2029" | null;
    const wst = params.get("wst") as "low" | "moderate" | "high" | null;
    if (pd && isValidDateStr(pd)) setTargetDate(pd);
    if (catParam && catParam in EB_CATEGORIES) setSelectedCategory(catParam);
    if (sp && ["low", "moderate", "high"].includes(sp)) setSpilloverLevel(sp);
    if (ban && ["2027", "2028", "2029"].includes(ban)) setBanContinues(ban);
    if (wst && ["low", "moderate", "high"].includes(wst)) setWastageLevel(wst);
  }, []);

  const handleDateChange = useCallback(
    (val: string) => {
      startForecastTransition(() => setTargetDate(val));
      if (val !== lastToastDate && val) {
        const d = parseDateStr(val);
        toast.success(`Projections updated for ${fmtDate(d)}`, {
          description: "All scenarios and estimates have been recalculated.",
          duration: 3000,
          position: "bottom-right",
        });
        setLastToastDate(val);
        setDateFlash(true);
        setTimeout(() => setDateFlash(false), 800);
      }
    },
    [lastToastDate]
  );

  const updateSelectedCategory = useCallback((category: TrackerCategoryKey) => {
    startForecastTransition(() => setSelectedCategory(category));
  }, []);
  const updateSpilloverLevel = useCallback(
    (value: "low" | "moderate" | "high") => setSpilloverLevel(value),
    []
  );
  const updateBanContinues = useCallback(
    (value: "2027" | "2028" | "2029") => setBanContinues(value),
    []
  );
  const updateWastageLevel = useCallback(
    (value: "low" | "moderate" | "high") => setWastageLevel(value),
    []
  );
  const toggleFadFY = useCallback((fy: string) => {
    setExpandedFadFYs(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  }, []);
  const toggleDofFY = useCallback((fy: string) => {
    setExpandedDofFYs(prev => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy);
      else next.add(fy);
      return next;
    });
  }, []);
  const expandFadFY = useCallback((fy: string) => {
    setExpandedFadFYs(prev => new Set(prev).add(fy));
  }, []);
  const expandDofFY = useCallback((fy: string) => {
    setExpandedDofFYs(prev => new Set(prev).add(fy));
  }, []);

  useEffect(() => {
    setActiveHistoricalPoint((prev: HistoricalChartPoint | null) => {
      if (historicalChartData.length === 0) return null;
      if (!prev) return historicalChartData[historicalChartData.length - 1];
      return (
        historicalChartData.find(point => point.month === prev.month) ??
        historicalChartData[historicalChartData.length - 1]
      );
    });
  }, [historicalChartData]);

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
  }, [
    banContinues,
    selectedCategory,
    spilloverLevel,
    targetDate,
    wastageLevel,
  ]);

  const handleShare = useCallback(async () => {
    const url = generateShareUrl();
    const overviewFadDate = overviewProjection?.fadDate;
    const fadMonthYear = overviewFadDate
      ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][overviewFadDate.getMonth()]} ${overviewFadDate.getFullYear()}`
      : "unknown";
    const overviewDofDate = overviewProjection?.dofDate;
    const dofMonthYear = overviewDofDate
      ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][overviewDofDate.getMonth()]} ${overviewDofDate.getFullYear()}`
      : null;
    const summary = dofMonthYear
      ? `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) — can file I-485 around ${dofMonthYear}, become current around ${fadMonthYear} (best case).`
      : `My ${cat.label} India priority date (${fmtDateStr(targetDate)}) is estimated to become current around ${fadMonthYear} (best case).`;
    const sentence = `${summary} ${url}`;
    const copyShareText = async () => {
      await navigator.clipboard.writeText(sentence);
      setShareCopied(true);
      toast.success("Estimate copied to clipboard!", {
        description:
          sentence.length > 80 ? sentence.slice(0, 80) + "…" : sentence,
        duration: 4000,
        position: "bottom-right",
      });
      setTimeout(() => setShareCopied(false), 3000);
    };

    try {
      if (isMobile && typeof navigator.share === "function") {
        await navigator.share({
          title: `${cat.label} India estimate`,
          text: summary,
          url,
        });
        return;
      }

      await copyShareText();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await copyShareText();
        return;
      } catch {
        // Fall through to prompt fallback below.
      }

      window.prompt("Copy this to share your estimate:", sentence);
    }
  }, [cat.label, generateShareUrl, isMobile, overviewProjection, targetDate]);

  const generateExport = async () => {
    await exportTrackerPdf({
      category: cat,
      targetDate,
      gapMonths,
      overviewProjection,
      projections,
      spilloverLevel,
      banContinues,
      wastageLevel,
      siteUrl: window.location.origin,
    });
    toast.success("PDF exported!", { duration: 2000 });
  };

  const tabs = [
    { id: "overview", label: "📊 Overview", mobileLabel: "Overview" },
    { id: "scenarios", label: "📈 Scenarios", mobileLabel: "Scenarios" },
    { id: "tracker", label: "📋 Bulletin Tracker", mobileLabel: "Tracker" },
    { id: "compare", label: "⚖️ Compare", mobileLabel: "Compare" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <header
        className="bg-white sticky top-0 z-10"
        style={{ boxShadow: "0 1px 0 #e2e8f0" }}
      >
        <div className="md:hidden">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="bg-slate-900 text-white rounded-md px-2.5 py-1 font-black text-[11px] tracking-[0.15em] leading-none shrink-0">
                  EB
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">
                  Priority Date Tracker
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={handleShare}
                  aria-label="Share estimate"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                    shareCopied
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {shareCopied ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-100 p-1">
              <div className="grid grid-cols-3 gap-1">
                {(
                  Object.keys(EB_CATEGORIES) as Array<
                    keyof typeof EB_CATEGORIES
                  >
                ).map(c => (
                  <button
                    key={c}
                    onClick={() => updateSelectedCategory(c)}
                    aria-pressed={selectedCategory === c}
                    className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition-all ${
                      selectedCategory === c
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {EB_CATEGORIES[c].label}
                  </button>
                ))}
              </div>
            </div>

            <nav
              className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
              aria-label="Tracker sections"
            >
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  aria-pressed={activeTab === t.id}
                  className={`min-w-0 truncate whitespace-nowrap rounded-lg px-1 py-2 text-[11px] font-semibold transition-all ${
                    activeTab === t.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {t.mobileLabel}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="hidden md:block max-w-7xl mx-auto">
          <div className="flex items-stretch h-12 px-4">
            <div className="flex items-center pr-4 shrink-0">
              <div className="bg-slate-900 text-white rounded-md px-2.5 py-1 font-black text-[11px] tracking-[0.15em] leading-none">
                EB
              </div>
            </div>
            <div className="w-px bg-slate-100 my-2.5 shrink-0" />
            <div className="flex items-center gap-1 px-4 shrink-0">
              {(
                Object.keys(EB_CATEGORIES) as Array<keyof typeof EB_CATEGORIES>
              ).map(c => (
                <button
                  key={c}
                  onClick={() => updateSelectedCategory(c)}
                  aria-pressed={selectedCategory === c}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${selectedCategory === c ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200"}`}
                >
                  <span className="font-bold">{EB_CATEGORIES[c].label}</span>
                  <span
                    className={`hidden lg:inline font-normal ${selectedCategory === c ? "text-slate-300" : "text-slate-400"}`}
                  >
                    {" "}
                    — {EB_CATEGORIES[c].name.split(" / ")[0]}
                  </span>
                </button>
              ))}
            </div>
            <div className="w-px bg-slate-100 my-2.5 shrink-0" />
            <nav
              className="flex items-stretch px-2 flex-1"
              aria-label="Tracker sections"
            >
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  aria-pressed={activeTab === t.id}
                  className={`relative px-4 text-sm font-semibold transition-colors flex items-center whitespace-nowrap ${activeTab === t.id ? "text-slate-900" : "text-slate-400 hover:text-slate-700"}`}
                >
                  {t.label}
                  {activeTab === t.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-slate-900 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2 pl-2 shrink-0">
              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900"
                >
                  {theme === "dark" ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                onClick={handleShare}
                aria-label="Share estimate"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${shareCopied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"}`}
              >
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

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 pt-4 pb-8 space-y-4"
      >
        <h1 className="sr-only">EB India Priority Date Tracker and Forecast</h1>
        {activeTab !== "compare" && (
          <div
            className={`overflow-hidden rounded-lg border shadow-sm ${
              currentFadUnavailable
                ? "border-amber-300 shadow-amber-950/[0.04]"
                : "border-slate-300"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-stretch">
              <div className="flex-1 px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Your Priority Date
                  </label>
                  <span className="border-l border-slate-300 pl-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {CURRENT_BULLETIN.month} bulletin
                  </span>
                  {currentFadUnavailable && (
                    <span className="rounded-sm border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
                      FAD unavailable
                    </span>
                  )}
                </div>
                <PriorityDatePicker
                  value={targetDate}
                  onChange={handleDateChange}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Change to see updated projections for any priority date.
                </p>
              </div>
              <div
                className={`grid grid-cols-3 md:flex md:items-stretch md:divide-x border-t md:border-t-0 md:border-l transition-all duration-300 ${
                  currentFadUnavailable
                    ? "divide-amber-200 border-amber-200 bg-amber-50/70"
                    : dateFlash
                      ? "divide-blue-200 border-blue-300 bg-blue-50"
                      : "divide-slate-200 border-slate-200 bg-slate-50"
                }`}
              >
                {[
                  {
                    label: "Current FAD",
                    value: cutoffDateLabel(
                      cat.currentFAD,
                      cat.currentFADStatus
                    ),
                    tip: "Final Action Date — the cutoff date for visa availability",
                  },
                  {
                    label: "Gap",
                    value: currentFadUnavailable
                      ? "Unavailable"
                      : gapMonths > 0
                        ? fmtDuration(gapMonths)
                        : "Current",
                    tip: "Months between your priority date and the current Final Action Date",
                  },
                  {
                    label: "Current DoF",
                    value: cutoffDateLabel(
                      cat.currentDoF,
                      cat.currentDoFStatus
                    ),
                    tip: "Dates for Filing — the earliest date you can submit I-485",
                  },
                ].map(({ label, value, tip }) => (
                  <div
                    key={label}
                    className="flex flex-col justify-center items-center px-3 py-3 md:px-5 md:py-4 md:min-w-[100px] group relative"
                  >
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap mb-1 flex items-center gap-1">
                      {label}
                      <span
                        className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-200 text-slate-400 text-[8px] font-bold cursor-help"
                        title={tip}
                      >
                        i
                      </span>
                    </p>
                    <p
                      className={`font-mono text-sm font-bold whitespace-nowrap md:text-sm ${
                        currentFadUnavailable &&
                        (label === "Current FAD" || label === "Gap")
                          ? "text-amber-800"
                          : "text-slate-800"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {(isForecastPending || isAssumptionPending) && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            Updating forecast projections
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300 mr-2" />
              Loading…
            </div>
          }
        >
          {activeTab === "overview" && (
            <ErrorBoundary>
              <OverviewTab
                accelZone={accelZone}
                activeHistoricalInsight={activeHistoricalInsight}
                activeHistoricalPoint={activeHistoricalPoint}
                adjustedRates={adjustedRates}
                backtestResult={backtestResult}
                cat={cat}
                categoryComparisonRows={categoryComparisonRows}
                chartYDomain={chartYDomain}
                currentCutoffs={currentCutoffs}
                demandDensityData={demandDensityData}
                forecastContext={forecastContext}
                forecastPolicies={forecastPolicies}
                forecastStartMonthIndex={forecastStartMonthIndex}
                fullHistoricalChartData={fullHistoricalChartData}
                fyBoundaries={fyBoundaries}
                generateShareUrl={generateShareUrl}
                historicalChartData={historicalChartData}
                historicalXAxisTicks={historicalXAxisTicks}
                historicalYAxisTicks={historicalYAxisTicks}
                historyWindowSummary={historyWindowSummary}
                isArchiveHistoryWindow={isArchiveHistoryWindow}
                isFullHistoryWindow={isFullHistoryWindow}
                isMobile={isMobile}
                isRecentHistoryWindow={isRecentHistoryWindow}
                overviewAssumptionSummary={overviewAssumptionSummary}
                overviewProjection={overviewProjection}
                pendingInventoryTotal={pendingInventoryTotal}
                projections={projections}
                recentPaceInsight={recentPaceInsight}
                selectedCategory={selectedCategory}
                setActiveHistoricalPoint={setActiveHistoricalPoint}
                setHistoryWindow={setHistoryWindow}
                setShowMethodology={setShowMethodology}
                showMethodology={showMethodology}
                targetDate={targetDate}
                trackerSourceLinks={trackerSourceLinks}
                updateSelectedCategory={updateSelectedCategory}
                onCompareDate={() => setActiveTab("compare")}
                onAdjustAssumptions={() => setActiveTab("scenarios")}
              />
            </ErrorBoundary>
          )}

          {activeTab === "scenarios" && (
            <ErrorBoundary>
              <ScenariosTab
                adjustedRates={adjustedRates}
                backtestResult={backtestResult}
                banContinues={banContinues}
                cat={cat}
                generateExport={generateExport}
                isAssumptionPending={isAssumptionPending}
                overviewAssumptionSummary={overviewAssumptionSummary}
                projections={projections}
                selectedCategory={selectedCategory}
                sensitivityByOption={sensitivityByOption}
                sensitivityRows={sensitivityRows}
                spilloverLevel={spilloverLevel}
                targetDate={targetDate}
                updateBanContinues={updateBanContinues}
                updateSpilloverLevel={updateSpilloverLevel}
                updateWastageLevel={updateWastageLevel}
                wastageLevel={wastageLevel}
              />
            </ErrorBoundary>
          )}

          {activeTab === "compare" && (
            <ErrorBoundary>
              <CompareTab
                adjustedRates={adjustedRates}
                cat={cat}
                forecastContext={forecastContext}
                forecastPolicies={forecastPolicies}
                forecastStartMonthIndex={forecastStartMonthIndex}
                selectedCategory={selectedCategory}
                targetDate={targetDate}
              />
            </ErrorBoundary>
          )}

          {activeTab === "tracker" && (
            <ErrorBoundary>
              <TrackerTab
                cat={cat}
                dofStarRowRef={dofStarRowRef}
                expandedDofFYs={expandedDofFYs}
                expandedFadFYs={expandedFadFYs}
                fadStarRowRef={fadStarRowRef}
                onExpandDofFY={expandDofFY}
                onExpandFadFY={expandFadFY}
                selectedCategory={selectedCategory}
                targetDate={targetDate}
                toggleDofFY={toggleDofFY}
                toggleFadFY={toggleFadFY}
                trackerSourceLinks={trackerSourceLinks}
              />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-slate-600 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-semibold text-slate-900">
              EB Priority Date Tracker
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Research estimates only. This tool is not legal advice and does
              not predict official DOS or USCIS decisions. Latest tracked
              bulletin: {CURRENT_BULLETIN.month}; data last verified{" "}
              {DATA_FRESHNESS.lastVerified}.
            </p>
          </div>
          <nav aria-label="Category guides">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Guides
            </p>
            <div className="grid gap-1.5">
              <a href="/eb-1-india" className="hover:text-slate-900">
                EB-1 India guide
              </a>
              <a href="/eb-2-india" className="hover:text-slate-900">
                EB-2 India guide
              </a>
              <a href="/eb-3-india" className="hover:text-slate-900">
                EB-3 India guide
              </a>
            </div>
          </nav>
          <nav aria-label="Methodology and sources">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sources
            </p>
            <div className="grid gap-1.5">
              <a href="/methodology" className="hover:text-slate-900">
                Methodology
              </a>
              <a href="/visa-bulletin-history" className="hover:text-slate-900">
                Visa bulletin history
              </a>
              <a
                href={bulletinUrl(CURRENT_BULLETIN.month)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900"
              >
                Current DOS bulletin
              </a>
            </div>
          </nav>
        </div>
      </footer>
      <FloatingChatWidget
        categoryLabel={cat.label}
        categoryName={cat.name}
        targetDate={targetDate}
        currentFad={cat.currentFAD}
        currentDof={cat.currentDoF}
        projections={projections}
        scenarios={SCENARIOS}
        assumptionsSummary={overviewAssumptionSummary}
        backtest={backtestResult}
        sourceLinks={trackerSourceLinks}
      />
    </div>
  );
}
