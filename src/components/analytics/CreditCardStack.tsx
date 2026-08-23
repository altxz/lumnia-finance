import { useRef, useState } from 'react';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import type { InvoicePeriod } from '@/lib/invoiceHelpers';
import { cn } from '@/lib/utils';

interface CreditCardStackProps {
  invoices: InvoicePeriod[];
  activeIndex: number;
  onChange: (index: number) => void;
  gradientFor: (cardName: string) => string;
  statusLabel?: (invoice: InvoicePeriod) => React.ReactNode;
}

/** Últimos 4 caracteres do id como "número" mascarado do cartão. */
function maskedDigits(cardId: string) {
  const clean = cardId.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(-4).toUpperCase();
}

const DRAG_THRESHOLD = 60;

export function CreditCardStack({ invoices, activeIndex, onChange, gradientFor, statusLabel }: CreditCardStackProps) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const count = invoices.length;
  const canSwipe = count > 1;

  const order = (idx: number) => (idx - activeIndex + count) % count;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canSwipe) return;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDragX(e.clientX - startX.current);
  };

  const finishDrag = () => {
    if (startX.current === null) return;
    if (Math.abs(dragX) > DRAG_THRESHOLD) {
      const dir = dragX < 0 ? 1 : -1;
      onChange((activeIndex + dir + count) % count);
    }
    startX.current = null;
    setDragX(0);
  };

  return (
    <div className="select-none">
      <div
        className="relative w-full aspect-[1.75/1] touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {invoices.map((inv, idx) => {
          const pos = order(idx);
          if (pos > 2) return null;
          const isFront = pos === 0;
          const style: React.CSSProperties = {
            transform: isFront
              ? `translateX(${dragX}px) rotate(${dragX * 0.02}deg)`
              : `translate(${pos * 22}px, ${pos * -6}px) scale(${1 - pos * 0.04})`,
            zIndex: count - pos,
            transition: startX.current !== null && isFront ? 'none' : 'transform 250ms ease',
            opacity: isFront ? 1 : 0.85 - pos * 0.15,
          };

          return (
            <div
              key={inv.cardId}
              style={style}
              className={cn(
                'absolute inset-0 rounded-3xl bg-gradient-to-br shadow-float overflow-hidden',
                isFront && canSwipe && 'cursor-grab active:cursor-grabbing',
                gradientFor(inv.cardName),
              )}
              aria-hidden={!isFront}
            >
              <div className="absolute inset-0 opacity-15">
                <div className="absolute -top-8 -right-6 w-40 h-40 rounded-full bg-white/40 blur-2xl" />
                <div className="absolute bottom-0 left-4 w-28 h-28 rounded-full bg-white/20 blur-2xl" />
              </div>

              <div className="relative h-full flex flex-col justify-between p-4 sm:p-5 text-white">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold tracking-wide truncate">{inv.cardName}</p>
                  {isFront && statusLabel?.(inv)}
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-[0.2em] opacity-90">
                      •••• {maskedDigits(inv.cardId)}
                    </p>
                    <p className="text-lg sm:text-xl font-extrabold mt-1">{formatCurrency(inv.total)}</p>
                    <p className="text-[10px] font-medium opacity-90">
                      Fecha dia {inv.closingDay} • Vence dia {inv.dueDay}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <CreditCardIcon className="h-6 w-6 ml-auto opacity-80" />
                    <p className="text-[10px] font-medium uppercase mt-2 opacity-90">Limite</p>
                    <p className="text-xs font-bold">{formatCurrency(inv.limit)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canSwipe && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {invoices.map((inv, idx) => (
            <button
              key={inv.cardId}
              type="button"
              onClick={() => onChange(idx)}
              aria-label={`Ver cartão ${inv.cardName}`}
              aria-current={idx === activeIndex}
              className={cn(
                'h-2 rounded-full transition-all',
                idx === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
