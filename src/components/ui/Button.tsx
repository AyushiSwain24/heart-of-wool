import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-transform disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-pink text-primary-foreground hover:scale-105 shadow-soft",
        outline: "border border-olive text-olive hover:bg-cream-deep",
        ghost: "text-olive hover:bg-cream-deep",
        subtle: "bg-cream-deep text-olive hover:bg-muted",
      },
      size: {
        sm: "px-4 py-2 text-xs",
        md: "px-6 py-3 text-xs uppercase",
        lg: "px-7 py-3.5 text-xs uppercase",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
