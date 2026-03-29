import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  totalIncome: number;
  totalExpense: number;
}

export function SavingsRateGauge({ totalIncome, totalExpense }: Props) {
  const rate = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)));
  }, [totalIncome, totalExpense]);

  const radius = 70;
  const stroke = 14;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference - (rate / 100) * circumference;
  const color = rate >= 30 ? 'hsl(142, 71%, 45%)' : rate >= 10 ? 'hsl(45, 93%, 47%)' : 'hsl(var(--destructive))';

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold">Taxa de Poupança</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col items-center justify-center pt-2 pb-4">
        <svg width={180} height={110} viewBox="0 0 180 110">
          {/* Background arc */}
          <path
            d="M 15 95 A 70 70 0 0 1 165 95"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <path
            d="M 15 95 A 70 70 0 0 1 165 95"
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text x="90" y="85" textAnchor="middle" className="text-3xl font-bold" fill="currentColor" fontSize={32} fontWeight={700}>
            {rate}%
          </text>
          <text x="90" y="105" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
            da receita poupada
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}
