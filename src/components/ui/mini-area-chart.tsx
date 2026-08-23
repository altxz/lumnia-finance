import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/constants';

export interface MiniAreaPoint {
  label: string;
  value: number;
}

interface MiniAreaChartProps {
  data: MiniAreaPoint[];
  className?: string;
}

function MiniTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as MiniAreaPoint;
  return (
    <div className="rounded-lg bg-background/95 px-2 py-1 text-[10px] font-medium text-foreground shadow-md ring-1 ring-border/60 backdrop-blur">
      <span className="capitalize opacity-70">{p.label}</span>
      <span className="mx-1 opacity-40">·</span>
      <span>{formatCurrency(p.value)}</span>
    </div>
  );
}

/**
 * Compact sparkline-style area chart. Inherits its color from `currentColor`,
 * so it adapts to whichever colored card it lives in.
 */
export function MiniAreaChart({ data, className }: MiniAreaChartProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (!data || data.length < 2) return null;
  const allZero = data.every(d => !d.value);
  if (allZero) return null;

  return (
    <div className={`w-full h-8 sm:h-12 ${className || ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`mini-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.45} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<MiniTooltip />} cursor={false} wrapperStyle={{ outline: 'none', zIndex: 30 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            strokeOpacity={0.9}
            fill={`url(#mini-${id})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: 'currentColor' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
