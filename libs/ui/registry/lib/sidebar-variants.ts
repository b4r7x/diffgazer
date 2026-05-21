import { cva } from "class-variance-authority";

/**
 * Visual contract for the Sidebar primitive. Five variants share the same
 * row metrics (24px line height, 12px JBMono, 1ch caret/check slot) so the
 * choice is purely a matter of active-marker treatment — picked at the
 * `<Sidebar variant="…">` root and propagated via context to items.
 *
 * Active-hover precedence: each variant ships `hover:` *and*
 * `data-[active=true]:hover:` rules. The latter wins on equal specificity by
 * adding one attribute selector, so hovering the active item keeps the active
 * background instead of leaking to the inactive hover tone. Same pattern as
 * `segmented-variants.ts`.
 */
export type SidebarVariant = "caret" | "inverted" | "bar" | "bracket" | "block";

/**
 * Root chrome: width-tweened tristate plus the font/family contract. Width
 * tween runs 180ms; `motion-reduce` removes the transition but the state still
 * flips. `hidden` state slides off-canvas (`-translate-x-full`) so focused
 * elements unmount cleanly while remaining in the DOM for animation reentry.
 */
export const sidebarContainerVariants = cva(
  [
    // group/sidebar lets descendants (item label/badge/glyph, section title)
    // read the nav's `data-state` via `group-data-[state=rail]/sidebar:*` so
    // rail mode (48px) hides label text and shows icon-only rows without
    // threading state through every component prop.
    "group/sidebar flex flex-col h-full font-mono",
    "transition-[width,transform] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]",
    "motion-reduce:transition-none",
    "overflow-hidden",
  ].join(" "),
  {
    variants: {
      state: {
        open: "w-64",
        rail: "w-12",
        hidden: "w-64 -translate-x-full",
      },
    },
    defaultVariants: {
      state: "open",
    },
  },
);

/**
 * Row contract. JBMono is monospaced so the 400 → 600 weight bump on the
 * active item does not shift glyph advance widths; no width-reservation
 * pseudo-element is required.
 *
 * V2 `inverted` bleeds past the surrounding `<SidebarContent>` `p-4` so the
 * active row reaches both shell edges. The negative `-mx-4` + compensating
 * `px-6` keeps the label's left edge identical to inactive rows.
 *
 * V3 `bar` shifts the row left by 1px and pads `pl-[calc(0.5rem-1px)]` so
 * the 1px active border-l does not nudge the label sideways when toggled.
 */
export const sidebarItemVariants = cva(
  [
    "flex items-center gap-2 w-full min-w-0 px-2 py-1 text-sm",
    "cursor-pointer transition-colors motion-reduce:transition-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground",
    "disabled:cursor-not-allowed",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "no-underline",
    // Rail mode: center the icon, drop horizontal padding so the icon sits at
    // the geometric center of the 48px rail. Label/badge/glyph children hide
    // themselves via `group-data-[state=rail]/sidebar:hidden`.
    "group-data-[state=rail]/sidebar:justify-center group-data-[state=rail]/sidebar:px-0 group-data-[state=rail]/sidebar:gap-0",
  ].join(" "),
  {
    variants: {
      variant: {
        caret: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[active=true]:text-foreground data-[active=true]:font-semibold",
          "data-[active=true]:hover:bg-foreground/5",
        ].join(" "),
        inverted: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:font-semibold",
          // Contract: requires SidebarContent to ship `p-4` (16px horizontal
          // padding). If you change Content padding, update -mx-4 / +2rem / px-6
          // here too — they hard-couple to that 16px gutter.
          //
          // SidebarContent applies p-4 (16px), so the active row reaches BOTH
          // shell edges via -mx-4 (margins) AND w-[calc(100%+2rem)] (explicit
          // width — w-full alone resolves to the section's content box, which
          // negative margins do not widen). px-6 compensates the 16px margin
          // bleed so the label glyph X stays stable when (in)active.
          "data-[active=true]:-mx-4 data-[active=true]:w-[calc(100%+2rem)] data-[active=true]:px-6",
          // Rail mode: SidebarContent zeroes horizontal padding (no 16px gutter
          // to bleed past). Reset the active row's full-bleed math so the row
          // stays at the 32px square footprint inside the 48px rail.
          "group-data-[state=rail]/sidebar:data-[active=true]:mx-0 group-data-[state=rail]/sidebar:data-[active=true]:w-full group-data-[state=rail]/sidebar:data-[active=true]:px-0",
          "data-[active=true]:hover:bg-foreground data-[active=true]:hover:text-background",
        ].join(" "),
        bar: [
          "border-l border-transparent -ml-px pl-[calc(0.5rem+3px)]",
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[active=true]:text-foreground data-[active=true]:font-semibold data-[active=true]:border-l-foreground",
          "data-[active=true]:hover:bg-foreground/5",
        ].join(" "),
        bracket: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[active=true]:text-foreground data-[active=true]:font-semibold",
          "data-[active=true]:hover:bg-foreground/5",
        ].join(" "),
        block: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[active=true]:bg-foreground/8 data-[active=true]:text-foreground data-[active=true]:font-semibold",
          "data-[active=true]:hover:bg-foreground/10",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "caret",
    },
  },
);
