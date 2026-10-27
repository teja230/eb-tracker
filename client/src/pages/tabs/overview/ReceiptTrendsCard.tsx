import { Card } from "@/components/ui/card";
import {
  I140_QUARTERLY_RECEIPTS_INDIA,
  type TrackerCategoryKey,
} from "@/data/trackerData";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReceiptTrendsCard({
  category,
}: {
  category: TrackerCategoryKey;
}) {
  const key = category.toLowerCase() as "eb1" | "eb2" | "eb3";
  const rows = I140_QUARTERLY_RECEIPTS_INDIA;
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const change = (latest[key] / previous[key] - 1) * 100;
  const label = category.replace("EB", "EB-");

  return (
    <Card className="gap-3 rounded-lg border-slate-300 p-5 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {label} India quarterly I-140 receipts
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Petitions received by beneficiary country of birth · FY2026 Q1–Q3
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {latest[key].toLocaleString()} in Q3 · {change >= 0 ? "+" : ""}
          {change.toFixed(1)}% vs Q2
        </p>
      </div>
      <div
        role="img"
        aria-label={`${label} India quarterly receipts: ${rows.map(row => `${row.period}: ${row[key].toLocaleString()}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={value => `${value / 1000}k`}
            />
            <Tooltip
              formatter={(value: number) => [
                value.toLocaleString(),
                `${label} petitions received`,
              ]}
            />
            <Bar
              dataKey={key}
              fill="#0891b2"
              maxBarSize={60}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500">
        Receipt quarter is different from priority date. These counts provide
        demand context and do not add to the I-485 queue. EB-3 excludes other
        workers (EW3).
      </p>
      <div className="flex flex-wrap gap-3 text-xs text-blue-700">
        {rows.map(row => (
          <a
            key={row.period}
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            USCIS {row.period}
          </a>
        ))}
      </div>
    </Card>
  );
}
