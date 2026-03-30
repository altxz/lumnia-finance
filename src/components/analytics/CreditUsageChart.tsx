import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { InfoPopover } from '@/components/ui/info-popover';
import { Progress } from '@/components/ui/progress';

interface Props {
  cards: { id: string; name: string; limit_amount: number }[];
  unpaidExpenses: { value: number; credit_card_id: string }[];
}

export function CreditUsageChart({ cards, unpaidExpenses }: Props) {
  const data = useMemo(() => {
    const usedByCard: Record<string, number> = {};
    unpaidExpenses.forEach((e) => {
      usedByCard[e.credit_card_id] = (usedByCard[e.credit_card_id] || 0) + e.value;
    });
    return cards.map((c) => ({
      name: c.name,
      used: usedByCard[c.id] || 0,
      limit: c.limit_amount,
      pct: c.limit_amount > 0 ? Math.min(100, Math.round(((usedByCard[c.id] || 0) / c.limit_amount) * 100)) : 0,
    }));
  }, [cards, unpaidExpenses]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Uso de Cartão de Crédito</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Nenhum cartão</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Uso de Cartão de Crédito</CardTitle>
          <InfoPopover><p>Mostra qual porcentagem do limite de cada cartão já foi utilizada no período.</p></InfoPopover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4 flex flex-col gap-4 justify-center">
        {data.map((card) => {
          const colorClass =
            card.pct >= 90 ? 'bg-destructive' :
            card.pct >= 70 ? 'bg-orange-500 dark:bg-destructive/70' :
            'bg-primary';

          return (
            <div key={card.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium truncate max-w-[140px]">{card.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatCurrency(card.used)} / {formatCurrency(card.limit)}
                </span>
              </div>
              <div className="relative">
                <Progress value={card.pct} className="h-3 rounded-full bg-secondary" />
                {/* Overlay colored indicator */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${colorClass}`}
                  style={{ width: `${card.pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">{card.pct}% utilizado</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
