import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer overflow-hidden rounded-lg bg-muted/70", className)} {...props} />;
}

export { Skeleton };
