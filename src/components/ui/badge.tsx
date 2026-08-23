import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        food: "border-transparent bg-accent/20 text-accent-foreground",
        transport: "border-transparent bg-ai/15 text-secondary-foreground",
        leisure: "border-transparent bg-pink/30 text-primary",
        health: "border-transparent bg-destructive/15 text-destructive",
        home: "border-transparent bg-primary/15 text-primary",
        education: "border-transparent bg-ai/15 text-secondary-foreground",
        other: "border-transparent bg-muted text-muted-foreground",
        ai: "border-transparent bg-ai/15 text-secondary-foreground",
        success: "border-transparent bg-success/15 text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
});

Badge.displayName = "Badge";

export { Badge, badgeVariants };
