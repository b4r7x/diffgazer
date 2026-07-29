import { cva } from "class-variance-authority";

// iOS Safari zooms (and does NOT zoom back) when a focused input has computed
// font-size < 16px. `max-md:text-base` bumps sm/md to 16px on viewports <=768px.
// See WebKit bug 60125. Desktop keeps the compact 12/14px variants.
//
// sm/md are pointer:fine densities (28/36px; >=24px WCAG 2.5.8 AA — the tap
// target is the full row width). Use lg (44px) for coarse-pointer primary forms.
/** Size classes shared by Input and decorated input shells. */
export const inputSizeClasses = {
  sm: "h-7 px-2 py-1 text-xs max-md:text-base",
  md: "h-9 px-3 py-2 text-sm max-md:text-base",
  lg: "h-11 px-4 py-2 text-base",
} as const;

/** Base input styling with size variants and invalid-state selectors. */
export const inputVariants = cva(
  // Focus is the inset grammar shared by every editable field: the 1px border
  // switches to --ring and a 1px ring doubles it. Focus is the strongest edge a
  // field ever shows, so invalid at rest is only a tint: the border switches to
  // --error and the error ring waits for focus, where it replaces the focus
  // color. Validity toggles never resize the content box either way.
  //
  // `outline-hidden` rather than `outline-none`: forced-colors drops the ring
  // (a box-shadow) and forces border-color to the system palette, so both halves of
  // the indicator disappear and a suppressed UA outline would leave focus invisible.
  // outline-hidden suppresses the outline the same way but keeps a 2px transparent
  // one that forced-colors repaints in a system color.
  //
  // Disabled and read-only are different states and use different channels: disabled dashes the
  // EDGE ("this field is not part of this form"), read-only fills the SURFACE ("this value
  // matters, you just cannot change it"). Fill is the one dimension neither disabled nor invalid
  // nor focus uses, so read-only cannot be confused with any of them and stays focusable and
  // copyable with its full-contrast ink.
  "flex w-full bg-background border border-border text-foreground font-mono placeholder:text-foreground/55 transition-colors focus:border-ring focus:ring-1 focus:ring-ring focus:outline-hidden disabled:opacity-50 disabled:border-dashed disabled:cursor-not-allowed read-only:bg-secondary read-only:border-border read-only:text-foreground read-only:placeholder:text-foreground/40 read-only:cursor-default aria-invalid:border-error aria-invalid:focus:border-error aria-invalid:focus:ring-error",
  {
    variants: {
      size: inputSizeClasses,
    },
    defaultVariants: {
      size: "md",
    },
  },
);
