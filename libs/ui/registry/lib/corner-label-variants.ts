import { cva } from "class-variance-authority";

/** Variants for the small absolute label used on framed panels. */
export const cornerLabelVariants = cva(
  "absolute -top-3 left-4 z-[var(--z-base)] px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground",
  {
    variants: {
      variant: {
        // Notched tab chip seated on the panel's border: it reads the panel's
        // own --panel-border-color so the chip edge tracks the enclosure in
        // both resting and focused states; --border covers consumers outside a
        // panel (CardLabel), which never declare it.
        border:
          "border border-[color:var(--panel-border-color,var(--border))] bg-[var(--surface-2)]",
        gap: "bg-background",
        // Readout is the reticle's own instrument, not a chip parked near it:
        // it sits on the panel's top rule between the bracket arms (no border
        // box - the arms are the frame) and tracks the pane's focused state.
        readout: "-top-[9px] bg-background text-[11px] leading-none tracking-[0.18em]",
      },
    },
    defaultVariants: { variant: "border" },
  },
);
