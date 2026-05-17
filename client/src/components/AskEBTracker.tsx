import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Bot, ExternalLink, Send, Trash2, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  generateResponse,
  type ChatMessage,
  type EngineContext,
} from "@/lib/ebChatEngine";
import { fmtDateStr } from "@/lib/trackerUtils";

import type { AskEBTrackerProps } from "./trackerTypes";

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
