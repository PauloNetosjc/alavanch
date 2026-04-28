import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-normal transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--status-neutral-bg))] text-[hsl(var(--status-neutral-fg))]",
        success: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]",
        warning: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]",
        danger: "bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger-fg))]",
        info: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))]",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border text-foreground bg-transparent",
        destructive: "bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger-fg))]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
