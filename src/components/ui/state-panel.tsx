import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error" | "offline";
  className?: string;
}

function StatePanel({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  tone = "neutral",
  className,
}: StatePanelProps) {
  return (
    <Surface
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex min-h-48 flex-col items-center justify-center text-center", className)}
    >
      {icon && (
        <div
          className={cn(
            "mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground",
            tone === "error" && "bg-destructive/10 text-destructive",
            tone === "offline" && "bg-warning/10 text-warning",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="type-title-3">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-5" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Surface>
  );
}

export { StatePanel };
