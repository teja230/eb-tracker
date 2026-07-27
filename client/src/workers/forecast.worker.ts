/**
 * Web Worker: Monte Carlo forecast computation
 *
 * Runs forecastScenario (500 paths × 4 scenarios) off the main thread so
 * the UI stays fully responsive during parameter changes.
 */

import {
  forecastScenario,
  backtestForecast,
  type ForecastContext,
  type ForecastPolicy,
  type ForecastProjection,
  type BacktestSummary,
  type ForecastBulletin,
  type DemandInputs,
} from "@/lib/forecast";

// ─── Message types ─────────────────────────────────────────────────────────────

export type WorkerProjectionsRequest = {
  id: string;
  type: "projections";
  forecastContext: ForecastContext;
  today: string; // ISO date string — serialised from Date
  currentFad: string;
  currentDof: string;
  currentFadUnavailable?: boolean;
  currentUnavailabilityHoldMonths?: number;
  targetDate: string;
  gcLagMonths: number;
  forecastStartMonthIndex: number;
  adjustedRates: Record<string, number>;
  forecastPolicies: Record<string, ForecastPolicy>;
  selectedCategory: string;
  deferredSpillover: string;
  deferredBan: string;
  deferredWastage: string;
};

export type WorkerBacktestRequest = {
  id: string;
  type: "backtest";
  bulletins: ForecastBulletin[];
  demand: DemandInputs;
  baseRate: number;
  gcLagMonths: number;
  selectedCategory: string;
};

export type WorkerProjectionsResponse = {
  id: string;
  type: "projections_result";
  projections: Record<string, ForecastProjection>;
};

export type WorkerBacktestResponse = {
  id: string;
  type: "backtest_result";
  backtestResult: BacktestSummary;
};

type WorkerRequest = WorkerProjectionsRequest | WorkerBacktestRequest;

// ─── Worker handler ────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "projections") {
    const today = new Date(msg.today);
    const projections: Record<string, ForecastProjection> = {};

    for (const key of Object.keys(msg.adjustedRates)) {
      projections[key] = forecastScenario({
        context: msg.forecastContext,
        today,
        currentFad: msg.currentFad,
        currentDof: msg.currentDof,
        currentFadUnavailable: msg.currentFadUnavailable,
        currentUnavailabilityHoldMonths: msg.currentUnavailabilityHoldMonths,
        targetDate: msg.targetDate,
        baseFadRate: msg.adjustedRates[key],
        gcLagMonths: msg.gcLagMonths,
        seasonalityStartMonth: msg.forecastStartMonthIndex,
        policy: msg.forecastPolicies[key],
        paths: 500,
        maxMonths: 240,
        seed: `${msg.selectedCategory}:${msg.targetDate}:${key}:${msg.deferredSpillover}:${msg.deferredBan}:${msg.deferredWastage}`,
      });
    }

    const response: WorkerProjectionsResponse = {
      id: msg.id,
      type: "projections_result",
      projections,
    };
    self.postMessage(response);
  } else if (msg.type === "backtest") {
    const backtestResult = backtestForecast({
      bulletins: msg.bulletins,
      demand: msg.demand,
      baseFadRate: msg.baseRate,
      gcLagMonths: msg.gcLagMonths,
      horizonMonths: 6,
      paths: 200,
      seed: `${msg.selectedCategory}:backtest`,
    });

    const response: WorkerBacktestResponse = {
      id: msg.id,
      type: "backtest_result",
      backtestResult,
    };
    self.postMessage(response);
  }
};
