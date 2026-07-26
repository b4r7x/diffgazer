import { cva } from "class-variance-authority";

/** Allowed sidebar variant values. */
export type SidebarVariant = "caret" | "inverted" | "bar" | "terminal" | "tree";

/** Class variants for sidebar container. */
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

/** Class variants for sidebar item. */
export const sidebarItemVariants = cva(
  [
    // group/item is consumed by the marker glyph in sidebar-item (hover preview).
    "group/item flex items-center gap-2 w-full min-w-0 px-2 py-1 text-sm",
    // Coarse-pointer floor (variants.mdx recipe 1): px-2 py-1 + text-sm is a 28px
    // row, below the 44px touch target bar. Rows live in SidebarContent, a
    // `flex-1 overflow-y-auto` column that is allowed to grow, so a real minimum
    // size is safe here; a negative margin would break the tree variant's
    // contiguous trunk and a pseudo overhang would be clipped by the scroller.
    "pointer-coarse:min-h-11",
    "cursor-pointer transition-colors motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
    "disabled:cursor-not-allowed",
    // Disabled rows keep the dimmed resting look on hover so they never invite
    // a click; each variant re-states its own resting text tone below.
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    "aria-disabled:hover:bg-transparent aria-disabled:hover:text-foreground/70",
    "no-underline",
    // Rail mode: center the icon, drop horizontal padding so the icon sits at
    // the geometric center of the 48px rail. Label/badge/glyph children hide
    // themselves via `group-data-[state=rail]/sidebar:hidden`.
    "group-data-[state=rail]/sidebar:justify-center group-data-[state=rail]/sidebar:px-0 group-data-[state=rail]/sidebar:gap-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Marker glyphs for caret/terminal render in sidebar-item's
        // VariantGlyph, not here.
        caret: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[selected]:text-foreground",
          "data-[selected]:hover:bg-foreground/5",
        ].join(" "),
        inverted: [
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[selected]:bg-foreground data-[selected]:text-background data-[selected]:font-semibold",
          // Contract: requires SidebarContent to ship `p-4` (16px horizontal
          // padding). If you change Content padding, update -mx-4 / +2rem / px-6
          // here too — they hard-couple to that 16px gutter.
          //
          // SidebarContent applies p-4 (16px), so the active row reaches BOTH
          // shell edges via -mx-4 (margins) AND w-[calc(100%+2rem)] (explicit
          // width — w-full alone resolves to the section's content box, which
          // negative margins do not widen). px-6 compensates the 16px margin
          // bleed so the label glyph X stays stable when (in)active.
          "data-[selected]:-mx-4 data-[selected]:w-[calc(100%+2rem)] data-[selected]:px-6",
          // Rail mode: SidebarContent zeroes horizontal padding (no 16px gutter
          // to bleed past). Reset the active row's full-bleed math so the row
          // stays at the 32px square footprint inside the 48px rail.
          "group-data-[state=rail]/sidebar:data-[selected]:mx-0 group-data-[state=rail]/sidebar:data-[selected]:w-full group-data-[state=rail]/sidebar:data-[selected]:px-0",
          "data-[selected]:hover:bg-foreground data-[selected]:hover:text-background",
        ].join(" "),
        bar: [
          "border-l-2 border-transparent -ml-[2px] pl-[calc(0.5rem+3px)] group-data-[state=rail]/sidebar:ml-0",
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[selected]:text-foreground data-[selected]:border-l-foreground",
          "data-[selected]:bg-foreground/5 data-[selected]:hover:bg-foreground/5",
        ].join(" "),
        // Terminal/TUI rail: every row carries a faint 1px left rail so stacked
        // items form one continuous hairline (the "grid" of the CLI aesthetic).
        // Active brightens its rail segment to foreground and the text to
        // foreground — no background fill, austere by design. -ml-px collapses
        // the row border onto the section gutter so the rail stays 1px wide.
        terminal: [
          "border-l border-border -ml-px pl-[calc(0.5rem+3px)] group-data-[state=rail]/sidebar:ml-0",
          "text-foreground/60 hover:text-foreground hover:border-foreground/40",
          "aria-disabled:hover:text-foreground/60 aria-disabled:hover:border-border",
          "data-[selected]:text-foreground data-[selected]:border-l-foreground",
          "data-[selected]:hover:border-l-foreground",
        ].join(" "),
        // Connectors are drawn per item in sidebar.css, from the row's own left
        // edge. They rely on contiguous rows (py, no gap) for an unbroken trunk.
        //
        // --sidebar-tree-rail is that left edge: the row is pushed in by it so
        // the trunk lands under a collapsible section title's fold chevron
        // (px-2 gutter + half of the 12px chevron), and the padding gives back
        // what the margin took so the label still sits at 24px, aligned with
        // the title's text (px-2 + 12px chevron + gap-1). Non-collapsible titles
        // have no chevron and sit at 8px, so items indent past them.
        //
        // Starting the box at the trunk is also what keeps the selected/hover
        // band tied to the tree: it fills from the rail out to the row's end
        // instead of bleeding into the gutter and cutting the trunk in half.
        // No parent-padding math — the row owns both halves of the offset.
        //
        // w-auto replaces the base w-full: a full-width row plus a left margin
        // overflows its column by the margin, and SidebarContent then has a
        // horizontal scroll it can only hide, shifting the whole tree sideways
        // the first time an active row is scrolled into view.
        tree: [
          "[--sidebar-tree-rail:14px] relative ml-(--sidebar-tree-rail) w-auto pl-[calc(1.5rem-var(--sidebar-tree-rail))] py-1.5",
          "group-data-[state=rail]/sidebar:ml-0 group-data-[state=rail]/sidebar:pl-0",
          "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
          "data-[selected]:bg-foreground/8 data-[selected]:text-foreground",
          "data-[selected]:hover:bg-foreground/10",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "caret",
    },
  },
);
