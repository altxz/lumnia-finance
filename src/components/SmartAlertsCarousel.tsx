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
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    label: 'Requer atenção',
  },
  warning: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    label: 'Acompanhe',
  },
  positive: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    label: 'Boa evolução',
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
    <section className="relative group" aria-labelledby="smart-alerts-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="smart-alerts-title" className="type-title-2">Para sua atenção</h2>
        {alerts.length > 1 && <span className="type-caption shrink-0">{alerts.length} insights</span>}
      </div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {alerts.map(alert => {
            const style = TYPE_STYLES[alert.type];
            const IconComp = ICON_MAP[alert.icon || 'alert'];
            return (
              <div
                key={alert.id}
                className="surface-base min-w-0 flex-[0_0_auto] w-[92%] rounded-xl p-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-card sm:w-[48%] lg:w-[36%]"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.iconBg}`}>
                    <IconComp className={`h-4 w-4 ${style.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${style.iconColor}`}>{style.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-snug">{alert.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{alert.description}</p>
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
          aria-label="Insight anterior"
          className="absolute left-0 top-[68%] -translate-y-1/2 -translate-x-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollNext && (
        <button
          onClick={() => emblaApi?.scrollNext()}
          aria-label="Próximo insight"
          className="absolute right-0 top-[68%] -translate-y-1/2 translate-x-1/2 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-card opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
