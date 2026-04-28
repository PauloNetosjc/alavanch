import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-0 px-2 py-0.5 text-[11px] font-normal transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "badge-success",
        secondary: "badge-neutral",
        destructive: "badge-danger",
        outline: "badge-neutral",
        success: "badge-success",
        warning: "badge-warning",
        info: "badge-info",
        neutral: "badge-neutral",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
