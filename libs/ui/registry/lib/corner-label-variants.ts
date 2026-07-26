import { cva } from "class-variance-authority";

/** Variants for the small absolute label used on framed panels. */
export const cornerLabelVariants = cva(
  "absolute -top-3 left-4 z-[var(--z-base)] bg-background px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground",
  {
    variants: {
      variant: {
        border: "border border-border",
        gap: "",
        // Readout is the reticle's own instrument, not a chip parked near it:
        // it sits on the panel's top rule between the bracket arms (no border
        // box - the arms are the frame) and tracks the pane's focused state.
        readout: "-top-[9px] text-[11px] leading-none tracking-[0.18em]",
      },
    },
    defaultVariants: { variant: "border" },
  },
);
