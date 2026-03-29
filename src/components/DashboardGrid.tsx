import { useState, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import { GripVertical, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
type LayoutsMap = Record<string, LayoutItem[]>;

export interface GridWidget {
  id: string;
  title: string;
  component: ReactNode;
  defaultLayout: {
    lg: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
    md: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
    sm: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  };
}

interface DashboardGridProps {
  widgets: GridWidget[];
  storageKey?: string;
}

const COLS = { lg: 12, md: 8, sm: 4 };
const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 };
const ROW_HEIGHT = 80;

function buildLayouts(widgets: GridWidget[]): LayoutsMap {
  const layouts: LayoutsMap = { lg: [], md: [], sm: [] };
  for (const w of widgets) {
    for (const bp of ['lg', 'md', 'sm'] as const) {
      const def = w.defaultLayout[bp];
      layouts[bp].push({
        i: w.id,
        x: def.x,
        y: def.y,
        w: def.w,
        h: def.h,
        minW: def.minW ?? 2,
        minH: def.minH ?? 2,
      });
    }
  }
  return layouts;
}

function loadLayouts(key: string, widgets: GridWidget[]): LayoutsMap {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return buildLayouts(widgets);
}

export function DashboardGrid({ widgets, storageKey = 'dashboard-grid-layouts' }: DashboardGridProps) {
  const defaultLayouts = useMemo(() => buildLayouts(widgets), [widgets]);
  const [layouts, setLayouts] = useState<LayoutsMap>(() => loadLayouts(storageKey, widgets));
  const [locked, setLocked] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleLayoutChange = useCallback((_current: LayoutItem[], allLayouts: LayoutsMap) => {
    setLayouts(allLayouts);
    try {
      localStorage.setItem(storageKey, JSON.stringify(allLayouts));
    } catch { /* ignore */ }
  }, [storageKey]);

  const handleReset = useCallback(() => {
    setLayouts(defaultLayouts);
    localStorage.removeItem(storageKey);
  }, [defaultLayouts, storageKey]);

  const Comp = ResponsiveGridLayout as any;

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocked(l => !l)}
          className="gap-1.5 text-xs"
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {locked ? 'Bloqueado' : 'Editando'}
        </Button>
        {!locked && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            Restaurar layout
          </Button>
        )}
      </div>

      <Comp
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={width}
        isDraggable={!locked}
        isResizable={!locked}
        draggableHandle=".drag-handle"
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        margin={[12, 12]}
        containerPadding={[0, 0]}
        useCSSTransforms
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="overflow-hidden">
            <Card className="h-full w-full rounded-2xl border-border/50 shadow-sm overflow-hidden flex flex-col">
              {!locked && (
                <div className="drag-handle flex items-center justify-center gap-1 py-1 bg-muted/50 border-b border-border/50 text-muted-foreground hover:bg-muted transition-colors">
                  <GripVertical className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium select-none">{widget.title}</span>
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {widget.component}
              </div>
            </Card>
          </div>
        ))}
      </Comp>
    </div>
  );
}
