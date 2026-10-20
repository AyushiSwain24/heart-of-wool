import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-input bg-card px-4 py-2.5 text-sm text-olive placeholder:text-olive-soft/60 focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
