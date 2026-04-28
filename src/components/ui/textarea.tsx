import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md bg-white px-3 py-2 text-[13px] text-[#1A1A1A] placeholder:text-[#B0ACA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.05)] focus-visible:border-[#888888] hover:border-[#B0ACA8] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className,
      )}
      style={{ border: '0.5px solid #D0CCC8' }}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
