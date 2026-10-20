import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-cream-deep px-3 py-1 text-[10px] font-semibold tracking-widest text-olive uppercase",
        className,
      )}
      {...props}
    />
  );
}
