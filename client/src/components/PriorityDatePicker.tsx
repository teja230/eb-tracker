/**
 * PriorityDatePicker
 * Design: Slate/white, monospace dates, clean popover calendar
 * Caps max selectable date at today (priority dates are always in the past)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

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

function fmtDisplay(str: string): string {
  const d = parseYMD(str);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface Props {
  value: string;          // "YYYY-MM-DD"
  onChange: (v: string) => void;
}

export default function PriorityDatePicker({ value, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = parseYMD(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [yearInput, setYearInput] = useState(String(selected.getFullYear()));
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    // Don't navigate past today's month
    if (nextY > today.getFullYear() || (nextY === today.getFullYear() && nextM > today.getMonth())) return;
    setViewMonth(nextM);
    setViewYear(nextY);
  }, [viewMonth, viewYear, today]);

  const selectDay = useCallback((day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (d > today) return;
    onChange(toYMD(d));
    setOpen(false);
  }, [viewYear, viewMonth, today, onChange]);

  const handleYearInput = (v: string) => {
    setYearInput(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 1990 && n <= today.getFullYear()) {
      setViewYear(n);
    }
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const isNextDisabled =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
      >
        <span>{fmtDisplay(value)}</span>
        <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-72">
          {/* Header: prev / month+year / next */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {MONTHS.map((m, i) => {
                  const disabled = viewYear === today.getFullYear() && i > today.getMonth();
                  return (
                    <option key={m} value={i} disabled={disabled}>{m}</option>
                  );
                })}
              </select>
              <input
                type="number"
                value={yearInput}
                onChange={e => handleYearInput(e.target.value)}
                min={1990}
                max={today.getFullYear()}
                className="w-16 text-xs font-semibold text-slate-800 bg-transparent border-b border-slate-300 focus:outline-none focus:border-slate-600 text-center"
              />
            </div>

            <button
              onClick={nextMonth}
              disabled={isNextDisabled}
              className={`p-1 rounded transition-colors ${
                isNextDisabled
                  ? "text-slate-200 cursor-not-allowed"
                  : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {/* Empty cells before first day */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const thisDate = new Date(viewYear, viewMonth, day);
              const isFuture = thisDate > today;
              const isSelected =
                selected.getFullYear() === viewYear &&
                selected.getMonth() === viewMonth &&
                selected.getDate() === day;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === day;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isFuture}
                  onClick={() => selectDay(day)}
                  className={`
                    w-full aspect-square flex items-center justify-center rounded-md text-xs font-mono transition-colors
                    ${isFuture ? "text-slate-200 cursor-not-allowed" : ""}
                    ${isSelected ? "bg-slate-800 text-white font-bold" : ""}
                    ${!isSelected && !isFuture ? "text-slate-700 hover:bg-slate-100" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-slate-400" : ""}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
