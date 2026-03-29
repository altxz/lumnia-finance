import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/constants';

interface Props {
  expenses: any[];
  categories: any[];
}

const FALLBACK_COLORS = ['#6366f1','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function CustomContent(props: any) {
  const { x, y, width, height, name, fill } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} stroke="hsl(var(--background))" strokeWidth={2} />
      {width > 50 && height > 30 && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={600}>{name?.slice(0, Math.floor(width / 7))}</text>
      )}
    </g>
  );
}

export function SubcategoryTreemap({ expenses, categories }: Props) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      map[e.final_category] = (map[e.final_category] || 0) + e.value;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([cat, total], i) => {
        const dbCat = categories.find((c: any) => c.name.toLowerCase() === cat);
        return { name: dbCat?.name || cat, size: total, fill: dbCat?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] };
      });
  }, [expenses, categories]);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Subcategorias</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4 flex items-center justify-center text-sm text-muted-foreground">Sem dados</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Subcategorias Detalhadas</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" content={<CustomContent />}>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </Treemap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
