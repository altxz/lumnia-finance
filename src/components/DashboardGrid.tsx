import { useState, useCallback, ReactNode, useMemo } from 'react';
import { Responsive, Layout } from 'react-grid-layout';
import WidthProvider from 'react-grid-layout/lib/components/WidthProvider';
import { GripVertical, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface GridWidget {
  id: string;
  title: string;
  component: ReactNode;
  /** Default layout per breakpoint: { lg: {x,y,w,h}, md: …, sm: … } */
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

function buildLayouts(widgets: GridWidget[]): Layouts {
  const layouts: Layouts = { lg: [], md: [], sm: [] };
  for (const w of widgets) {
    for (const bp of ['lg', 'md', 'sm'] as const) {
      const def = w.defaultLayout[bp];
      layouts[bp]!.push({
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

function loadLayouts(key: string, widgets: GridWidget[]): Layouts {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return buildLayouts(widgets);
}

export function DashboardGrid({ widgets, storageKey = 'dashboard-grid-layouts' }: DashboardGridProps) {
  const defaultLayouts = useMemo(() => buildLayouts(widgets), [widgets]);
  const [layouts, setLayouts] = useState<Layouts>(() => loadLayouts(storageKey, widgets));
  const [locked, setLocked] = useState(true);

  const handleLayoutChange = useCallback((_: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    try {
      localStorage.setItem(storageKey, JSON.stringify(allLayouts));
    } catch { /* ignore */ }
  }, [storageKey]);

  const handleReset = useCallback(() => {
    setLayouts(defaultLayouts);
    localStorage.removeItem(storageKey);
  }, [defaultLayouts, storageKey]);

  return (
    <div className="relative">
      {/* Toolbar */}
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

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
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
              {/* Drag Handle — only visible when unlocked */}
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
      </ResponsiveGridLayout>
    </div>
  );
}
