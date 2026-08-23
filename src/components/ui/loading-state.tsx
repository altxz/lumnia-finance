import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ChartSkeleton({ className }: { className?: string }) {
  const heights = [38, 62, 48, 76, 58, 88, 70, 52, 82, 66, 92, 72];

  return (
    <div className={cn("flex h-full min-h-[240px] w-full flex-col gap-5 p-5", className)} aria-label="Carregando gráfico" role="status">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-2 border-b border-border/50 px-2">
        {heights.map((height, index) => (
          <Skeleton key={index} className="min-w-0 flex-1 rounded-t-lg rounded-b-sm" style={{ height: `${height}%` }} />
        ))}
      </div>
      <span className="sr-only">Carregando dados do gráfico</span>
    </div>
  );
}

function TableRowsSkeleton({ rows = 6, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-b border-border/50" aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="p-4">
              <Skeleton className={cn("h-4", column === 1 ? "w-full max-w-48" : "w-16", column === columns - 1 && "ml-auto w-8")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MobileListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Carregando transações" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="glass-soft flex min-h-[76px] items-center justify-between gap-4 rounded-2xl p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
      <span className="sr-only">Carregando transações</span>
    </div>
  );
}

function AiMessageSkeleton() {
  return (
    <div className="glass-soft flex w-fit items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3" aria-label="A inteligência está respondendo" role="status">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-2 w-2 rounded-full" style={{ animationDelay: `${index * 150}ms` }} />
      ))}
      <span className="sr-only">A inteligência está respondendo</span>
    </div>
  );
}

export { AiMessageSkeleton, ChartSkeleton, MobileListSkeleton, TableRowsSkeleton };