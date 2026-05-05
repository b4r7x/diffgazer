import { cva } from "class-variance-authority";

export const inputVariants = cva(
  "flex w-full bg-background border border-border text-foreground font-mono placeholder:text-foreground/50 transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "h-7 px-2 py-1 text-xs",
        md: "h-9 px-3 py-2 text-sm",
        lg: "h-11 px-4 py-2 text-base",
      },
      error: {
        true: "border-2 border-destructive focus:border-destructive focus:ring-destructive",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);
