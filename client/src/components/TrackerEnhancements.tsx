import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  AlertTriangle,
  Bell,
  BookmarkPlus,
  Bot,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Info,
  ListChecks,
  MessageSquare,
  Scale,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  generateResponse,
  type ChatMessage,
  type EngineContext,
} from "@/lib/ebChatEngine";
import { Link } from "wouter";

import { Card } from "@/components/ui/card";
import type { BacktestSummary, ForecastProjection } from "@/lib/forecast";
import {
  fmtDate,
  fmtDateStr,
  fmtDuration,
  parseDateStr,
  type MovementInfo,
} from "@/lib/trackerUtils";
import type { TrackerCategoryKey } from "@/data/trackerData";

type ScenarioKey = "optimistic" | "base" | "conservative" | "pessimistic";

type ScenarioMeta = {
  label: string;
  probability: string;
  color: string;
  description: string;
};

export type SourceLink = {
  label: string;
  href: string;
  detail: string;
};

export type SensitivityRow = {
  control: string;
  value: string;
  months: number;
  dateLabel: string;
  deltaMonths: number;
  selected: boolean;
};

export type CategoryComparisonRow = {
  category: TrackerCategoryKey;
  label: string;
  name: string;
  currentFadLabel: string;
  currentDofLabel: string;
  fadMove: MovementInfo;
  dofMove: MovementInfo;
  prevBulletinLabel: string;
  gapLabel: string;
  fadEstLabel: string; // base-case FAD estimate
  isSelected: boolean; // is this the currently selected category?
};

type WatchItem = {
  id: string;
  category: TrackerCategoryKey;
  categoryLabel: string;
  targetDate: string;
  targetDateLabel: string;
  assumptions: string;
  dofEstimate: string;
  fadEstimate: string;
  gcEstimate: string;
  savedAt: string;
  url: string;
};

const WATCHLIST_KEY = "ebtracker.watchlist.v1";
const WATCHLIST_NOTIFIED_KEY = "ebtracker.watchlist.notified.v1";

function isOnOrPast(cutoff: string, targetDate: string) {
  return parseDateStr(cutoff).getTime() >= parseDateStr(targetDate).getTime();
}

function projectionDateLabel(date: Date, capped: boolean) {
  if (capped) {
    const year = new Date().getFullYear() + 20;
    return `>${year}`;
  }
  return fmtDate(date);
}

function loadWatchlist(): WatchItem[] {
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchItem[]) {
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
}

function isWatchItem(value: unknown): value is WatchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WatchItem>;
  return (
    typeof item.id === "string" &&
    ["EB1", "EB2", "EB3"].includes(item.category ?? "") &&
    typeof item.categoryLabel === "string" &&
    typeof item.targetDate === "string" &&
    typeof item.targetDateLabel === "string" &&
    typeof item.assumptions === "string" &&
    typeof item.dofEstimate === "string" &&
    typeof item.fadEstimate === "string" &&
    typeof item.gcEstimate === "string" &&
    typeof item.savedAt === "string" &&
    typeof item.url === "string"
  );
}

export function DataFreshnessPanel({
  currentMonth,
  currentBulletinUrl,
  modelVersion,
  lastVerified,
  currentBulletinPublished,
  nextExpectedUpdate,
  adjustmentChartNote,
  modelHistoryCount,
  trackerHistoryCount,
  sourceLinks,
}: {
  currentMonth: string;
  currentBulletinUrl: string;
  modelVersion: string;
  lastVerified: string;
  currentBulletinPublished: string;
  nextExpectedUpdate: string;
  adjustmentChartNote: string;
  modelHistoryCount: number;
  trackerHistoryCount: number;
  sourceLinks: SourceLink[];
}) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white p-0 shadow-sm">
      <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-bold">Data Freshness</h3>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Current source state, model version, and update cadence.
            </p>
          </div>
          <a
            href={currentBulletinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
          >
            Official bulletin
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-5">
        {[
          {
            label: "Latest Bulletin",
            value: currentMonth,
            detail: `Published ${currentBulletinPublished}`,
          },
          {
            label: "Model Version",
            value: modelVersion,
            detail: `${modelHistoryCount} model rows`,
          },
          {
            label: "Tracker History",
            value: `${trackerHistoryCount} rows`,
            detail: "Includes archive rows",
          },
          {
            label: "Last Verified",
            value: lastVerified,
            detail: `Next check ${nextExpectedUpdate}`,
          },
          {
            label: "I-485 Filing Chart",
            value: "USCIS",
            detail: adjustmentChartNote,
          },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-900">
              {item.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {sourceLinks.map(source => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
              title={source.detail}
            >
              {source.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── MARKDOWN RENDERER ───────────────────────────────────────────────────────
// Handles **bold**, line breaks, and bullet lines in bot messages.

function InlineText({ text }: { text: string }) {
  const segs = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {segs.map((seg, i) =>
        seg.startsWith("**") && seg.endsWith("**") ? (
          <strong key={i} className="font-semibold text-slate-900">
            {seg.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");
  return (
    <>
      {paragraphs.map((para, pi) => (
        <p key={pi} className={pi < paragraphs.length - 1 ? "mb-2.5" : ""}>
          {para.split("\n").map((line, li, arr) => (
            <span key={li}>
              <InlineText text={line} />
              {li < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

// ─── ASK EBTRACKER CHAT COMPONENT ────────────────────────────────────────────

export type AskEBTrackerProps = {
  categoryLabel: string;
  categoryName: string;
  targetDate: string;
  currentFad: string;
  currentDof: string;
  projections: Record<string, ForecastProjection>;
  scenarios: Record<string, ScenarioMeta>;
  assumptionsSummary: string;
  backtest: BacktestSummary;
  sourceLinks: SourceLink[];
  onClose?: () => void;
};

export function AskEBTracker({
  categoryLabel,
  categoryName: _categoryName,
  targetDate,
  currentFad,
  currentDof,
  projections,
  scenarios,
  assumptionsSummary,
  backtest,
  sourceLinks,
  onClose,
}: AskEBTrackerProps) {
  // Derive category key from the label passed by the parent tab
  const categoryKey = (
    categoryLabel === "EB-1" ? "EB1" : categoryLabel === "EB-3" ? "EB3" : "EB2"
  ) as import("@/data/trackerData").TrackerCategoryKey;

  const engineContext = useMemo<EngineContext>(
    () => ({
      categoryLabel,
      categoryKey,
      targetDate,
      currentFad,
      currentDof,
      projections,
      scenarios,
      assumptionsSummary,
      backtest,
      sourceLinks,
    }),
    [
      categoryLabel,
      categoryKey,
      targetDate,
      currentFad,
      currentDof,
      projections,
      scenarios,
      assumptionsSummary,
      backtest,
      sourceLinks,
    ]
  );

  const INITIAL_SUGGESTIONS = [
    "When can I file I-485?",
    "What is the visa ban impact?",
    "DoF vs FAD explained",
  ];

  const makeWelcome = useCallback(
    (): ChatMessage => ({
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: `Hi! I'm answering for **${categoryLabel} India**, priority date **${fmtDateStr(targetDate)}**. Ask about filing windows, queue depth, the visa ban, retrogression risk, forecast scenarios, and more — every answer is sourced from this tracker's live data.`,
      suggestions: INITIAL_SUGGESTIONS,
      sources: sourceLinks.slice(0, 3),
      timestamp: Date.now(),
    }),
    [categoryLabel, targetDate, sourceLinks] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    makeWelcome(),
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState("");

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const makeWelcomeRef = useRef(makeWelcome);
  const hasInitializedRef = useRef(false);
  makeWelcomeRef.current = makeWelcome;

  const clearTimers = useCallback(() => {
    if (streamRef.current) clearTimeout(streamRef.current);
    if (thinkingRef.current) clearTimeout(thinkingRef.current);
    if (streamStartRef.current) clearTimeout(streamStartRef.current);
    streamRef.current = null;
    thinkingRef.current = null;
    streamStartRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Reset chat when the selected priority date or category changes (not on initial mount)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }
    clearTimers();
    setStreamingId(null);
    setStreamProgress("");
    setIsThinking(false);
    setInput("");
    setMessages([makeWelcomeRef.current()]);
  }, [targetDate, categoryLabel, clearTimers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll chat container to bottom only when new messages arrive or thinking starts —
  // NOT on every streamed character, to avoid page-level scroll spam.
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isThinking]);

  const startStream = useCallback((fullText: string, msgId: string) => {
    if (streamRef.current) clearTimeout(streamRef.current);
    setStreamingId(msgId);
    setStreamProgress("");
    let i = 0;
    const tick = () => {
      if (i >= fullText.length) {
        setStreamingId(null);
        setStreamProgress("");
        return;
      }
      i++;
      setStreamProgress(fullText.slice(0, i));
      const ch = fullText[i - 1];
      const delay =
        ch === "." || ch === "!" || ch === "?"
          ? 55
          : ch === "\n"
            ? 25
            : ch === ","
              ? 12
              : 6;
      streamRef.current = setTimeout(tick, delay);
    };
    tick();
  }, []);

  const handleSend = useCallback(
    (q: string) => {
      const text = q.trim();
      if (!text || isThinking || streamingId !== null) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);
      inputRef.current?.focus();

      // Simulate a brief "thinking" pause before responding
      const pause = 180 + Math.random() * 280;
      thinkingRef.current = setTimeout(() => {
        thinkingRef.current = null;
        setMessages(prev => {
          const result = generateResponse(text, engineContext, prev);
          const botMsg: ChatMessage = {
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: result.text,
            intent: result.intent,
            suggestions: result.suggestions,
            sources: result.sources,
            timestamp: Date.now(),
          };
          setIsThinking(false);
          streamStartRef.current = setTimeout(() => {
            streamStartRef.current = null;
            startStream(result.text, botMsg.id);
          }, 30);
          return [...prev, botMsg];
        });
      }, pause);
    },
    [isThinking, streamingId, engineContext, startStream]
  );

  const clearChat = useCallback(() => {
    clearTimers();
    setStreamingId(null);
    setStreamProgress("");
    setIsThinking(false);
    setInput("");
    setMessages([makeWelcome()]);
  }, [clearTimers, makeWelcome]);

  // Last assistant message drives the suggestion chips
  const lastBotMsg = useMemo(
    () => [...messages].reverse().find(m => m.role === "assistant"),
    [messages]
  );
  const showSuggestions =
    !isThinking && streamingId === null && lastBotMsg?.suggestions?.length;

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Ask EBTracker</h3>
            <p className="text-[11px] text-slate-500">
              {categoryLabel} India · PD {fmtDateStr(targetDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div
        ref={chatAreaRef}
        className="flex flex-col gap-3 overflow-y-auto p-4"
        style={{ minHeight: "120px", maxHeight: "320px" }}
      >
        {messages.map(msg => {
          const isStreaming = msg.id === streamingId;
          const displayText = isStreaming ? streamProgress : msg.content;

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-slate-900 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                <Bot className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                  <MarkdownText text={displayText || " "} />
                  {isStreaming && (
                    <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 animate-pulse bg-slate-600" />
                  )}
                </div>
                {/* Source links — only shown after streaming completes */}
                {!isStreaming && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {msg.sources.map(s => (
                      <a
                        key={s.href}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 transition-colors hover:text-slate-800"
                      >
                        {s.label}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3.5">
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Follow-up suggestions ── */}
      {showSuggestions ? (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Suggested
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lastBotMsg!.suggestions!.map(s => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-white hover:text-slate-900"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Input bar ── */}
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
          placeholder="Ask about filing windows, queue depth, visa ban…"
          disabled={isThinking || streamingId !== null}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isThinking || streamingId !== null}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-opacity hover:bg-slate-700 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

// ─── FLOATING CHAT WIDGET ─────────────────────────────────────────────────────
// Fixed bottom-right launcher, independent of any page section.

export function FloatingChatWidget(props: Omit<AskEBTrackerProps, "onClose">) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: constrain Tab/Shift+Tab inside the panel when open
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );

    // Move focus into the panel after it mounts
    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // Restore focus to toggle button when panel closes
  useEffect(() => {
    if (!open) {
      toggleBtnRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none sm:bottom-6 sm:left-auto sm:right-6">
      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Ask EBTracker chat"
          className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px]"
          style={{ maxHeight: "min(580px, calc(100dvh - 100px))" }}
        >
          <AskEBTracker {...props} onClose={close} />
        </div>
      )}

      {/* Toggle button */}
      <button
        ref={toggleBtnRef}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close chat" : "Ask EBTracker"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-4 ring-white transition-all hover:bg-slate-700 active:scale-95"
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}

export function WatchlistPanel({
  category,
  categoryLabel,
  targetDate,
  assumptionsSummary,
  projection,
  currentCutoffs,
  shareUrl,
}: {
  category: TrackerCategoryKey;
  categoryLabel: string;
  targetDate: string;
  assumptionsSummary: string;
  projection: ForecastProjection;
  currentCutoffs: Record<TrackerCategoryKey, { fad: string; dof: string }>;
  shareUrl: string;
}) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(loadWatchlist());
  }, []);

  const currentItem = useMemo<WatchItem>(
    () => ({
      id: `${category}:${targetDate}:${Date.now()}`,
      category,
      categoryLabel,
      targetDate,
      targetDateLabel: fmtDateStr(targetDate),
      assumptions: assumptionsSummary,
      dofEstimate: projectionDateLabel(
        projection.dofDate,
        projection.horizon.dofP50Capped
      ),
      fadEstimate: projectionDateLabel(
        projection.fadDate,
        projection.horizon.fadP50Capped
      ),
      gcEstimate: projectionDateLabel(
        projection.gcDate,
        projection.horizon.gcP50Capped
      ),
      savedAt: new Date().toISOString(),
      url: shareUrl,
    }),
    [
      assumptionsSummary,
      category,
      categoryLabel,
      projection,
      shareUrl,
      targetDate,
    ]
  );

  const addCurrent = () => {
    const next = [
      currentItem,
      ...items.filter(
        item => !(item.category === category && item.targetDate === targetDate)
      ),
    ].slice(0, 12);
    setItems(next);
    saveWatchlist(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter(item => item.id !== id);
    setItems(next);
    saveWatchlist(next);
  };

  const statusFor = (item: WatchItem) => {
    const cutoffs = currentCutoffs[item.category];
    if (isOnOrPast(cutoffs.fad, item.targetDate))
      return {
        label: "Current",
        tone: "emerald",
        detail: "FAD has reached this priority date.",
      };
    if (isOnOrPast(cutoffs.dof, item.targetDate))
      return {
        label: "Fileable",
        tone: "blue",
        detail: "DoF has reached this priority date.",
      };
    return {
      label: "Watching",
      tone: "amber",
      detail: "Not reached by the current bulletin yet.",
    };
  };

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const notified = new Set(
      JSON.parse(window.localStorage.getItem(WATCHLIST_NOTIFIED_KEY) ?? "[]")
    );
    let changed = false;

    items.forEach(item => {
      const status = statusFor(item);
      if (status.label === "Watching") return;
      const key = `${item.id}:${status.label}`;
      if (notified.has(key)) return;
      new Notification(`${item.categoryLabel} India is ${status.label}`, {
        body: `PD ${item.targetDateLabel}: ${status.detail}`,
        tag: key,
      });
      notified.add(key);
      changed = true;
    });

    if (changed) {
      window.localStorage.setItem(
        WATCHLIST_NOTIFIED_KEY,
        JSON.stringify(Array.from(notified))
      );
    }
  }, [items, notificationPermission, currentCutoffs]);

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const next = await Notification.requestPermission();
    setNotificationPermission(next);
  };

  const exportWatchlist = () => {
    const blob = new Blob([JSON.stringify({ items }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eb-tracker-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importWatchlist = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const importedItems = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(importedItems) || !importedItems.every(isWatchItem)) {
        throw new Error("Invalid watchlist file");
      }
      const merged = [...importedItems, ...items]
        .filter(
          (item, index, list) =>
            list.findIndex(
              candidate =>
                candidate.category === item.category &&
                candidate.targetDate === item.targetDate
            ) === index
        )
        .slice(0, 12);
      setItems(merged);
      saveWatchlist(merged);
      setImportMessage(
        `Imported ${importedItems.length} watchlist item${importedItems.length === 1 ? "" : "s"}.`
      );
    } catch {
      setImportMessage("Could not import that watchlist file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Watchlist and Local Alerts
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Save priority dates in this browser. Alerts update when bulletin
            data changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={addCurrent}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save current profile
          </button>
          <button
            onClick={exportWatchlist}
            disabled={items.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          {notificationPermission !== "granted" && (
            <button
              onClick={requestNotifications}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <Bell className="h-3.5 w-3.5" />
              Enable alerts
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={importWatchlist}
          />
        </div>
      </div>
      {importMessage && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {importMessage}
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No saved watchlist items yet. Save the current profile to monitor DoF
          and FAD crossing status after future monthly updates.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map(item => {
            const status = statusFor(item);
            const toneClass =
              status.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status.tone === "blue"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-amber-200 bg-amber-50 text-amber-700";
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {item.categoryLabel} India - PD {item.targetDateLabel}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {status.detail}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Filing: {item.dofEstimate} · FAD: {item.fadEstimate} · GC:{" "}
                      {item.gcEstimate}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.assumptions}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={item.url}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove watchlist item"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function PersonalTimeline({
  categoryLabel,
  targetDate,
  currentFad,
  currentDof,
  projection,
  gcLagMonths,
}: {
  categoryLabel: string;
  targetDate: string;
  currentFad: string;
  currentDof: string;
  projection: ForecastProjection;
  gcLagMonths: number;
}) {
  const steps = [
    {
      label: "Priority date set",
      date: fmtDateStr(targetDate),
      done: true,
      detail: `${categoryLabel} India case anchor.`,
    },
    {
      label: "DoF reaches your PD",
      date: isOnOrPast(currentDof, targetDate)
        ? "Already fileable"
        : projectionDateLabel(
            projection.dofDate,
            projection.horizon.dofP50Capped
          ),
      done: isOnOrPast(currentDof, targetDate),
      detail:
        "Earliest filing chart milestone, subject to USCIS chart selection.",
    },
    {
      label: "FAD reaches your PD",
      date: isOnOrPast(currentFad, targetDate)
        ? "Already current"
        : projectionDateLabel(
            projection.fadDate,
            projection.horizon.fadP50Capped
          ),
      done: isOnOrPast(currentFad, targetDate),
      detail: "Visa availability milestone used by the estimate.",
    },
    {
      label: "Green card receipt estimate",
      date: projectionDateLabel(
        projection.gcDate,
        projection.horizon.gcP50Capped
      ),
      done: false,
      detail: `Modeled as roughly ${fmtDuration(gcLagMonths)} after FAD.`,
    },
  ];

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-slate-900">Personal Timeline</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="relative rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Step {index + 1}
              </span>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">
              {step.label}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-700">
              {step.date}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {step.detail}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CategoryComparison({
  rows,
  onSelectCategory,
  currentBulletinLabel,
  targetDateLabel,
}: {
  rows: CategoryComparisonRow[];
  onSelectCategory: (cat: TrackerCategoryKey) => void;
  currentBulletinLabel: string;
  targetDateLabel: string;
}) {
  const prevBulletinLabel = rows[0]?.prevBulletinLabel ?? "prior bulletin";

  function MoveBadge({ move }: { move: MovementInfo }) {
    if (move.type === "stable") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          ─ No change
        </span>
      );
    }
    if (move.type === "retrogression") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
          ▼ {move.label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        ▲ {move.label}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            EB Category Snapshot
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {currentBulletinLabel} cutoffs · movement vs {prevBulletinLabel} ·
            base-case FAD for PD {targetDateLabel}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map(row => (
          <button
            key={row.category}
            onClick={() => onSelectCategory(row.category)}
            aria-pressed={row.isSelected}
            aria-label={`${row.label} India snapshot. Current FAD ${row.currentFadLabel}, current DoF ${row.currentDofLabel}, base-case FAD estimate ${row.fadEstLabel}. ${row.isSelected ? "Selected category." : "Select this category."}`}
            className={`text-left rounded-xl border p-4 transition-all hover:shadow-md ${
              row.isSelected
                ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            {/* Category name */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p
                  className={`text-sm font-bold ${row.isSelected ? "text-white" : "text-slate-900"}`}
                >
                  {row.label} India
                </p>
                <p
                  className={`text-[11px] ${row.isSelected ? "text-slate-300" : "text-slate-400"}`}
                >
                  {row.name}
                </p>
              </div>
              {row.isSelected && (
                <span className="rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Selected
                </span>
              )}
            </div>

            {/* FAD row */}
            <div
              className={`rounded-lg p-3 mb-2 ${row.isSelected ? "bg-white/10" : "bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${row.isSelected ? "text-slate-300" : "text-slate-500"}`}
                >
                  Final Action Date
                </p>
                <MoveBadge move={row.fadMove} />
              </div>
              <p
                className={`mt-1 font-mono text-base font-bold ${row.isSelected ? "text-white" : "text-slate-900"}`}
              >
                {row.currentFadLabel}
              </p>
            </div>

            {/* DoF row */}
            <div
              className={`rounded-lg p-3 mb-3 ${row.isSelected ? "bg-white/10" : "bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${row.isSelected ? "text-slate-300" : "text-slate-500"}`}
                >
                  Dates for Filing
                </p>
                <MoveBadge move={row.dofMove} />
              </div>
              <p
                className={`mt-1 font-mono text-sm font-semibold ${row.isSelected ? "text-slate-100" : "text-slate-700"}`}
              >
                {row.currentDofLabel}
              </p>
            </div>

            {/* Gap + estimate footer */}
            <div
              className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                row.isSelected
                  ? "border-white/15 text-slate-300"
                  : "border-slate-100 text-slate-500"
              }`}
            >
              <span>
                Gap to your PD:{" "}
                <span className="font-semibold">{row.gapLabel}</span>
              </span>
              <span title="Base-case FAD estimate for your priority date">
                Est. FAD:{" "}
                <span className="font-semibold font-mono">
                  {row.fadEstLabel}
                </span>
              </span>
            </div>

            {/* Prev bulletin label */}
            <p
              className={`text-[10px] mt-1.5 ${row.isSelected ? "text-slate-400" : "text-slate-400"}`}
            >
              Movement shown vs. {row.prevBulletinLabel} bulletin. Click to
              switch active category.
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrustAndLimitationsPanel({
  sourceLinks,
}: {
  sourceLinks: SourceLink[];
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-bold text-slate-900">What it does</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Calculates category-specific forecast ranges from current bulletin
            data, historical movement, demand density, and selected assumptions.
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-bold text-slate-900">What can change</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Retrogression, USCIS chart selection, visa number use, policy
            changes, and processing capacity can shift results quickly.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-600" />
            <p className="text-sm font-bold text-slate-900">What it is not</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            It is not legal advice, a USCIS filing determination, or a guarantee
            that a future bulletin will follow the modeled path.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "EB-1 India guide", to: "/eb-1-india" },
          { label: "EB-2 India guide", to: "/eb-2-india" },
          { label: "EB-3 India guide", to: "/eb-3-india" },
          { label: "Methodology", to: "/methodology" },
          { label: "Bulletin history", to: "/visa-bulletin-history" },
        ].map(link => (
          <Link
            key={link.to}
            href={link.to}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
        {sourceLinks.map(source => (
          <a
            key={source.href}
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </Card>
  );
}
