# EB Priority Date Tracker

A research-backed, interactive web application for tracking and forecasting U.S. Employment-Based (EB) green card priority dates for India-born applicants. Built with React 19, Recharts, and Tailwind CSS.

**Live at:** [ebtracker.manus.space](https://ebtracker.manus.space)

---

## Overview

The EB Priority Date Tracker helps India-born employment-based green card applicants estimate when their priority date will become current. It combines historical visa bulletin data, pending I-485 inventory statistics, and a research-backed projection model to generate scenario-based forecasts across EB-1, EB-2, and EB-3 categories.

The tracker is updated monthly when new visa bulletins are released by the U.S. Department of State.

---

## Features

| Feature                       | Description                                                                    |
|-------------------------------|--------------------------------------------------------------------------------|
| **Priority Date Calculator**  | Enter any priority date and instantly see DoF, FAD, and GC receipt estimates   |
| **Multi-Category Support**    | EB-1 (Priority Workers), EB-2 (Advanced Degree), EB-3 (Skilled Workers)        |
| **Four Scenario Projections** | Optimistic, Base Case, Conservative, and Pessimistic with probability weights  |
| **Bulletin Tracker**          | Historical Final Action Dates and Dates for Filing with Δ movement columns     |
| **Wastage Simulator**         | Adjust spillover level, ban duration, and GC wastage to model custom scenarios |
| **PDF/Text Export**           | Export personalized scenario estimates for sharing with immigration attorneys  |
| **Live Data Status**          | Displays current bulletin month and ROW category status                        |

---

## Projection Algorithm

### FAD Advance Rate Model

The tracker uses the **FAD Advance Rate Model**, which projects when a priority date becomes current by dividing the gap in priority-date months by a scenario-specific advance rate.

```
months_from_today = gap_PD_months ÷ fad_advance_rate
estimated_date    = TODAY + months_from_today
```

**Where:**
- `gap_PD_months` — Number of priority-date months between the current FAD and the target priority date
- `fad_advance_rate` — Priority-date months advanced per calendar month (scenario-dependent)

**Derived estimates:**
- **Dates for Filing (DoF)** = FAD estimate − 6 months (EB-2 historical lead)
- **GC Receipt** = FAD estimate + 15 months (EB-2 midpoint of 12–18 month range)

### Scenario Rates (EB-2 India)

| Scenario     | Rate (PD-mo/month) | Probability | Condition                                    |
|--------------|--------------------|-------------|----------------------------------------------|
| Optimistic   | 1.625              | 15–20%      | 60k+ extra EB visas (large FY2027 spillover) |
| Base Case    | 0.975              | 40%         | 30–40k extra EB visas (moderate spillover)   |
| Conservative | 0.45               | 30%         | No spillover, reversion to pre-FY2026 pace   |
| Pessimistic  | 0.275              | 10–15%      | Ban reversed, stagnation / retrogression     |

Rates are calibrated from historical visa bulletin data (Jan 2023–Apr 2026) and two research documents synthesizing findings from Capitol Immigration Law Group, AM22Tech, Manifest Law, and Beyondborderglobal.

### Simulator Multipliers

The Wastage Simulator adjusts the base rates using three multipliers:

| Control         | Low               | Moderate             | High                 |
|-----------------|-------------------|----------------------|----------------------|
| Spillover Level | ×0.75             | ×1.00                | ×1.25                |
| Ban Duration    | ×0.85 (ends 2027) | ×1.00 (through 2028) | ×1.15 (through 2029) |
| GC Wastage      | ×1.10 (5–10%)     | ×1.00 (15–20%)       | ×0.80 (25–30%)       |

---

## Data Sources

| Source                                                                                                                                                                                                        | Usage                                                    |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| [U.S. Department of State Visa Bulletins](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html)                                                                                      | Monthly FAD and DoF data (Apr 2026 is current)           |
| [USCIS I-485 Pending Inventory (Oct 2025)](https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates)                                                             | Pending application counts by category and priority date |
| [Cato Institute — GC Wastage Analysis](https://www.cato.org/blog/agencies-wasted-1/4-employment-green-cards-2021)                                                                                             | FY2021 wastage rates by category                         |
| [CLINIC v. Rubio Lawsuit](https://www.nilc.org/resources/questions-and-answers-about-the-75-country-visa-ban-lawsuit/)                                                                                        | Legal status of 75-country visa ban                      |
| [VisaHQ — 75-Country Ban Spillover Analysis](https://www.visahq.com/news/2026-01-24/in/us-pause-on-immigrant-visas-for-75-countries-could-add-50000-employment-green-cards-big-win-for-indian-professionals/) | Estimated 50k–70k spillover range                        |
| Capitol Immigration Law Group, AM22Tech, Manifest Law, Beyondborderglobal                                                                                                                                     | Scenario range research synthesis                        |

---

## Current Bulletin Data (April 2026)

| Category   | Final Action Date | Dates for Filing |
|------------|-------------------|------------------|
| EB-1 India | Apr 1, 2023       | Dec 1, 2023      |
| EB-2 India | **Jul 15, 2014**  | Jan 15, 2015     |
| EB-3 India | Nov 15, 2013      | Jan 15, 2015     |
| EB-1 ROW   | CURRENT           | CURRENT          |
| EB-2 ROW   | CURRENT           | CURRENT          |
| EB-3 ROW   | CURRENT           | CURRENT          |

> **Note:** EB-1 ROW and EB-2 ROW being CURRENT is significant — it means all family-based visa spillover flows directly to backlogged countries (India, China) rather than being absorbed by ROW demand. This is the primary driver of the FY2027 optimistic scenario.

---

## Key Concepts

### Per-Country Cap
U.S. immigration law limits any single country to no more than 7% of annual employment-based green cards (~9,800 visas/year at the 140,000 annual EB cap). India, despite representing the largest share of EB applicants, is subject to this cap, creating the multi-decade backlog.

### Visa Spillover
Under INA §201(d), unused family-based visas spill over to employment-based categories. When other countries cannot use their family-based allocation (e.g., due to the 75-country ban), those visas become available to EB applicants. Critically, spillover **favors backlogged countries** when ROW categories are current — meaning India receives a disproportionately large share.

### Green Card Wastage
Visas go unused when applicants fail medical exams, face security clearance delays, or miss consular interview windows. Historical EB-2 India wastage is ~20%; EB-3 India ~49%. During travel bans, wastage increases due to consular backlogs.

### FY2027 Spillover Context
Presidential Proclamations 10949 & 10998 (January 2026) paused immigrant visas for 75+ countries. India, China, Mexico, and the Philippines were **exempt**. Unused family-based visas from banned countries are estimated to generate 50k–70k additional EB visas in FY2027 (Oct 1, 2026 – Sep 30, 2027). The legal challenge (CLINIC v. Rubio) remains active as of March 2026.

---

## Estimate for August 2016 Priority Date (EB-2 India)

As of April 2026, the EB-2 India FAD is **Jul 15, 2014** — 25 priority-date months away from Aug 2016.

| Scenario     | DoF Reaches Aug 2016   | FAD Reaches Aug 2016 | GC Receipt  | Probability |
|--------------|------------------------|----------------------|-------------|-------------|
| Optimistic   | Late 2026 – Early 2027 | Late 2027 – 2028     | 2028 – 2029 | 15–20%      |
| Base Case    | Mid–Late 2027          | 2028 – 2029          | 2029 – 2031 | 40%         |
| Conservative | 2028 – 2029            | 2030 – 2033          | 2031 – 2035 | 30%         |
| Pessimistic  | 2030 – 2033            | 2032 – 2036          | 2033 – 2038 | 10–15%      |

---

## Tech Stack

| Layer         | Technology            |
|---------------|-----------------------|
| Framework     | React 19 + TypeScript |
| Styling       | Tailwind CSS 4        |
| Charts        | Recharts 2            |
| UI Components | shadcn/ui (Radix UI)  |
| Routing       | Wouter                |
| Notifications | Sonner                |
| Build         | Vite 7                |
| Hosting       | Manus (manus.space)   |

---

## Project Structure

```
eb2-india-tracker/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Home.tsx          ← Main tracker component (all logic + UI)
│   │   ├── components/ui/        ← shadcn/ui primitives
│   │   ├── contexts/             ← ThemeContext
│   │   ├── App.tsx               ← Router
│   │   └── index.css             ← Global styles + Tailwind tokens
│   └── index.html
├── server/
│   └── index.ts                  ← Static file server (production)
├── README_PROJECT.md             ← This file
└── package.json
```

---

## Updating Monthly Data

When a new visa bulletin is released (typically the second Tuesday of each month):

1. Open `client/src/pages/Home.tsx`
2. Update `CURRENT_BULLETIN` at the top of the file with the new FAD and DoF values
3. Add a new entry to `HISTORICAL_BULLETINS` array (insert at index 0, most recent first)
4. Update `TODAY` constant to the current date
5. Save and deploy

---

## Disclaimer

This tool is for informational and educational purposes only. Estimates are based on historical trends, publicly available visa bulletin data, and probabilistic modeling. Actual timelines may vary significantly due to policy changes, legislative action, retrogression, or other factors. This tool does not constitute legal advice. Consult a qualified immigration attorney for guidance specific to your situation.

---

## License

MIT License. Data sourced from U.S. government publications and publicly available research.
