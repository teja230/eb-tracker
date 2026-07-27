import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Bell, BookmarkPlus, Download, Trash2, Upload } from "lucide-react";

import type { CutoffStatus, TrackerCategoryKey } from "@/data/trackerData";
import { Card } from "@/components/ui/card";
import type { ForecastProjection } from "@/lib/forecast";
import { fmtDate, fmtDateStr, parseDateStr } from "@/lib/trackerUtils";

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
  currentCutoffs: Record<
    TrackerCategoryKey,
    {
      fad: string;
      dof: string;
      fadStatus?: CutoffStatus;
      dofStatus?: CutoffStatus;
    }
  >;
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
    if (
      cutoffs.fadStatus !== "unavailable" &&
      isOnOrPast(cutoffs.fad, item.targetDate)
    )
      return {
        label: "Current",
        tone: "emerald",
        detail: "FAD has reached this priority date.",
      };
    if (
      cutoffs.dofStatus !== "unavailable" &&
      isOnOrPast(cutoffs.dof, item.targetDate)
    )
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
