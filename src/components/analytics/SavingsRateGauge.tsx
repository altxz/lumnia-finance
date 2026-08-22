import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoPopover } from '@/components/ui/info-popover';

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
  const circumference = Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;

  const ratingLabel = rate >= 30 ? 'Excelente' : rate >= 20 ? 'Bom' : rate >= 10 ? 'Atenção' : 'Crítico';
  const ratingColor = rate >= 30 ? 'hsl(142, 71%, 45%)' : rate >= 20 ? 'hsl(142, 50%, 55%)' : rate >= 10 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)';

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-0 px-4 pt-3 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-[13px] sm:text-sm font-semibold whitespace-nowrap">Taxa de Poupança</CardTitle>
          <InfoPopover><p>A porcentagem da sua renda que você não gastou e conseguiu guardar no mês.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col items-center justify-center px-2 pt-1 pb-3 sm:px-6 sm:pt-2 sm:pb-4">
        <svg viewBox="0 0 180 120" className="w-full max-w-[160px] sm:max-w-[200px] h-auto">

          <defs>
            <linearGradient id="savingsArcGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={ratingColor} stopOpacity={0.6} />
              <stop offset="100%" stopColor={ratingColor} stopOpacity={1} />
            </linearGradient>
          </defs>
          {/* Background arc */}
          <path
            d="M 15 95 A 70 70 0 0 1 165 95"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
          />
          {/* Foreground arc with gradient */}
          <path
            d="M 15 95 A 70 70 0 0 1 165 95"
            fill="none"
            stroke="url(#savingsArcGrad)"
            strokeWidth={stroke}
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text x="90" y="78" textAnchor="middle" fill="currentColor" fontSize={36} fontWeight={700}>
            {rate}%
          </text>
          <text x="90" y="100" textAnchor="middle" fill={ratingColor} fontSize={12} fontWeight={600}>
            {ratingLabel}
          </text>
          <text x="90" y="115" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
            da receita poupada
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}
