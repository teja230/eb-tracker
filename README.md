# EB Priority Date Tracker

A research-backed, interactive web application for tracking and forecasting U.S. Employment-Based (EB) green card priority dates for India-born applicants. Built with React 19, Recharts, and Tailwind CSS.

**Live at:** [ebtracker.manus.space](https://ebtracker.manus.space)

---

## Overview

The EB Priority Date Tracker helps India-born employment-based green card applicants estimate when their priority date will become current. It combines historical visa bulletin data, pending I-485 inventory statistics, and a research-backed projection model to generate scenario-based forecasts across EB-1, EB-2, and EB-3 categories.

The tracker is updated monthly when new visa bulletins are released by the U.S. Department of State.

---

## Features

| Feature                       | Description                                                                                                      |
|-------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Priority Date Calculator**  | Enter any priority date and instantly see DoF, FAD, and GC receipt estimates                                     |
| **Multi-Category Support**    | EB-1 (Priority Workers), EB-2 (Advanced Degree), EB-3 (Skilled Workers)                                          |
| **Four Scenario Projections** | Optimistic, Base, Conservative, Pessimistic — each with P10/P50/P90 ranges                                       |
| **Historical Movement Chart** | Interactive chart with FAD/DoF lines, FY boundaries, and acceleration zones                                      |
| **Queue Depth Chart**         | Demand density by PD year using hybrid I-485 inventory + I-140 approval data                                     |
| **Bulletin Tracker**          | Historical Final Action Dates and Dates for Filing with Δ movement columns, including FY2020-FY2022 archive rows |
| **Adjust Assumptions**        | Tune spillover level, ban duration, and GC wastage to model custom scenarios                                     |
| **Backtesting**               | Rolling 6-month MAE + 80% interval coverage for model transparency                                               |
| **PDF + Share Export**        | Export a personalized PDF and share a summary on mobile or copy it on desktop                                    |

---

## Projection Algorithm (v8)

### Probabilistic Dual-Cutoff Simulator

The tracker runs **500 Monte Carlo paths per scenario**, simulating both FAD and DoF month by month. Each simulated bulletin month:

```
delta = baseRate × clamp(seasonality + residualSample, -2.25, 3.25) / √clamp(demand/ref, 0.6, 1.8)
```

**Where:**
- `baseRate` — Scenario's calibrated FAD rate, scaled by assumption multipliers (spillover × ban × wastage)
- `seasonality` — FY-month factor derived from historical bulletin movement (clamped 0.65–1.6)
- `residualSample` — Randomly drawn from that FY-month's historical residual bucket (70% bucket / 30% overall)
- `demand/ref` — Hybrid demand curve value for the current PD-year cursor ÷ median reference

**Demand curve (hybrid model):**
- **Primary**: USCIS I-485 Pending Inventory (Oct 2025) — actual queue depth by PD year
- **Fallback**: USCIS I-140 Approval Data (FY2025 Q3) — scaled to I-485 magnitude using median overlap ratio

**Output per scenario:**
- **P10 / P50 / P90** quantile dates for DoF, FAD, and GC receipt
- **Retrogression risk** — % of paths where at least one negative month occurred
- **DoF** modeled independently of its own historical series (not FAD minus fixed offset)
- **GC Receipt** = FAD + category-specific lag (EB-2: ~15 months)

### Scenario Rates (EB-2 India)

| Scenario     | Rate (PD-mo/month) | Probability | Condition                                    |
|--------------|--------------------|-------------|----------------------------------------------|
| Optimistic   | 1.625              | 15–20%      | 60k+ extra EB visas (large FY2027 spillover) |
| Base Case    | 0.975              | 40%         | 30–40k extra EB visas (moderate spillover)   |
| Conservative | 0.45               | 30%         | No spillover, reversion to pre-FY2026 pace   |
| Pessimistic  | 0.275              | 10–15%      | Ban reversed, stagnation / retrogression     |

Rates are calibrated from 43 months of verified visa bulletin data (Oct 2022–Apr 2026). The Bulletin Tracker tab also includes FY2020-FY2022 archival rows, but those older rows are kept out of the forecast model so seasonality and backtests stay anchored to the contiguous recent series. Backtesting uses rolling 6-month windows to compute MAE and 80% interval coverage.

### Simulator Multipliers

The Adjust Assumptions panel modifies the base rates using three multipliers. The combined multiplier applies to every projected month:

```
adjustedRate = baseRate × spilloverMultiplier × banMultiplier × wastageMultiplier
```

| Control         | Low                                    | Moderate (Base)              | High                                    |
|-----------------|----------------------------------------|------------------------------|-----------------------------------------|
| Spillover Level | ×0.75 (~30k extra EB visas)            | ×1.00 (~50k extra)           | ×1.25 (~70k+ extra)                     |
| Ban Duration    | ×0.85 (ends 2027 — court reversal)     | ×1.00 (through 2028)         | ×1.15 (through 2029 — full term)        |
| GC Wastage      | ×1.10 (5–10%, efficient processing)    | ×1.00 (15–20%, typical)      | ×0.80 (25–30%, systemic delays)         |

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

`Current bulletin` in this README means the **latest released U.S. Department of State Visa Bulletin**, not the calendar month on today's date. As of **March 19, 2026**, the latest released bulletin is **April 2026**.

| Category   | Final Action Date | Dates for Filing |
|------------|-------------------|------------------|
| EB-1 India | Apr 1, 2023       | Dec 1, 2023      |
| EB-2 India | **Jul 15, 2014**  | Jan 15, 2015     |
| EB-3 India | Nov 15, 2013      | Jan 15, 2015     |
| EB-1 ROW   | CURRENT           | CURRENT          |
| EB-2 ROW   | CURRENT           | CURRENT          |
| EB-3 ROW   | CURRENT           | CURRENT          |

> **Note:** EB-1 ROW and EB-2 ROW being CURRENT does not itself create extra visas. It means ROW demand is not absorbing otherwise-available employment-based numbers. Separately, unused family-based numbers can spill into employment-based visas under INA §201(d). When both conditions hold, more of the expanded EB supply can reach backlogged countries such as India and China.

---

## Key Concepts

### Per-Country Cap
U.S. immigration law limits any single country to no more than 7% of annual employment-based green cards (~9,800 visas/year at the 140,000 annual EB cap). India, despite representing the largest share of EB applicants, is subject to this cap, creating the multi-decade backlog.

### Visa Spillover
Under INA §201(d), unused family-based visas spill over to employment-based categories. When other countries cannot use their family-based allocation (e.g., due to the 75-country ban), those visas become available to EB applicants. Critically, spillover **favors backlogged countries** when ROW categories are current — meaning India receives a disproportionately large share.

### Green Card Wastage
Visas go unused due to processing friction — medical exams, security clearances, or interview windows. FY2021: 25% overall wastage (66k of 262k available). FY2022: near 0% after USCIS processing reforms. Higher visa supply combined with processing gaps increases wastage risk.

### FY2027 Spillover Context
Presidential Proclamations 10949 & 10998 (January 2026) indefinitely paused immigrant visas for 75+ countries. India, China, Mexico, and the Philippines are **exempt**. Unused family-based visas from banned countries are estimated to generate 50k–70k additional EB visas in FY2027 (Oct 1, 2026 – Sep 30, 2027), projecting a total EB quota of 190k–211k. The legal challenge (*CLINIC v. Rubio*, SDNY, filed Feb 2026) remains active.

---

## Example: August 2016 Priority Date (EB-2 India)

As of April 2026, the EB-2 India FAD is **Jul 15, 2014** — 25 priority-date months away from Aug 2016. The simulator generates 500 paths per scenario; displayed dates are P50 medians with 80% intervals (P10–P90). Actual ranges are dynamically computed — see the live app for current output.

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

## Local Development

Use **pnpm** for local installs in this repository. The project includes `pnpm-lock.yaml` and a `patchedDependencies` entry in `package.json` for the Wouter patch under `patches/wouter@3.7.1.patch`, so `pnpm install` is the supported setup path.

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

---

## Project Structure

```
eb-tracker/
├── ideas.md                         ← Product and design working notes
├── patches/
│   └── wouter@3.7.1.patch          ← pnpm patched dependency applied at install time
├── client/
│   ├── src/
│   │   ├── data/
│   │   │   └── trackerData.ts       ← Model history, Bulletin Tracker archive, category metadata, scenarios, demand inputs
│   │   ├── pages/
│   │   │   └── Home.tsx             ← Main tracker component (UI + derived view models)
│   │   ├── lib/
│   │   │   ├── forecast.ts          ← v8 probabilistic forecast engine
│   │   │   ├── forecast.test.ts     ← Forecast-engine unit tests
│   │   │   └── trackerUtils.ts      ← Shared date and formatting helpers
│   │   ├── components/
│   │   │   ├── ui/                  ← shadcn/ui primitives
│   │   │   ├── PriorityDatePicker.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── hooks/
│   │   │   └── useMobile.tsx        ← Responsive breakpoint hook
│   │   ├── App.tsx                  ← Router (Wouter)
│   │   └── index.css                ← Global styles + Tailwind tokens
│   └── index.html
├── server/
│   └── index.ts                     ← Static file server (production)
├── shared/                          ← Shared cross-runtime code
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

---

## Updating Monthly Data

When a new visa bulletin is released (typically the second Tuesday of each month):

1. Open `client/src/data/trackerData.ts`
2. Update `CURRENT_BULLETIN` with the new month, FAD, and DoF values for EB-1/EB-2/EB-3
3. Add a new entry to `HISTORICAL_BULLETINS` array (insert at index 0, most recent first)
4. Verify `TODAY` is set to `new Date()` (auto-updates, do not hardcode)
5. If new I-485 inventory data is available, update `I485_INDIA_PENDING`
6. If new I-140 approval data is available, update `I140_INDIA_APPROVALS`
7. Recalculate and verify any displayed category totals, notes, or inventory summaries that depend on those tables
8. Check for month- or category-specific hardcoded UI text outside the data tables (for example "Already Current" copy, pace cards, and explanatory notes)
9. If you backfill older fiscal years for the Bulletin Tracker, add them to `ARCHIVED_BULLETIN_TRACKER_HISTORY` instead of `HISTORICAL_BULLETINS`, which must remain contiguous for the forecast engine
10. Save and deploy

---

## Disclaimer

This tool is for informational and educational purposes only. Estimates are based on historical trends, publicly available visa bulletin data, and probabilistic modeling. Actual timelines may vary significantly due to policy changes, legislative action, retrogression, or other factors. This tool does not constitute legal advice. Consult a qualified immigration attorney for guidance specific to your situation.

---

## License

MIT License. Data sourced from U.S. government publications and publicly available research.
