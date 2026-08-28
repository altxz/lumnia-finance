import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const surfaceVariants = cva("text-foreground", {
  variants: {
    variant: {
      base: "surface-base",
      raised: "surface-raised",
      sunken: "surface-sunken",
      floating: "floating-glass",
    },
    radius: {
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    },
  },
  defaultVariants: {
    variant: "base",
    radius: "lg",
    padding: "md",
  },
});

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant, radius, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(surfaceVariants({ variant, radius, padding }), className)}
      {...props}
    />
  ),
);

Surface.displayName = "Surface";

export { Surface, surfaceVariants };
