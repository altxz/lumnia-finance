import { useMemo, useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import type { CategoryStats } from '@/hooks/useAnalyticsData';

interface ExpenseTreemapProps {
  categoryStats: CategoryStats[];
}

interface CategoryColor {
  name: string;
  color: string;
}

const CustomContent = (props: any) => {
  const { x, y, width, height, name, value, fill } = props;
  if (width < 30 || height < 30) return null;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} />
      {width > 60 && height > 40 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={width > 100 ? 13 : 11} fontWeight={600}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={width > 100 ? 11 : 9}>
            {formatCurrency(value)}
          </text>
        </>
      )}
    </g>
  );
};

export function ExpenseTreemap({ categoryStats }: ExpenseTreemapProps) {
  const { user } = useAuth();
  const [categoryColors, setCategoryColors] = useState<CategoryColor[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('categories').select('name, color').eq('user_id', user.id).then(({ data }) => {
      setCategoryColors((data || []) as CategoryColor[]);
    });
  }, [user]);

  const treemapData = useMemo(() => {
    const colorMap: Record<string, string> = {};
    categoryColors.forEach(c => { colorMap[c.name.toLowerCase()] = c.color; });

    const expenseStats = categoryStats.filter(s => s.total > 0);
    if (expenseStats.length === 0) return [];

    return expenseStats.map(s => ({
      name: s.category,
      value: Math.round(s.total * 100) / 100,
      fill: colorMap[s.category.toLowerCase()] || '#6366f1',
    }));
  }, [categoryStats, categoryColors]);

  if (treemapData.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Composição de Gastos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={300}>
          <Treemap
            data={treemapData}
            dataKey="value"
            nameKey="name"
            content={<CustomContent />}
          >
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Valor']}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                fontSize: '13px',
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
