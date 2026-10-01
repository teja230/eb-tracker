export type TrackerCategoryKey = "EB1" | "EB2" | "EB3";
export type CutoffStatus = "available" | "unavailable";

export type CurrentBulletinCategory = {
  fad: string;
  dof: string;
  fadStatus?: CutoffStatus;
  dofStatus?: CutoffStatus;
};

export type HistoricalBulletinRow = {
  month: string;
  eb1_fad: string;
  eb1_dof: string;
  eb1_fad_status?: CutoffStatus;
  eb1_dof_status?: CutoffStatus;
  eb2_fad: string;
  eb2_dof: string;
  eb2_fad_status?: CutoffStatus;
  eb2_dof_status?: CutoffStatus;
  eb3_fad: string;
  eb3_dof: string;
  eb3_fad_status?: CutoffStatus;
  eb3_dof_status?: CutoffStatus;
};

// October 2026 Visa Bulletin data (most recent)
// October marks the FY2027 reset: EB-2 India is available again after being
// unavailable in the July–September 2026 bulletins.
export const CURRENT_BULLETIN: {
  month: string;
  eb1: CurrentBulletinCategory;
  eb2: CurrentBulletinCategory;
  eb3: CurrentBulletinCategory;
} = {
  month: "October 2026",
  eb1: { fad: "2023-02-01", dof: "2024-07-01" },
  eb2: { fad: "2013-11-01", dof: "2015-01-15" },
  eb3: { fad: "2014-01-01", dof: "2015-01-15" },
};

export const DATA_FRESHNESS = {
  modelVersion: "v9",
  lastVerified: "October 1, 2026",
  currentBulletinPublished: "September 4, 2026",
  nextExpectedUpdate: "mid-November 2026",
  adjustmentChartNote:
    "Verify USCIS chart selection before filing I-485; the October DOS bulletin provides the published Final Action and Dates for Filing cutoffs. Forecast receipt lag is calibrated to USCIS FY2026 Q3 I-485 performance.",
};

// USCIS FY2026 Q3 I-485 performance data (Apr–Jun 2026). This is a national
// service-center operations signal, not an India priority-date inventory. The
// derived lag is used as a floor for the modeled receipt timeline.
export const I485_PERFORMANCE = {
  period: "FY2026 Q3 (Apr–Jun 2026)",
  sourceUrl:
    "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
  received: 97501,
  approved: 42076,
  denied: 3160,
  pending: 268408,
  completed: 45236,
  pendingToCompletedQuarters: 5.932,
  derivedProcessingLagMonths: 18,
} as const;

export const I140_Q3_RECEIPTS_INDIA = {
  period: "FY2026 Q3",
  eb1: 3699,
  eb2: 12231,
  eb3: 3619,
  total: 19549,
  sourceUrl:
    "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
} as const;

export const TRACKER_SOURCE_LINKS = [
  {
    label: "DOS Visa Bulletin",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    detail: "Official monthly Final Action Date and Dates for Filing source.",
  },
  {
    label: "USCIS Visa Bulletin Info",
    href: "https://www.uscis.gov/visabulletininfo",
    detail:
      "USCIS adjustment-of-status chart selection and visa availability information.",
  },
  {
    label: "USCIS Pending Inventory",
    href: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates",
    detail:
      "Employment-based pending I-485 inventory source used for demand density.",
  },
  {
    label: "USCIS I-140 Data",
    href: "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
    detail:
      "FY2026 Q3 India I-140 approvals by fiscal year and preference, used as a proxy for future demand beyond filed inventory.",
  },
  {
    label: "USCIS I-485 Performance",
    href: "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data",
    detail:
      "FY2026 Q3 national I-485 receipts, approvals, denials, and pending workload used to calibrate operational receipt lag.",
  },
];

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
// 2. I-140 Approval Counts (USCIS Form I-140 Receipts and Current Status,
//    FY2026 Q3; queried July 2026). The companion quarterly performance report
//    records 19,549 India receipts in FY2026 Q3; those receipts are retained as
//    a flow signal but are not added to queue depth because receipts do not carry
//    the priority-date distribution needed for a direct inventory estimate.
//    Proxy for future demand in PD years beyond I-485 coverage. Not a direct
//    measure of queue depth (approval year ≠ PD year), but the best available
//    signal for years where no one has been able to file I-485 yet.
//
// Hybrid logic: Use I-485 inventory where it exists (most accurate for near-term
// PD years). Fall back to I-140 approvals for years beyond inventory coverage.

export const I485_INDIA_PENDING: Record<
  TrackerCategoryKey,
  Record<number, number>
> = {
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

export const I140_INDIA_APPROVALS: Record<
  TrackerCategoryKey,
  Record<number, number>
> = {
  EB1: {
    2014: 6372,
    2015: 6126,
    2016: 7734,
    2017: 8496,
    2018: 7574,
    2019: 6877,
    2020: 6193,
    2021: 7233,
    2022: 8095,
    2023: 11004,
    2024: 9725,
    2025: 8655,
    2026: 4085,
  },
  EB2: {
    2014: 24393,
    2015: 30798,
    2016: 46748,
    2017: 40163,
    2018: 38330,
    2019: 42408,
    2020: 33713,
    2021: 36259,
    2022: 43876,
    2023: 37032,
    2024: 35276,
    2025: 33933,
    2026: 23032,
  },
  EB3: {
    2014: 3827,
    2015: 6248,
    2016: 9941,
    2017: 8594,
    2018: 8047,
    2019: 11162,
    2020: 9020,
    2021: 47962,
    2022: 16492,
    2023: 12479,
    2024: 10147,
    2025: 10000,
    2026: 8170,
  },
};

// EB Category metadata — order determines tab display order (EB-1, EB-2, EB-3)
export const EB_CATEGORIES = {
  EB1: {
    label: "EB-1",
    name: "Priority Workers / Multinational Managers",
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
    density: { category: "EB1" as const },
    currentFADStatus: CURRENT_BULLETIN.eb1.fadStatus ?? "available",
    currentDoFStatus: CURRENT_BULLETIN.eb1.dofStatus ?? "available",
    notes:
      "EB-1 India has ~14.3k pending I-485s. October FAD advances to Feb 1, 2023 as FY2027 numbers become available. Massive spike at PD-2022 (10,953 cases) remains the primary demand constraint.",
  },
  EB2: {
    label: "EB-2",
    name: "Advanced Degree / Exceptional Ability",
    currentFAD: CURRENT_BULLETIN.eb2.fad,
    currentDoF: CURRENT_BULLETIN.eb2.dof,
    rates: {
      optimistic: 1.625,
      base: 0.85,
      conservative: 0.45,
      pessimistic: 0.275,
    },
    dofLeadMonths: 6,
    gcLagMonths: 15,
    annualVisas: 2850,
    density: { category: "EB2" as const },
    currentFADStatus: CURRENT_BULLETIN.eb2.fadStatus ?? "available",
    currentDoFStatus: CURRENT_BULLETIN.eb2.dofStatus ?? "available",
    notes:
      "EB-2 India is available again in October after the July–September unavailability. The FY2027 reset publishes a Nov 1, 2013 Final Action Date and Jan 15, 2015 Dates for Filing cutoff; forecast dates now use the live October FAD.",
  },
  EB3: {
    label: "EB-3",
    name: "Skilled Workers / Professionals",
    currentFAD: CURRENT_BULLETIN.eb3.fad,
    currentDoF: CURRENT_BULLETIN.eb3.dof,
    rates: {
      optimistic: 1.2,
      base: 0.6,
      conservative: 0.35,
      pessimistic: 0.2,
    },
    dofLeadMonths: 6,
    gcLagMonths: 18,
    annualVisas: 3000,
    density: { category: "EB3" as const },
    currentFADStatus: CURRENT_BULLETIN.eb3.fadStatus ?? "available",
    currentDoFStatus: CURRENT_BULLETIN.eb3.dofStatus ?? "available",
    notes:
      "EB-3 India has ~14.9k pending I-485s. 98% concentrated in PD-2013/2014. October FAD holds at Jan 1, 2014 while DoF remains Jan 15, 2015.",
  },
};

export const SCENARIOS = {
  optimistic: {
    label: "Optimistic",
    probability: "10–15%",
    color: "#10b981",
    tailwindColor: "emerald",
    spillover: "60k+ extra EB visas (FY2027 materializes at scale)",
    description:
      "Large FY2027 spillover materializes. 75-country ban persists through Sept 2026, generating 60k+ extra EB visas. Movement resumes early in FY2027 after the July/August unavailability and summer stall. Historical parallel: COVID FY2021–22 created 120k+ extra EB visas.",
  },
  base: {
    label: "Base Case",
    probability: "35%",
    color: "#3b82f6",
    tailwindColor: "blue",
    spillover: "30–40k extra EB visas (moderate spillover)",
    description:
      "Moderate FY2027 spillover but FY2026 correction continues through summer. USCIS stays on Table A (Final Action Dates). Minimal or corrective movement through September, with recovery modeled from FY2027.",
  },
  conservative: {
    label: "Conservative",
    probability: "35%",
    color: "#f59e0b",
    tailwindColor: "amber",
    spillover: "No spillover, reversion to pre-FY2026 pace",
    description:
      'Ban reversed or scaled back, spillover limited. Feb–Apr movement confirmed artificial ("boomerang effect" per Oppenheim), then corrected by June-August. Reverts to pre-FY2026 pace of 2–4 months/year.',
  },
  pessimistic: {
    label: "Pessimistic",
    probability: "15–20%",
    color: "#ef4444",
    tailwindColor: "red",
    spillover: "Stagnation / retrogression",
    description:
      "DOS continues retrogression or reopens unavailability during FY2027. Ban reversed, demand surge from pent-up I-485 filings. Pace drops below the pre-FY2026 baseline.",
  },
};

// Forecast-model history (most recent first)
// ALL values verified against official travel.state.gov bulletins (Oct 2022 – October 2026)
// EB-1 India "C" (Current) in Oct–Dec 2022 represented using bulletin month date.
export const HISTORICAL_BULLETINS: HistoricalBulletinRow[] = [
  {
    month: "October 2026",
    eb1_fad: "2023-02-01",
    eb1_dof: "2024-07-01",
    eb2_fad: "2013-11-01",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "September 2026",
    eb1_fad: "2022-10-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_fad_status: "unavailable",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "August 2026",
    eb1_fad: "2022-10-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_fad_status: "unavailable",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "July 2026",
    eb1_fad: "2022-10-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_fad_status: "unavailable",
    eb2_dof: "2015-01-15",
    eb3_fad: "2014-01-01",
    eb3_dof: "2015-01-15",
  },
  {
    month: "June 2026",
    eb1_fad: "2022-12-15",
    eb1_dof: "2023-12-01",
    eb2_fad: "2013-09-01",
    eb2_dof: "2015-01-15",
    eb3_fad: "2013-12-15",
    eb3_dof: "2015-01-15",
  },
  {
    month: "May 2026",
    eb1_fad: "2023-04-01",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_dof: "2015-01-15",
    eb3_fad: "2013-11-15",
    eb3_dof: "2015-01-15",
  },
  {
    month: "Apr 2026",
    eb1_fad: "2023-04-01",
    eb1_dof: "2023-12-01",
    eb2_fad: "2014-07-15",
    eb2_dof: "2015-01-15",
    eb3_fad: "2013-11-15",
    eb3_dof: "2015-01-15",
  },
  {
    month: "Mar 2026",
    eb1_fad: "2023-03-01",
    eb1_dof: "2023-12-01",
    eb2_fad: "2013-09-15",
    eb2_dof: "2014-11-01",
    eb3_fad: "2013-11-15",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Feb 2026",
    eb1_fad: "2023-02-01",
    eb1_dof: "2023-08-01",
    eb2_fad: "2013-07-15",
    eb2_dof: "2013-12-01",
    eb3_fad: "2013-11-15",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Jan 2026",
    eb1_fad: "2023-02-01",
    eb1_dof: "2023-08-01",
    eb2_fad: "2013-07-15",
    eb2_dof: "2013-12-01",
    eb3_fad: "2013-11-15",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Dec 2025",
    eb1_fad: "2022-03-15",
    eb1_dof: "2023-04-15",
    eb2_fad: "2013-05-15",
    eb2_dof: "2013-12-01",
    eb3_fad: "2013-09-22",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Nov 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2023-04-15",
    eb2_fad: "2013-04-01",
    eb2_dof: "2013-12-01",
    eb3_fad: "2013-08-22",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Oct 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2023-04-15",
    eb2_fad: "2013-04-01",
    eb2_dof: "2013-12-01",
    eb3_fad: "2013-08-22",
    eb3_dof: "2014-08-15",
  },
  {
    month: "Sep 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-05-22",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Aug 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-05-22",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Jul 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-04-22",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Jun 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-04-15",
    eb3_dof: "2013-06-08",
  },
  {
    month: "May 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-04-15",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Apr 2025",
    eb1_fad: "2022-02-15",
    eb1_dof: "2022-04-15",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-02-01",
    eb3_fad: "2013-04-01",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Mar 2025",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-12-01",
    eb2_dof: "2013-01-01",
    eb3_fad: "2013-02-01",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Feb 2025",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-10-15",
    eb2_dof: "2013-01-01",
    eb3_fad: "2012-12-15",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Jan 2025",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-10-01",
    eb2_dof: "2013-01-01",
    eb3_fad: "2012-12-01",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Dec 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-08-01",
    eb2_dof: "2013-01-01",
    eb3_fad: "2012-11-08",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Nov 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-07-15",
    eb2_dof: "2013-01-01",
    eb3_fad: "2012-11-01",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Oct 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-04-15",
    eb2_fad: "2012-07-15",
    eb2_dof: "2013-01-01",
    eb3_fad: "2012-11-01",
    eb3_dof: "2013-06-08",
  },
  {
    month: "Sep 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-02-08",
    eb2_fad: "2012-07-15",
    eb2_dof: "2012-07-22",
    eb3_fad: "2012-10-22",
    eb3_dof: "2012-11-01",
  },
  {
    month: "Aug 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-02-08",
    eb2_fad: "2012-07-15",
    eb2_dof: "2012-07-22",
    eb3_fad: "2012-10-22",
    eb3_dof: "2012-11-01",
  },
  {
    month: "Jul 2024",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-02-08",
    eb2_fad: "2012-06-15",
    eb2_dof: "2012-06-22",
    eb3_fad: "2012-09-22",
    eb3_dof: "2012-10-01",
  },
  {
    month: "Jun 2024",
    eb1_fad: "2021-03-01",
    eb1_dof: "2021-04-01",
    eb2_fad: "2012-04-15",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-08-22",
    eb3_dof: "2012-09-15",
  },
  {
    month: "May 2024",
    eb1_fad: "2021-03-01",
    eb1_dof: "2021-04-01",
    eb2_fad: "2012-04-15",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-08-15",
    eb3_dof: "2012-09-15",
  },
  {
    month: "Apr 2024",
    eb1_fad: "2021-03-01",
    eb1_dof: "2021-04-01",
    eb2_fad: "2012-04-15",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-08-15",
    eb3_dof: "2012-09-15",
  },
  {
    month: "Mar 2024",
    eb1_fad: "2020-10-01",
    eb1_dof: "2021-01-01",
    eb2_fad: "2012-03-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-07-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Feb 2024",
    eb1_fad: "2020-09-01",
    eb1_dof: "2021-01-01",
    eb2_fad: "2012-03-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-07-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Jan 2024",
    eb1_fad: "2020-09-01",
    eb1_dof: "2021-01-01",
    eb2_fad: "2012-03-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-06-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Dec 2023",
    eb1_fad: "2017-01-01",
    eb1_dof: "2019-07-01",
    eb2_fad: "2012-01-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-05-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Nov 2023",
    eb1_fad: "2017-01-01",
    eb1_dof: "2019-07-01",
    eb2_fad: "2012-01-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-05-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Oct 2023",
    eb1_fad: "2017-01-01",
    eb1_dof: "2019-07-01",
    eb2_fad: "2012-01-01",
    eb2_dof: "2012-05-15",
    eb3_fad: "2012-05-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Sep 2023",
    eb1_fad: "2012-01-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Aug 2023",
    eb1_fad: "2012-01-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Jul 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Jun 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "May 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Apr 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-01-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Mar 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-10-08",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Feb 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-10-08",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Jan 2023",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2011-10-08",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Dec 2022",
    eb1_fad: "2022-12-01",
    eb1_dof: "2022-12-01",
    eb2_fad: "2011-10-08",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-06-15",
    eb3_dof: "2012-08-01",
  },
  {
    month: "Nov 2022",
    eb1_fad: "2022-11-01",
    eb1_dof: "2022-11-01",
    eb2_fad: "2012-04-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-04-01",
    eb3_dof: "2012-07-01",
  },
  {
    month: "Oct 2022",
    eb1_fad: "2022-10-01",
    eb1_dof: "2022-10-01",
    eb2_fad: "2012-04-01",
    eb2_dof: "2012-05-01",
    eb3_fad: "2012-04-01",
    eb3_dof: "2012-07-01",
  },
];

// Bulletin Tracker archive-only history (most recent first)
// Verified against official travel.state.gov bulletins for FY2022, FY2021, and FY2020.
// EB-1 India "C" (Current) is represented using the bulletin month date.
export const ARCHIVED_BULLETIN_TRACKER_HISTORY: HistoricalBulletinRow[] = [
  {
    month: "Sep 2022",
    eb1_fad: "2022-09-01",
    eb1_dof: "2022-09-01",
    eb2_fad: "2014-12-01",
    eb2_dof: "2015-01-01",
    eb3_fad: "2012-02-15",
    eb3_dof: "2012-02-22",
  },
  {
    month: "Aug 2022",
    eb1_fad: "2022-08-01",
    eb1_dof: "2022-08-01",
    eb2_fad: "2014-12-01",
    eb2_dof: "2015-01-01",
    eb3_fad: "2012-02-15",
    eb3_dof: "2012-02-22",
  },
  {
    month: "Jul 2022",
    eb1_fad: "2022-07-01",
    eb1_dof: "2022-07-01",
    eb2_fad: "2014-12-01",
    eb2_dof: "2015-01-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Jun 2022",
    eb1_fad: "2022-06-01",
    eb1_dof: "2022-06-01",
    eb2_fad: "2014-09-01",
    eb2_dof: "2014-12-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "May 2022",
    eb1_fad: "2022-05-01",
    eb1_dof: "2022-05-01",
    eb2_fad: "2013-09-01",
    eb2_dof: "2014-12-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Apr 2022",
    eb1_fad: "2022-04-01",
    eb1_dof: "2022-04-01",
    eb2_fad: "2013-07-08",
    eb2_dof: "2014-09-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Mar 2022",
    eb1_fad: "2022-03-01",
    eb1_dof: "2022-03-01",
    eb2_fad: "2013-05-01",
    eb2_dof: "2013-09-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Feb 2022",
    eb1_fad: "2022-02-01",
    eb1_dof: "2022-02-01",
    eb2_fad: "2013-01-01",
    eb2_dof: "2013-09-01",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Jan 2022",
    eb1_fad: "2022-01-01",
    eb1_dof: "2022-01-01",
    eb2_fad: "2012-07-08",
    eb2_dof: "2013-07-08",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Dec 2021",
    eb1_fad: "2021-12-01",
    eb1_dof: "2021-12-01",
    eb2_fad: "2012-05-01",
    eb2_dof: "2013-07-08",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Nov 2021",
    eb1_fad: "2021-11-01",
    eb1_dof: "2021-11-01",
    eb2_fad: "2011-12-01",
    eb2_dof: "2013-01-08",
    eb3_fad: "2012-01-15",
    eb3_dof: "2012-01-22",
  },
  {
    month: "Oct 2021",
    eb1_fad: "2021-10-01",
    eb1_dof: "2021-10-01",
    eb2_fad: "2011-09-01",
    eb2_dof: "2012-07-08",
    eb3_fad: "2014-01-01",
    eb3_dof: "2014-01-08",
  },
  {
    month: "Sep 2021",
    eb1_fad: "2021-09-01",
    eb1_dof: "2021-09-01",
    eb2_fad: "2011-09-01",
    eb2_dof: "2011-12-01",
    eb3_fad: "2014-01-01",
    eb3_dof: "2014-03-01",
  },
  {
    month: "Aug 2021",
    eb1_fad: "2021-08-01",
    eb1_dof: "2021-08-01",
    eb2_fad: "2011-06-01",
    eb2_dof: "2011-12-01",
    eb3_fad: "2013-07-01",
    eb3_dof: "2014-02-01",
  },
  {
    month: "Jul 2021",
    eb1_fad: "2021-07-01",
    eb1_dof: "2021-07-01",
    eb2_fad: "2011-06-01",
    eb2_dof: "2011-12-01",
    eb3_fad: "2013-01-01",
    eb3_dof: "2014-02-01",
  },
  {
    month: "Jun 2021",
    eb1_fad: "2021-06-01",
    eb1_dof: "2021-06-01",
    eb2_fad: "2010-12-01",
    eb2_dof: "2011-08-01",
    eb3_fad: "2011-11-01",
    eb3_dof: "2014-01-01",
  },
  {
    month: "May 2021",
    eb1_fad: "2021-05-01",
    eb1_dof: "2021-05-01",
    eb2_fad: "2010-08-01",
    eb2_dof: "2011-05-15",
    eb3_fad: "2011-02-01",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Apr 2021",
    eb1_fad: "2021-04-01",
    eb1_dof: "2021-04-01",
    eb2_fad: "2010-05-01",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-09-01",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Mar 2021",
    eb1_fad: "2020-08-01",
    eb1_dof: "2021-03-01",
    eb2_fad: "2010-01-15",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-07-01",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Feb 2021",
    eb1_fad: "2020-01-01",
    eb1_dof: "2020-11-01",
    eb2_fad: "2009-10-12",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-04-01",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Jan 2021",
    eb1_fad: "2019-09-01",
    eb1_dof: "2020-11-01",
    eb2_fad: "2009-10-08",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-03-22",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Dec 2020",
    eb1_fad: "2019-04-01",
    eb1_dof: "2020-11-01",
    eb2_fad: "2009-10-01",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-03-15",
    eb3_dof: "2014-01-01",
  },
  {
    month: "Nov 2020",
    eb1_fad: "2018-12-01",
    eb1_dof: "2020-09-01",
    eb2_fad: "2009-09-22",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-03-01",
    eb3_dof: "2015-01-01",
  },
  {
    month: "Oct 2020",
    eb1_fad: "2018-06-01",
    eb1_dof: "2020-09-01",
    eb2_fad: "2009-09-01",
    eb2_dof: "2011-05-15",
    eb3_fad: "2010-01-15",
    eb3_dof: "2015-01-01",
  },
  {
    month: "Sep 2020",
    eb1_fad: "2018-03-01",
    eb1_dof: "2018-07-01",
    eb2_fad: "2009-07-08",
    eb2_dof: "2009-08-15",
    eb3_fad: "2009-10-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Aug 2020",
    eb1_fad: "2018-02-08",
    eb1_dof: "2018-07-01",
    eb2_fad: "2009-07-08",
    eb2_dof: "2009-08-15",
    eb3_fad: "2009-10-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Jul 2020",
    eb1_fad: "2017-05-08",
    eb1_dof: "2017-08-01",
    eb2_fad: "2009-07-08",
    eb2_dof: "2009-08-15",
    eb3_fad: "2009-06-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Jun 2020",
    eb1_fad: "2016-06-08",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-06-12",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-04-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "May 2020",
    eb1_fad: "2015-08-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-06-02",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-03-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Apr 2020",
    eb1_fad: "2015-05-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-25",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-22",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Mar 2020",
    eb1_fad: "2015-03-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-22",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-15",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Feb 2020",
    eb1_fad: "2015-01-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-19",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-08",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Jan 2020",
    eb1_fad: "2015-01-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-18",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Dec 2019",
    eb1_fad: "2015-01-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-15",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Nov 2019",
    eb1_fad: "2015-01-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-13",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2010-02-01",
  },
  {
    month: "Oct 2019",
    eb1_fad: "2015-01-01",
    eb1_dof: "2017-03-15",
    eb2_fad: "2009-05-12",
    eb2_dof: "2009-07-01",
    eb3_fad: "2009-01-01",
    eb3_dof: "2010-02-01",
  },
];

export const BULLETIN_TRACKER_HISTORY: HistoricalBulletinRow[] = [
  ...HISTORICAL_BULLETINS,
  ...ARCHIVED_BULLETIN_TRACKER_HISTORY,
];
