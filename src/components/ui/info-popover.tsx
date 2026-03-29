import { useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoPopoverProps {
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function InfoPopover({ children, className, side = 'top', align = 'center' }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className="inline-flex items-center justify-center focus:outline-none"
          aria-label="Informações"
        >
          <Info className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={`max-w-[250px] text-xs p-3 ${className || ''}`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
