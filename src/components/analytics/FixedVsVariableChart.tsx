import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';

interface Props {
  expenses: any[];
}

export function FixedVsVariableChart({ expenses }: Props) {
  const data = useMemo(() => {
    let fixed = 0;
    let variable = 0;
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (e.is_recurring) fixed += e.value;
      else variable += e.value;
    });
    if (fixed === 0 && variable === 0) return [];
    return [
      { name: 'Custos Fixos', value: fixed },
      { name: 'Custos Variáveis', value: variable },
    ];
  }, [expenses]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fixos vs Variáveis</CardTitle></CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Fixos vs Variáveis</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
