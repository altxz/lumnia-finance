import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/constants';
import { History } from 'lucide-react';
import { useDescriptionSuggestions, type DescriptionSuggestion } from '@/hooks/useDescriptionSuggestions';

interface DescriptionAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: DescriptionSuggestion) => void;
  type: 'income' | 'expense' | 'transfer';
  placeholder?: string;
}

export function DescriptionAutocomplete({
  id,
  value,
  onChange,
  onSelectSuggestion,
  type,
  placeholder,
}: DescriptionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const { suggestions } = useDescriptionSuggestions(term, type);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={e => {
          onChange(e.target.value);
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        className="rounded-xl h-11"
      />

      {showList && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-float overflow-hidden">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lançamentos parecidos
          </p>
          <ul className="max-h-56 overflow-y-auto">
            {suggestions.map(s => (
              <li key={s.description}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSuggestion(s);
                    setTerm(s.description);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                >
                  <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 min-w-0 text-sm truncate">{s.description}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {formatCurrency(Number(s.value) || 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
