import { useMemo, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fmtDate } from '@/lib/trackerUtils';

interface TimelineDataPoint {
  month: string;
  fadRaw: number;
  dofRaw: number;
  fadDate: string;
  dofDate: string;
}

interface AnimatedTimelineChartProps {
  data: TimelineDataPoint[];
  category: 'EB1' | 'EB2' | 'EB3';
  title?: string;
}

export function AnimatedTimelineChart({ data, category, title = 'Priority Date Timeline' }: AnimatedTimelineChartProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  // Trigger animation on mount
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const chartData = useMemo(() => {
    return data.map((point) => ({
      month: point.month,
      fad: new Date(point.fadRaw).getTime() / (1000 * 60 * 60 * 24), // Convert to days since epoch for charting
      dof: new Date(point.dofRaw).getTime() / (1000 * 60 * 60 * 24),
      fadDate: point.fadDate,
      dofDate: point.dofDate,
    }));
  }, [data]);

  const categoryColor = {
    EB1: '#10b981', // emerald
    EB2: '#06b6d4', // cyan
    EB3: '#f59e0b', // amber
  }[category];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white px-3 py-2 rounded shadow-lg text-sm border border-slate-700">
        <p className="font-semibold">{data.month}</p>
        <p className="text-emerald-400">FAD: {data.fadDate}</p>
        <p className="text-cyan-400">DoF: {data.dofDate}</p>
      </div>
    );
  };

  return (
    <div className="w-full h-96 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#64748b' }}
            stroke="#cbd5e1"
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            stroke="#cbd5e1"
            tickFormatter={(value) => {
              const date = new Date(value * 1000 * 60 * 60 * 24);
              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="fad"
            stroke={categoryColor}
            strokeWidth={2}
            dot={{ fill: categoryColor, r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={isAnimating}
            animationDuration={1500}
            name="FAD"
          />
          <Line
            type="monotone"
            dataKey="dof"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#94a3b8', r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={isAnimating}
            animationDuration={1500}
            name="DoF"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
