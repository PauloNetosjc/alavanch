import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md bg-white px-3 py-2 text-[13px] text-[#1A1A1A] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#B0ACA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.05)] focus-visible:border-[#888888] hover:border-[#B0ACA8] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className,
        )}
        style={{ border: '0.5px solid #D0CCC8' }}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
