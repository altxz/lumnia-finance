import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/constants';
import { AlertTriangle, ChevronDown, Lightbulb } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CategoryBudgetNode, DbCategory, BudgetRow } from '@/hooks/useBudgetData';

interface Props {
  node: CategoryBudgetNode;
  saveBudget: (categoryId: string, amount: number) => Promise<void>;
  savingId: string | null;
}

function ProgressRow({
  label,
  color,
  allocated,
  spent,
  prevBudget,
  categoryId,
  saveBudget,
  savingId,
}: {
  label: string;
  color: string;
  allocated: number;
  spent: number;
  prevBudget: number;
  categoryId: string;
  saveBudget: (id: string, amount: number) => Promise<void>;
  savingId: string | null;
}) {
  const [localVal, setLocalVal] = useState<string>(allocated > 0 ? String(allocated) : '');
  const pct = allocated > 0 ? (spent / allocated) * 100 : (spent > 0 ? 100 : 0);
  const clamped = Math.min(100, pct);
  const isOver = pct >= 100 && allocated > 0;
  const isWarning = pct >= 80 && pct < 100 && allocated > 0;

  const barColor = isOver
    ? '[&>div]:bg-destructive'
    : isWarning
      ? '[&>div]:bg-orange-500'
      : '[&>div]:bg-green-500';

  const handleApplySuggestion = () => {
    setLocalVal(String(prevBudget));
    saveBudget(categoryId, prevBudget);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2">
      <div className="flex items-center gap-2 sm:w-36 shrink-0">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>

      <div className="flex items-center gap-1 sm:w-44 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Meta:</span>
        <Input
          type="number"
          step="50"
          min="0"
          placeholder="0"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localVal) || 0;
            saveBudget(categoryId, val);
          }}
          className="rounded-xl h-8 w-24 text-sm"
          disabled={savingId === categoryId}
        />
        {prevBudget > 0 && allocated === 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleApplySuggestion} className="text-amber-500 hover:text-amber-600 shrink-0">
                <Lightbulb className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Usar mês anterior: {formatCurrency(prevBudget)}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex justify-between text-xs">
          <span className={`flex items-center gap-1 ${isOver ? 'text-destructive font-semibold' : isWarning ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
            {isOver && <AlertTriangle className="h-3 w-3" />}
            {formatCurrency(spent)}
          </span>
          <span className="text-muted-foreground">
            {allocated > 0 ? `${pct.toFixed(0)}%` : '—'}
          </span>
        </div>
        <Progress value={clamped} className={`h-2 ${barColor}`} />
        {isOver && (
          <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Ultrapassou em {formatCurrency(spent - allocated)}
          </p>
        )}
        {isWarning && (
          <p className="text-[11px] text-orange-600 font-medium">
            Atenção: próximo do limite ({pct.toFixed(0)}%)
          </p>
        )}
      </div>
    </div>
  );
}

export function BudgetCategoryRow({ node, saveBudget, savingId }: Props) {
  const { category, children, budget, childBudgets, spent, childSpent, prevBudget, childPrevBudgets } = node;
  const totalAllocated = (budget?.allocated_amount || 0) + children.reduce((s, ch) => s + (childBudgets[ch.id]?.allocated_amount || 0), 0);
  const hasChildren = children.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        {hasChildren ? (
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="font-semibold text-sm">{category.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{children.length} sub</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(spent)} / {totalAllocated > 0 ? formatCurrency(totalAllocated) : '—'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 pl-2 sm:pl-4 border-l-2 border-muted space-y-1">
                {children.map(ch => (
                  <ProgressRow
                    key={ch.id}
                    label={ch.name}
                    color={ch.color}
                    allocated={childBudgets[ch.id]?.allocated_amount || 0}
                    spent={childSpent[ch.id] || 0}
                    prevBudget={childPrevBudgets[ch.id] || 0}
                    categoryId={ch.id}
                    saveBudget={saveBudget}
                    savingId={savingId}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <ProgressRow
            label={category.name}
            color={category.color}
            allocated={budget?.allocated_amount || 0}
            spent={spent}
            prevBudget={prevBudget}
            categoryId={category.id}
            saveBudget={saveBudget}
            savingId={savingId}
          />
        )}
      </CardContent>
    </Card>
  );
}
