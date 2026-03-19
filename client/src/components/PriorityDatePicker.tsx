/**
 * PriorityDatePicker
 * Hybrid date input: editable text field (MM/DD/YYYY) + calendar popover.
 * Supports keyboard-first entry, prev/next month arrows, and dropdown navigation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MIN_DATE = new Date(2010, 0, 1);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeParse(str: string): Date | null {
  const d = parseYMD(str);
  return isNaN(d.getTime()) ? null : d;
}

/** Human-readable format: "August 1, 2016" */
function toReadableFormat(ymd: string): string {
  const d = safeParse(ymd);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Editable format: MM/DD/YYYY */
function toEditableFormat(ymd: string): string {
  const d = safeParse(ymd);
  if (!d) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

/** Try to parse user-typed text as a date. Accepts MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD. */
function parseUserInput(text: string): Date | null {
  const trimmed = text.trim();

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime()) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd)) {
      return d;
    }
  }

  // YYYY-MM-DD
  const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    const [, yyyy, mm, dd] = dashMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime()) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd)) {
      return d;
    }
  }

  return null;
}

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
}

export default function PriorityDatePicker({ value, onChange }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const minYear = MIN_DATE.getFullYear();
  const minMonthIndex = MIN_DATE.getMonth();
  const minMonth = new Date(minYear, minMonthIndex, 1);
  const maxMonth = new Date(todayYear, todayMonth, 1);

  const selected = useMemo(() => safeParse(value) ?? today, [value, today]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  // Text input state
  const [editing, setEditing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputError, setInputError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const d = safeParse(value) ?? today;
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [open, value, today]);

  const visibleYear = month.getFullYear();
  const visibleMonth = month.getMonth();
  const years = useMemo(
    () =>
      Array.from({ length: todayYear - minYear + 1 }, (_, index) => todayYear - index),
    [todayYear, minYear]
  );

  const canGoPrev = useMemo(() => {
    const prev = new Date(visibleYear, visibleMonth - 1, 1);
    return prev >= minMonth;
  }, [visibleYear, visibleMonth, minMonth]);

  const canGoNext = useMemo(() => {
    const next = new Date(visibleYear, visibleMonth + 1, 1);
    return next <= maxMonth;
  }, [visibleYear, visibleMonth, maxMonth]);

  const setVisibleMonth = (year: number, monthIndex: number) => {
    const next = new Date(year, monthIndex, 1);
    if (next < minMonth) {
      setMonth(minMonth);
      return;
    }
    if (next > maxMonth) {
      setMonth(maxMonth);
      return;
    }
    setMonth(next);
  };

  const goPrev = () => {
    if (canGoPrev) setVisibleMonth(visibleYear, visibleMonth - 1);
  };

  const goNext = () => {
    if (canGoNext) setVisibleMonth(visibleYear, visibleMonth + 1);
  };

  const handleSelect = useCallback((date?: Date) => {
    if (!date) return;
    if (date < MIN_DATE || date > today) return;
    onChange(toYMD(date));
    setOpen(false);
  }, [today, onChange]);

  const isInRange = (d: Date) => d >= MIN_DATE && d <= today;

  const stopEditing = () => {
    setEditing(false);
    setInputError(false);
  };

  /** Commit typed text on blur or Enter */
  const commitInput = () => {
    const parsed = parseUserInput(inputText);
    if (parsed && isInRange(parsed)) {
      onChange(toYMD(parsed));
      stopEditing();
      setOpen(false);
    } else if (inputText.trim() !== "" && inputText !== toEditableFormat(value)) {
      setInputError(true);
      setTimeout(stopEditing, 1200);
    } else {
      stopEditing();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      stopEditing();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            aria-label="Priority date (MM/DD/YYYY)"
            placeholder="MM/DD/YYYY"
            value={editing ? inputText : toReadableFormat(value)}
            onFocus={() => {
              setInputText(toEditableFormat(value));
              setEditing(true);
              // Select all text so user can start typing immediately
              setTimeout(() => inputRef.current?.select(), 0);
            }}
            onChange={e => {
              setInputText(e.target.value);
              setInputError(false);
              // Auto-commit if the user types a complete valid date
              const parsed = parseUserInput(e.target.value);
              if (parsed && isInRange(parsed)) {
                onChange(toYMD(parsed));
                setMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
              }
            }}
            onBlur={commitInput}
            onKeyDown={handleInputKeyDown}
            className={`w-full rounded-lg border bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
              editing ? "font-mono" : ""
            } ${
              inputError
                ? "border-red-400 focus:ring-red-300"
                : "border-slate-300 hover:border-slate-500 focus:ring-slate-400"
            }`}
          />
          {/* Calendar icon trigger */}
          <PopoverTrigger asChild>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open calendar"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent align="start" sideOffset={8} className="w-[320px] rounded-xl border border-slate-200 p-0 shadow-xl">
        {/* Header: arrows + dropdowns */}
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-[1fr_80px] gap-1.5">
              <select
                value={visibleMonth}
                onChange={event => setVisibleMonth(visibleYear, Number(event.target.value))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
              >
                {MONTHS.map((monthLabel, index) => {
                  const isFutureMonth = visibleYear === todayYear && index > todayMonth;
                  const isBeforeMin = visibleYear === minYear && index < minMonthIndex;
                  return (
                    <option key={monthLabel} value={index} disabled={isFutureMonth || isBeforeMin}>
                      {monthLabel}
                    </option>
                  );
                })}
              </select>

              <select
                value={visibleYear}
                onChange={event => setVisibleMonth(Number(event.target.value), visibleMonth)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label="Next month"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={handleSelect}
          disabled={[{ before: MIN_DATE }, { after: today }]}
          showOutsideDays={false}
          className="p-4"
          classNames={{
            root: "w-full",
            months: "flex",
            month: "w-full gap-3",
            month_caption: "hidden",
            nav: "hidden",
            table: "w-full border-collapse",
            weekdays: "mt-0",
            weekday: "text-[11px] font-semibold text-slate-400",
            week: "mt-1",
            day: "p-0",
            day_button: "h-10 w-10 rounded-md font-mono text-sm",
            today: "rounded-md border border-slate-300 bg-transparent text-slate-900",
            selected: "bg-slate-900 text-white hover:bg-slate-900",
            outside: "text-slate-300",
            disabled: "text-slate-300 opacity-100",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
