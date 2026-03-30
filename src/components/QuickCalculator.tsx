import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';

interface QuickCalculatorProps {
  onSelect: (value: number) => void;
}

const BUTTONS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', 'C', '+'],
];

export function QuickCalculator({ onSelect }: QuickCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState('');

  const handlePress = (key: string) => {
    if (key === 'C') {
      setExpression('');
      return;
    }

    // Prevent starting with an operator
    if ('+-*/'.includes(key) && (!expression || '+-*/'.includes(expression.slice(-1)))) {
      if (expression) {
        setExpression(prev => prev.slice(0, -1) + key);
      }
      return;
    }

    // Prevent multiple dots in same number
    if (key === '.') {
      const parts = expression.split(/[+\-*/]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return;
    }

    setExpression(prev => prev + key);
  };

  const evaluate = (): number | null => {
    if (!expression) return null;
    try {
      // Safe eval using Function constructor with only math
      const sanitized = expression.replace(/[^0-9+\-*/.]/g, '');
      if (!sanitized) return null;
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === 'number' && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  };

  const result = evaluate();

  const handleApply = () => {
    if (result !== null) {
      onSelect(result);
      setExpression('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Calculadora rápida"
        >
          <Calculator className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[240px] p-3 rounded-xl"
      >
        {/* Display */}
        <div className="mb-2 rounded-lg bg-muted/50 border p-2 min-h-[52px]">
          <p className="text-xs text-muted-foreground font-mono truncate">
            {expression || '0'}
          </p>
          <p className="text-lg font-bold font-mono text-right">
            {result !== null ? result.toFixed(2) : '—'}
          </p>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-1.5">
          {BUTTONS.flat().map((key) => (
            <Button
              key={key}
              type="button"
              variant={'+-*/'.includes(key) ? 'secondary' : key === 'C' ? 'outline' : 'ghost'}
              size="sm"
              className="h-10 text-base font-semibold rounded-lg"
              onClick={() => handlePress(key)}
            >
              {key === '*' ? '×' : key === '/' ? '÷' : key}
            </Button>
          ))}
        </div>

        {/* Apply */}
        <Button
          type="button"
          className="w-full mt-2 rounded-lg font-semibold"
          disabled={result === null}
          onClick={handleApply}
        >
          Aplicar {result !== null ? `R$ ${result.toFixed(2)}` : ''}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
