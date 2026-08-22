import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Trophy, Wallet, PieChart } from 'lucide-react';

export interface SmartAlert {
  id: string;
  type: 'critical' | 'warning' | 'positive';
  title: string;
  description: string;
  icon?: 'alert' | 'trophy' | 'wallet' | 'budget';
}

const ICON_MAP = {
  alert: AlertTriangle,
  trophy: Trophy,
  wallet: Wallet,
  budget: PieChart,
};

const TYPE_STYLES = {
  critical: {
    bg: 'bg-destructive/8',
    border: 'border-destructive/20',
    iconBg: 'bg-destructive/15',
    iconColor: 'text-destructive',
  },
  warning: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
  },
  positive: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600',
  },
} as const;

interface Props {
  alerts: SmartAlert[];
}

export function SmartAlertsCarousel({ alerts }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (alerts.length === 0) return null;

  return (
    <div className="relative group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {alerts.map(alert => {
            const style = TYPE_STYLES[alert.type];
            const IconComp = ICON_MAP[alert.icon || 'alert'];
            return (
              <div
                key={alert.id}
                className={`flex-[0_0_auto] w-[85%] sm:w-[45%] lg:w-[32%] min-w-0 rounded-2xl border ${style.bg} ${style.border} p-3 sm:p-4 transition-shadow hover:shadow-card`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.iconBg}`}>
                    <IconComp className={`h-4 w-4 ${style.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation arrows - desktop only */}
      {canScrollPrev && (
        <button
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-background border shadow-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollNext && (
        <button
          onClick={() => emblaApi?.scrollNext()}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-background border shadow-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
