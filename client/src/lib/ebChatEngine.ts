/**
 * EB Tracker Chat Engine — locally coded Q&A model
 *
 * No LLMs or external APIs. Answers are composed entirely from:
 *   - trackerData.ts  (bulletins, scenarios, queue depth, I-485 inventory)
 *   - Forecast projections produced by forecast.ts
 *   - Backtest results
 *
 * Architecture:
 *   1. Weighted intent scoring  (tokenised keyword → score)
 *   2. Entity extraction        (category / scenario mentioned in question)
 *   3. History-based fallback   (reuse last intent for short follow-ups)
 *   4. Answer composition       (fluent prose with real data interpolated)
 *   5. Follow-up suggestions    (context-specific chips after each reply)
 */

import type { BacktestSummary, ForecastProjection } from "./forecast";
import type { SourceLink } from "@/components/TrackerEnhancements";
import { cutoffDateLabel, rowCutoffDateLabel } from "@/lib/bulletinStatus";
import { fmtDate, fmtDateStr, fmtDuration, parseDateStr } from "./trackerUtils";
import {
  HISTORICAL_BULLETINS,
  I485_INDIA_PENDING,
  SCENARIOS,
  EB_CATEGORIES,
} from "@/data/trackerData";
import type { TrackerCategoryKey } from "@/data/trackerData";

// ─── PUBLIC TYPES ─────────────────────────────────────────────────────────────

export type Intent =
  | "dof_vs_fad"
  | "filing"
  | "fad"
  | "green_card"
  | "queue"
  | "scenarios"
  | "ban"
  | "retrogression"
  | "comparison"
  | "confidence"
  | "history"
  | "legal"
  | "general";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: Intent;
  suggestions?: string[];
  sources?: SourceLink[];
  timestamp: number;
}

export interface EngineContext {
  categoryLabel: string;
  categoryKey: TrackerCategoryKey;
  targetDate: string;
  currentFad: string;
  currentDof: string;
  projections: Record<string, ForecastProjection>;
  scenarios: Record<
    string,
    { label: string; probability: string; color: string; description: string }
  >;
  assumptionsSummary: string;
  backtest: BacktestSummary;
  sourceLinks: SourceLink[];
}

// ─── INTENT PATTERNS  [keyword, weight] ──────────────────────────────────────

const INTENT_PATTERNS: Record<Intent, Array<[string, number]>> = {
  dof_vs_fad: [
    ["dof vs fad", 10],
    ["dof explained", 9],
    ["what is dof", 8],
    ["what is fad", 8],
    ["explain dof", 8],
    ["explain fad", 8],
    ["dof mean", 7],
    ["fad mean", 7],
    ["filing vs final", 7],
    ["difference between dof", 9],
    ["two dates", 5],
    ["two cutoffs", 5],
  ],
  filing: [
    ["when can i file", 8],
    ["can i file", 6],
    ["file i-485", 7],
    ["filing window", 7],
    ["when to file", 6],
    ["submit i-485", 6],
    ["adjustment of status", 6],
    ["eligible to file", 7],
    ["dof current", 6],
    ["when is dof", 6],
    ["file adjustment", 5],
  ],
  fad: [
    ["when will my fad", 9],
    ["when does fad", 8],
    ["fad current", 7],
    ["fad be current", 7],
    ["fad become current", 7],
    ["final action date", 7],
    ["final action", 5],
    ["when will my priority", 7],
    ["priority date current", 8],
    ["pd current", 6],
    ["when will my pd", 7],
    ["movement", 3],
    ["advance", 3],
    ["cutoff advance", 5],
  ],
  green_card: [
    ["green card", 7],
    ["how long until", 6],
    ["how long to", 6],
    ["when will i get", 5],
    ["gc receipt", 7],
    ["permanent resident", 6],
    ["gc date", 6],
    ["receive my green", 7],
    ["get approved", 4],
    ["how long", 4],
  ],
  queue: [
    ["how many people", 8],
    ["how many ahead", 8],
    ["queue", 7],
    ["backlog", 7],
    ["pending i-485", 6],
    ["inventory", 6],
    ["people ahead", 7],
    ["how big is the", 5],
    ["demand density", 7],
    ["how deep", 6],
    ["i-485 pending", 6],
    ["applicants ahead", 7],
    ["cases ahead", 7],
  ],
  scenarios: [
    ["why do scenarios", 9],
    ["scenario", 6],
    ["optimistic", 5],
    ["conservative", 5],
    ["pessimistic", 5],
    ["base case", 5],
    ["assumption", 5],
    ["spillover amount", 6],
    ["why differ", 8],
    ["how are scenarios", 7],
    ["what drives", 5],
  ],
  ban: [
    ["visa ban", 9],
    ["75-country", 9],
    ["75 country", 9],
    ["proclamation", 8],
    ["10949", 9],
    ["10998", 9],
    ["executive order", 7],
    ["immigrant visa ban", 9],
    ["clinic v rubio", 9],
    ["rubio", 5],
    ["ban impact", 8],
    ["ban affect", 8],
    ["country ban", 7],
  ],
  retrogression: [
    ["retro shock", 10],
    ["retrogress", 9],
    ["retro risk", 9],
    ["what does retro", 9],
    ["unavailable", 6],
    ["retrogression", 9],
    ["go back", 5],
    ["move back", 5],
    ["risk of retro", 9],
    ["will it retrogress", 9],
    ["could it go back", 7],
  ],
  comparison: [
    ["compare eb", 8],
    ["eb-1 vs", 7],
    ["eb-2 vs", 7],
    ["eb-3 vs", 7],
    ["eb categories", 7],
    ["difference between eb", 8],
    ["which category", 7],
    ["eb1 vs eb2", 8],
    ["eb2 vs eb3", 8],
    ["switch category", 7],
    ["port", 5],
    ["downgrade to", 6],
    ["upgrade to", 6],
  ],
  confidence: [
    ["what does 80%", 9],
    ["80% confidence", 8],
    ["80% interval", 8],
    ["p50", 7],
    ["p90", 7],
    ["p10", 7],
    ["how accurate", 8],
    ["confidence interval", 8],
    ["probability range", 8],
    ["backtest", 7],
    ["how reliable", 7],
    ["how precise", 7],
    ["uncertainty", 6],
  ],
  history: [
    ["what happened", 7],
    ["recent movement", 8],
    ["last few months", 7],
    ["historical", 7],
    ["trend", 6],
    ["past bulletins", 8],
    ["bulletin history", 8],
    ["what changed", 6],
    ["last bulletin", 7],
    ["recent bulletins", 8],
    ["movement since", 6],
    ["data from", 5],
  ],
  legal: [
    ["legal advice", 10],
    ["attorney", 9],
    ["lawyer", 9],
    ["should i file", 8],
    ["should i downgrade", 9],
    ["should i switch", 8],
    ["should i change", 7],
    ["strategy", 7],
    ["recommend", 6],
    ["is this legal", 9],
    ["case strategy", 9],
  ],
  general: [
    ["summary", 5],
    ["overview", 5],
    ["tell me about", 4],
    ["explain", 3],
    ["how does this work", 6],
    ["what is this", 4],
    ["help", 2],
  ],
};

// ─── FOLLOW-UP SUGGESTIONS PER INTENT ────────────────────────────────────────

const FOLLOW_UPS: Record<Intent, string[]> = {
  dof_vs_fad: [
    "When can I file I-485?",
    "When will my FAD be current?",
    "How long until green card?",
  ],
  filing: [
    "When will my FAD be current?",
    "How accurate are these estimates?",
    "DoF vs FAD explained",
  ],
  fad: [
    "When can I file I-485?",
    "How long until green card?",
    "Why do scenarios differ?",
  ],
  green_card: [
    "When will my FAD be current?",
    "How big is the queue ahead?",
    "What is the visa ban impact?",
  ],
  queue: [
    "Why do scenarios differ?",
    "Compare EB categories",
    "What does retro shock mean?",
  ],
  scenarios: [
    "What is the visa ban impact?",
    "How accurate are these estimates?",
    "What does retro shock mean?",
  ],
  ban: [
    "Why do scenarios differ?",
    "What changed in this bulletin?",
    "Compare EB categories",
  ],
  retrogression: [
    "What is the visa ban impact?",
    "How accurate are these estimates?",
    "Why do scenarios differ?",
  ],
  comparison: [
    "When will my FAD be current?",
    "How big is the queue ahead?",
    "Why do scenarios differ?",
  ],
  confidence: [
    "When will my FAD be current?",
    "What does retro shock mean?",
    "How big is the queue ahead?",
  ],
  history: [
    "What changed in this bulletin?",
    "Why do scenarios differ?",
    "What does retro shock mean?",
  ],
  legal: [
    "When will my FAD be current?",
    "DoF vs FAD explained",
    "Compare EB categories",
  ],
  general: [
    "When can I file I-485?",
    "How big is the queue ahead?",
    "What is the visa ban impact?",
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function scoreIntents(text: string): { intent: Intent; score: number }[] {
  const norm = text.toLowerCase().trim();
  return (
    Object.entries(INTENT_PATTERNS) as [Intent, Array<[string, number]>][]
  )
    .map(([intent, patterns]) => ({
      intent,
      score: patterns.reduce(
        (sum, [kw, w]) => sum + (norm.includes(kw) ? w : 0),
        0
      ),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function extractCategory(text: string): TrackerCategoryKey | null {
  if (/eb[-\s]?1\b|priority\s*worker|multinational/i.test(text)) return "EB1";
  if (/eb[-\s]?3\b|skilled\s*worker/i.test(text)) return "EB3";
  if (/eb[-\s]?2\b|advanced\s*degree|exceptional/i.test(text)) return "EB2";
  return null;
}

function extractScenario(text: string): string | null {
  if (/optimistic|best\s*case/i.test(text)) return "optimistic";
  if (/pessimistic|worst\s*case/i.test(text)) return "pessimistic";
  if (/conservative|slow\s*case/i.test(text)) return "conservative";
  if (/base\s*case|moderate/i.test(text)) return "base";
  return null;
}

function projDate(date: Date, capped: boolean): string {
  return capped ? "beyond forecast horizon" : fmtDate(date);
}

// ─── MAIN RESPONSE GENERATOR ─────────────────────────────────────────────────

export function generateResponse(
  question: string,
  context: EngineContext,
  history: ChatMessage[]
): {
  text: string;
  intent: Intent;
  suggestions: string[];
  sources: SourceLink[];
} {
  const scores = scoreIntents(question);

  // Short follow-ups ("tell me more", "and?") fall back to last assistant intent
  const lastAssistantIntent = [...history]
    .reverse()
    .find(m => m.role === "assistant")?.intent;
  const topScore = scores[0]?.score ?? 0;
  const intent: Intent =
    topScore >= 4
      ? scores[0].intent
      : topScore > 0
        ? scores[0].intent
        : (lastAssistantIntent ?? "general");

  // Entity overrides: category / scenario mentioned explicitly in the question
  const mentionedCategory = extractCategory(question);
  const catKey = mentionedCategory ?? context.categoryKey;
  const scenarioKey = extractScenario(question) ?? "base";

  const catMeta = EB_CATEGORIES[catKey];
  const catLbl = catMeta.label;
  const bulletin = HISTORICAL_BULLETINS[0].month;
  const proj = context.projections;
  const opt = proj.optimistic;
  const base = proj.base;
  const cons = proj.conservative;
  const bt = context.backtest;
  const fadStr = cutoffDateLabel(catMeta.currentFAD, catMeta.currentFADStatus);
  const dofStr = cutoffDateLabel(catMeta.currentDoF, catMeta.currentDoFStatus);
  const targetLbl = fmtDateStr(context.targetDate);

  // Queue stats
  const i485Data = I485_INDIA_PENDING[catKey];
  const i485Total = Object.values(i485Data).reduce((a, b) => a + b, 0);
  const topYears = Object.entries(i485Data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([y, n]) => `PD-${y}: ${n.toLocaleString()} cases`)
    .join(", ");

  // Recent bulletin history (last 5)
  const recentHistory = HISTORICAL_BULLETINS.slice(0, 5)
    .map(r => `${r.month}: ${rowCutoffDateLabel(r, catKey, "fad")}`)
    .join(" → ");

  let text = "";
  const sources = context.sourceLinks.slice(0, 3);
  const needsSelectedCategoryProjection = [
    "filing",
    "fad",
    "green_card",
    "confidence",
    "general",
  ].includes(intent);

  if (
    mentionedCategory &&
    mentionedCategory !== context.categoryKey &&
    needsSelectedCategoryProjection
  ) {
    const activeCat = EB_CATEGORIES[context.categoryKey];
    text =
      `I can answer current-cutoff facts for **${catLbl} India**, but the personalized forecast currently loaded in this chat is for **${activeCat.label} India**, priority date ${targetLbl}.\n\n` +
      `Current ${catLbl} cutoffs (${bulletin}): **FAD ${fadStr}** and **DoF ${dofStr}**.\n\n` +
      `For ${catLbl}-specific filing, FAD, green-card, and confidence estimates, switch the active category using the EB category cards in the Overview. That refreshes the forecast inputs and prevents mixing ${catLbl} cutoffs with ${activeCat.label} projections.`;

    return {
      text,
      intent,
      suggestions: [
        "Compare EB categories",
        "How big is the queue ahead?",
        "DoF vs FAD explained",
      ],
      sources,
    };
  }

  switch (intent) {
    case "dof_vs_fad": {
      const isFadUnavailable = catMeta.currentFADStatus === "unavailable";
      const gapMonths = Math.max(
        0,
        Math.round(
          (parseDateStr(context.currentDof).getTime() -
            parseDateStr(context.currentFad).getTime()) /
            (30.44 * 86_400_000)
        )
      );
      text =
        `The DOS Visa Bulletin publishes two separate cutoff dates for EB India each month: **Final Action Date (FAD)** and **Dates for Filing (DoF)**.\n\n` +
        `**DoF** is the earlier cutoff — once your priority date is on or before it, you can file your **I-485 adjustment of status** and immediately receive EAD/Advance Parole work and travel authorization. USCIS holds the case until the FAD catches up.\n\n` +
        `**FAD** is the stricter requirement — your PD must also be on or before the FAD before USCIS can actually approve your case and issue the green card. ` +
        `Currently, ${catLbl} India's FAD is ${fadStr} and DoF is ${dofStr} — a gap of ` +
        `**${isFadUnavailable ? "not measurable while FAD is unavailable" : gapMonths > 0 ? fmtDuration(gapMonths) : "zero (they have converged)"}**. ` +
        `The tracker simulates both cutoffs independently since they advance at different rates.`;
      break;
    }

    case "filing": {
      text =
        `For **${catLbl} India**, priority date ${targetLbl}, your I-485 filing window opens once the **Dates for Filing (DoF)** advances past your PD.\n\n` +
        `Current DoF (${bulletin}): **${dofStr}**. Estimates for your date:\n` +
        `• **Optimistic**: DoF reaches ${targetLbl} by **${projDate(opt.dofDate, opt.horizon.dofP50Capped)}** (P50)\n` +
        `• **Base case**: ${projDate(base.dofDate, base.horizon.dofP50Capped)}\n` +
        `• **Conservative**: ${projDate(cons.dofDate, cons.horizon.dofP50Capped)}\n\n` +
        `Filing early at the DoF stage gets you EAD/AP while you wait for the FAD.` +
        (bt.predictions > 0
          ? ` Model 80% interval coverage: **${Math.round(bt.coverage80 * 100)}%** across ${bt.predictions} backtested windows.`
          : "");
      break;
    }

    case "fad": {
      const scenProj = proj[scenarioKey] ?? base;
      const scenLbl = context.scenarios[scenarioKey]?.label ?? "Base Case";
      text =
        `**${catLbl} India FAD** is currently **${fadStr}** (${bulletin} bulletin).\n\n` +
        `Recent trend: ${recentHistory}\n\n` +
        `**${scenLbl} estimate** for priority date ${targetLbl}: FAD reaches your date by ` +
        `**${projDate(scenProj.fadDate, scenProj.horizon.fadP50Capped)}** (P50 median). ` +
        `For comparison — Optimistic: ${projDate(opt.fadDate, opt.horizon.fadP50Capped)}, ` +
        `Conservative: ${projDate(cons.fadDate, cons.horizon.fadP50Capped)}.\n\n` +
        `October 2026 marks the FY2027 reset: EB-2 India is available again with a Nov 1, 2013 Final Action Date, while EB-1 India advances to Feb 1, 2023 and EB-3 India holds at Jan 1, 2014.`;
      break;
    }

    case "green_card": {
      const gcLag = catMeta.gcLagMonths;
      text =
        `Green card receipt follows the FAD by roughly **${gcLag} months** for ${catLbl} India (I-485 adjudication, biometrics, possible interview, and card production).\n\n` +
        `Estimates for priority date ${targetLbl}:\n` +
        `• **Best case** (Optimistic): GC receipt around **${projDate(opt.gcDate, opt.horizon.gcP50Capped)}**\n` +
        `• **Base case**: ${projDate(base.gcDate, base.horizon.gcP50Capped)}\n` +
        `• **Conservative**: ${projDate(cons.gcDate, cons.horizon.gcP50Capped)}\n\n` +
        `These are P50 median projections — half of simulated paths reach each milestone earlier, half later. Actual timing varies by USCIS field office, case complexity, and RFEs.`;
      break;
    }

    case "queue": {
      text =
        `The demand model for **${catLbl} India** draws from two data sources:\n\n` +
        `**I-485 Pending Inventory (USCIS, Oct 2025):** **${i485Total.toLocaleString()} total** pending applications — actual filed cases waiting for a visa number. Heaviest concentration: ${topYears}.\n\n` +
        `**I-140 Approvals (FY2025 Q3):** Proxy for demand in PD years where no one has yet been able to file I-485 — the "future queue" beyond inventory coverage.\n\n` +
        `Dense PD-years apply a square-root slowdown to FAD advancement. PD-2013 and PD-2014 dominate the density calculation for EB-2 and EB-3, which is why movement in those bands is much slower.`;
      break;
    }

    case "scenarios": {
      const sc = context.scenarios;
      const s = SCENARIOS;
      text =
        `The four scenarios differ only in **policy and processing assumptions** — they all use the same queue depth and historical movement patterns.\n\n` +
        `• **${sc.optimistic?.label}** (${sc.optimistic?.probability} prob.): ${s.optimistic.spillover}. ${s.optimistic.description.split(".")[0]}.\n` +
        `• **${sc.base?.label}** (${sc.base?.probability} prob.): ${s.base.spillover}. ${s.base.description.split(".")[0]}.\n` +
        `• **${sc.conservative?.label}** (${sc.conservative?.probability} prob.): ${s.conservative.spillover}. ${s.conservative.description.split(".")[0]}.\n` +
        `• **${sc.pessimistic?.label}** (${sc.pessimistic?.probability} prob.): ${s.pessimistic.spillover}. ${s.pessimistic.description.split(".")[0]}.\n\n` +
        `Current assumption set: ${context.assumptionsSummary}. Adjust these in the Scenarios tab.`;
      break;
    }

    case "ban": {
      text =
        `**The 75-Country Visa Ban** (Proclamations 10949 & 10998, Jan 2026) suspended immigrant visas for nationals of 75+ countries. India is **exempt** directly.\n\n` +
        `The ban matters for EB India indirectly: unused family-based visas from banned-country nationals **spill over** to employment-based categories under INA §201(d). If sustained through FY2027, this could generate **50,000–70,000 extra EB visas** — the mechanism powering the Optimistic and Base Case scenarios.\n\n` +
        `The ban is being challenged in **CLINIC v. Rubio** (S.D.N.Y., Feb 2026). A reversal would reduce or eliminate the spillover. Use the Adjust Assumptions panel in the Scenarios tab to model different ban-duration outcomes.`;
      break;
    }

    case "retrogression": {
      const nearRisk = Math.round(opt.nearTermRisk * 100);
      const retroRisk = Math.round(opt.retrogressionRisk * 100);
      text =
        `**Retrogression** means DOS sets the FAD *earlier* than the prior month — moving the cutoff backward, forcing applicants to wait again.\n\n` +
        `The July–September 2026 bulletins showed EB-2 India as **unavailable**, but the October FY2027 reset published a live Nov 1, 2013 FAD. The model now treats October as an available cutoff while retaining the prior unavailability in historical risk analysis.\n\n` +
        `Modeled risk (Optimistic scenario, most exposed): near-term risk **${nearRisk}%**, retro shock risk **${retroRisk}%**.` +
        (bt.predictions > 0
          ? ` Backtest 6-month FAD MAE: **${bt.mae.toFixed(1)} months** over ${bt.predictions} windows.`
          : "") +
        ` Conservative and Pessimistic scenarios already bake retrogression into their paths.`;
      break;
    }

    case "comparison": {
      const allCats = (["EB1", "EB2", "EB3"] as TrackerCategoryKey[]).map(k => {
        const m = EB_CATEGORIES[k];
        const total = Object.values(I485_INDIA_PENDING[k]).reduce(
          (a, b) => a + b,
          0
        );
        return `• **${m.label}** — FAD: ${cutoffDateLabel(m.currentFAD, m.currentFADStatus)}, DoF: ${cutoffDateLabel(m.currentDoF, m.currentDoFStatus)}, ~${total.toLocaleString()} pending I-485s`;
      });
      text =
        `Current EB India priority dates (${bulletin}):\n\n` +
        allCats.join("\n") +
        "\n\n" +
        `**EB-1** moves fastest but is most volatile — it retrogressed sharply in FY2026 after a COVID-era surge. **EB-2** has the deepest backlog but benefits most from spillover. **EB-3** tracks closely with EB-2 but with different demand density patterns.\n\n` +
        `The Category Comparison table below this panel shows side-by-side projections for all three with your priority date.`;
      break;
    }

    case "confidence": {
      const cov = bt.predictions > 0 ? Math.round(bt.coverage80 * 100) : null;
      text =
        `The tracker runs a **probabilistic simulation** — thousands of forward paths drawn from historical bulletin movement residuals for each fiscal-year month.\n\n` +
        `**P50 (median)**: 50% of simulated paths reach your target date before this estimate — the "most likely" single date.\n` +
        `**80% interval (P10–P90)**: 80% of paths fall within this band. Wider bands mean more uncertainty from dense demand years, policy risk, or long horizons.\n\n` +
        (cov !== null
          ? `**Backtested accuracy**: The model's 80% interval captured the actual FAD **${cov}% of the time** across ${bt.predictions} rolling 6-month windows. ${cov >= 75 ? "Well-calibrated." : "Slightly below target — treat estimates as directional."}`
          : "Backtest data is not available for this configuration.") +
        `\n\nNote: a single DOS decision — retrogression, unavailability, or a policy reversal — can move dates outside any modeled interval overnight.`;
      break;
    }

    case "history": {
      text =
        `Recent **${catLbl} India FAD** movement (last 5 bulletins):\n\n**${recentHistory}**\n\n` +
        `All values are sourced from official DOS Visa Bulletins and used as training data for the forward simulation. History is stored back to Oct 2022.\n\n` +
        `Most significant recent event: **EB-2 India became unavailable in July 2026 and remains unavailable in August 2026**. The model displays that status while using the May 2026 FAD as the FY2027 recovery anchor.`;
      break;
    }

    case "legal": {
      text =
        `Ask EBTracker explains **data, not legal strategy**.\n\n` +
        `It can summarize bulletin cutoffs, scenario assumptions, forecast estimates, queue depth, and retrogression risk — all grounded in public USCIS and DOS data through ${bulletin}.\n\n` +
        `It **cannot advise** on: whether to downgrade categories, when to change employers, how to port I-140 priority dates, litigation strategy, or any case-specific filing decision.\n\n` +
        `For those decisions, use this tracker as background research and consult a **licensed immigration attorney**.`;
      break;
    }

    default: {
      text =
        `Here's a quick summary for **${catLbl} India**, priority date ${targetLbl} (${bulletin}):\n\n` +
        `• Current FAD: **${fadStr}** · Current DoF: **${dofStr}**\n` +
        `• Optimistic FAD estimate: ${projDate(opt.fadDate, opt.horizon.fadP50Capped)}\n` +
        `• Base case FAD estimate: ${projDate(base.fadDate, base.horizon.fadP50Capped)}\n` +
        `• Conservative FAD estimate: ${projDate(cons.fadDate, cons.horizon.fadP50Capped)}\n` +
        `• Queue depth: ~${i485Total.toLocaleString()} pending I-485s\n\n` +
        `Ask me anything — filing windows, visa ban impact, queue depth, scenarios, or how to read the confidence intervals.`;
    }
  }

  const suggestions = FOLLOW_UPS[intent].filter(
    s => s.toLowerCase() !== question.toLowerCase().trim()
  );

  return { text, intent, suggestions, sources };
}
