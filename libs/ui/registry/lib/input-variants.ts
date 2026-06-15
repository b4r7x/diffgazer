import { cva } from "class-variance-authority";

// iOS Safari zooms (and does NOT zoom back) when a focused input has computed
// font-size < 16px. `max-md:text-base` bumps sm/md to 16px on viewports <=768px.
// See WebKit bug 60125. Desktop keeps the compact 12/14px variants.
/** Size classes shared by Input and decorated input shells. */
export const inputSizeClasses = {
  sm: "h-7 px-2 py-1 text-xs max-md:text-base",
  md: "h-9 px-3 py-2 text-sm max-md:text-base",
  lg: "h-11 px-4 py-2 text-base",
} as const;

/** Base input styling with size variants and invalid-state selectors. */
export const inputVariants = cva(
  "flex w-full bg-background border border-border text-foreground font-mono placeholder:text-foreground/55 transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-2 aria-invalid:border-error aria-invalid:focus:border-error aria-invalid:focus:ring-error",
  {
    variants: {
      size: inputSizeClasses,
    },
    defaultVariants: {
      size: "md",
    },
  },
);
