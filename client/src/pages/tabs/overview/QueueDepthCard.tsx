import { Card } from "@/components/ui/card";
import { I485_INVENTORY } from "@/data/trackerData";
import { parseDateStr } from "@/lib/trackerUtils";
import type { TrackerCategory } from "@/pages/homeShared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type QueueDepthCardProps = {
  cat: TrackerCategory;
  targetDate: string;
  demandDensityData: Array<{
    year: string;
    pending: number;
    estimated: number;
    source: string;
    isTarget: boolean;
  }>;
};

export function QueueDepthCard({
  cat,
  targetDate,
  demandDensityData,
}: QueueDepthCardProps) {
  if (demandDensityData.length === 0) {
    return null;
  }

  return (
    <Card className="p-5 pb-3 overflow-hidden">
      <div className="flex flex-wrap gap-2 items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700">
          Queue Depth by Priority Date Year
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600" />{" "}
            I-485 inventory
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-300" />{" "}
            I-140 (scaled)
          </span>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Filed I-485 applications plus estimated future demand. I-140 receipt
        fiscal years approximate PD years. Your PD year is highlighted.
      </p>
      <div
        role="img"
        aria-label={`${cat.label} India queue depth by priority date year`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={demandDensityData}
            margin={{ top: 20, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "none",
                boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                padding: "10px 14px",
                fontSize: 12,
              }}
              formatter={(v: number, name: string) => [
                v === 0 && name === "Filed I-485 (disclosed)"
                  ? "No year-specific inventory reported"
                  : `${v.toLocaleString()}${name === "Filed I-485 (disclosed)" ? " disclosed" : " estimated"}`,
                name,
              ]}
              labelFormatter={(label: string) => `PD Year ${label}`}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar
              dataKey="pending"
              name="Filed I-485 (disclosed)"
              stackId="demand"
              maxBarSize={40}
            >
              {demandDensityData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.isTarget
                      ? "#f59e0b"
                      : entry.source === "I-485"
                        ? "#2563eb"
                        : "#93c5fd"
                  }
                  stroke={entry.isTarget ? "#d97706" : "none"}
                  strokeWidth={entry.isTarget ? 2 : 0}
                />
              ))}
            </Bar>
            <Bar
              dataKey="estimated"
              name="Additional demand proxy"
              stackId="demand"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            >
              {demandDensityData.map(entry => (
                <Cell
                  key={entry.year}
                  fill={entry.isTarget ? "#fcd34d" : "#93c5fd"}
                />
              ))}
            </Bar>
            <ReferenceLine
              x={String(parseDateStr(cat.currentFAD).getFullYear())}
              stroke="#10b981"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{
                value:
                  cat.currentFADStatus === "unavailable" ? "FAD anchor" : "FAD",
                position: "top",
                fill: "#10b981",
                fontSize: 9,
                fontWeight: 700,
              }}
            />
            <ReferenceLine
              x={String(parseDateStr(targetDate).getFullYear())}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{
                value: "Your PD",
                position: "top",
                fill: "#d97706",
                fontSize: 9,
                fontWeight: 700,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400 text-center mt-1">
        <a
          href={I485_INVENTORY.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          USCIS I-485 inventory ({I485_INVENTORY.asOf})
        </a>
        {" · "}I-140 approvals (FY2026 Q3; FY2026 is partial)
      </p>
      <p className="text-[11px] text-slate-500 mt-2">
        Suppressed counts are undisclosed, so affected inventory totals are
        lower bounds. “Prior Years” counts are included in the inventory total,
        but cannot be assigned to a single bar. Partly filed years retain a
        full-year demand proxy. Quarterly receipts are shown separately below
        the history chart and do not add to this queue.
      </p>
    </Card>
  );
}
