import { cva } from "class-variance-authority";

export type SidebarVariant = "caret" | "inverted" | "bar" | "bracket" | "block" | "terminal";

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
          "data-[active=true]:bg-foreground/5 data-[active=true]:hover:bg-foreground/5",
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
        // Terminal/TUI rail: every row carries a faint 1px left rail so stacked
        // items form one continuous hairline (the "grid" of the CLI aesthetic).
        // Active brightens its rail segment to foreground and the text to
        // foreground — no background fill, austere by design. -ml-px collapses
        // the row border onto the section gutter so the rail stays 1px wide.
        terminal: [
          "border-l border-border -ml-px pl-[calc(0.5rem+3px)]",
          "text-foreground/60 hover:text-foreground hover:border-foreground/40",
          "data-[active=true]:text-foreground data-[active=true]:border-l-foreground",
          "data-[active=true]:hover:border-l-foreground",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "caret",
    },
  },
);
