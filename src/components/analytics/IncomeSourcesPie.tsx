import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';

interface Props {
  expenses: any[];
  categories: any[];
}

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(142, 50%, 60%)', 'hsl(160, 60%, 45%)', 'hsl(180, 50%, 50%)', 'hsl(200, 60%, 55%)'];

export function IncomeSourcesPie({ expenses, categories }: Props) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type !== 'income') return;
      map[e.final_category] = (map[e.final_category] || 0) + e.value;
    });
    if (Object.keys(map).length === 0) return [];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => {
        const dbCat = categories.find((c: any) => c.name.toLowerCase() === cat);
        return { name: dbCat?.name || cat, value: total };
      });
  }, [expenses, categories]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fontes de Renda</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem receitas</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Fontes de Renda</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
