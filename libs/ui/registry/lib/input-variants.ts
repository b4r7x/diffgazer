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
  // Focus is the inset grammar shared by every editable field: the 1px border
  // switches to --ring and a 1px ring doubles it. Invalid swaps both to --error
  // and keeps the border at 1px, so validity toggles never resize the content box.
  //
  // `outline-hidden` rather than `outline-none`: forced-colors drops the ring
  // (a box-shadow) and forces border-color to the system palette, so both halves of
  // the indicator disappear and a suppressed UA outline would leave focus invisible.
  // outline-hidden suppresses the outline the same way but keeps a 2px transparent
  // one that forced-colors repaints in a system color.
  "flex w-full bg-background border border-border text-foreground font-mono placeholder:text-foreground/55 transition-colors focus:border-ring focus:ring-1 focus:ring-ring focus:outline-hidden disabled:opacity-50 disabled:border-dashed disabled:cursor-not-allowed aria-invalid:border-error aria-invalid:ring-1 aria-invalid:ring-error aria-invalid:focus:border-error aria-invalid:focus:ring-error",
  {
    variants: {
      size: inputSizeClasses,
    },
    defaultVariants: {
      size: "md",
    },
  },
);
