import { cva } from "class-variance-authority";

export const cornerLabelVariants = cva(
  "absolute -top-3 left-4 z-[var(--z-base)] bg-background px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground",
  {
    variants: {
      variant: {
        border: "border border-border",
        gap: "",
      },
    },
    defaultVariants: { variant: "border" },
  },
);
