import { useState, useMemo, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import type { LucideProps } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  color: string;
}

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

function DynamicIcon({ name, ...props }: { name: string } & Omit<LucideProps, 'ref'>) {
  const key = name.toLowerCase().replace(/_/g, '-') as keyof typeof dynamicIconImports;
  if (!dynamicIconImports[key]) {
    return <div className="w-4 h-4 rounded-full" style={{ background: 'currentColor', opacity: 0.3 }} />;
  }
  const IconComp = lazy(dynamicIconImports[key]);
  return (
    <Suspense fallback={<div className="w-4 h-4" />}>
      <IconComp {...props} />
    </Suspense>
  );
}

export function CategoryPicker({ categories, value, onValueChange, placeholder = 'Selecione a categoria' }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    const children = categories.filter(c => !!c.parent_id);
    return parents.map(p => ({
      ...p,
      subs: children.filter(c => c.parent_id === p.id),
    }));
  }, [categories]);

  const selectedCategory = useMemo(() => {
    if (!value) return null;
    return categories.find(c => c.name.toLowerCase() === value);
  }, [categories, value]);

  const handleSelect = (categoryName: string) => {
    onValueChange(categoryName.toLowerCase());
    setOpen(false);
  };

  // Find which parent contains the selected value to auto-expand
  const defaultAccordion = useMemo(() => {
    if (!value) return undefined;
    const parent = grouped.find(g => g.subs.some(s => s.name.toLowerCase() === value));
    return parent ? parent.id : undefined;
  }, [value, grouped]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between rounded-xl h-11 font-normal"
        >
          {selectedCategory ? (
            <span className="flex items-center gap-2 truncate" title={selectedCategory.name}>
              <DynamicIcon name={selectedCategory.icon} className="h-4 w-4 shrink-0" style={{ color: selectedCategory.color }} />
              <span className="truncate">{selectedCategory.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl" align="start">
        <div className="max-h-72 overflow-y-auto py-1">
          <Accordion type="single" collapsible defaultValue={defaultAccordion}>
            {grouped.map(group => {
              const hasSubs = group.subs.length > 0;

              if (!hasSubs) {
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary/60 transition-colors',
                      value === group.name.toLowerCase() && 'bg-secondary'
                    )}
                    onClick={() => handleSelect(group.name)}
                  >
                    <DynamicIcon name={group.icon} className="h-4 w-4 shrink-0" style={{ color: group.color }} />
                    <span className="font-medium flex-1 text-left truncate">{group.name}</span>
                    {value === group.name.toLowerCase() && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              }

              return (
                <AccordionItem key={group.id} value={group.id} className="border-b-0">
                  <AccordionTrigger className="px-3 py-2.5 text-sm hover:bg-secondary/60 hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <DynamicIcon name={group.icon} className="h-4 w-4 shrink-0" style={{ color: group.color }} />
                      <span className="font-semibold">{group.name}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 pt-0">
                    {group.subs.map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        className={cn(
                          'w-full flex items-center gap-2 pl-10 pr-3 py-2 text-sm hover:bg-secondary/60 transition-colors',
                          value === sub.name.toLowerCase() && 'bg-secondary'
                        )}
                        onClick={() => handleSelect(sub.name)}
                      >
                        <DynamicIcon name={sub.icon} className="h-3.5 w-3.5 shrink-0" style={{ color: sub.color }} />
                        <span className="flex-1 text-left truncate">{sub.name}</span>
                        {value === sub.name.toLowerCase() && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria encontrada</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
