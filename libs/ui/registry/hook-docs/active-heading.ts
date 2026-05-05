import type { HookDoc } from "@diffgazer/registry"

export const activeHeadingDoc: HookDoc = {
  description:
    "Configurable active heading detection for table of contents. Tracks which heading is currently active based on scroll position, with top-line or viewport-center activation modes and a programmatic scrollTo helper.",
  usage: {
    code: `const { activeId, scrollTo } = useActiveHeading({
  ids: ["intro", "features", "api"],
  activation: "top-line",
  topOffset: 96,
});`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "ids",
      type: "string[]",
      required: true,
      description:
        "Ordered list of heading element IDs to observe. Elements are resolved via document.getElementById.",
    },
    {
      name: "containerId",
      type: "string",
      required: false,
      description:
        "ID of a scrollable container element. When omitted, the window is used as the scroll target.",
    },
    {
      name: "activation",
      type: '"top-line" | "viewport-center" | number',
      required: false,
      defaultValue: '"top-line"',
      description:
        'How headings activate. "top-line" activates when crossing topOffset from container top. "viewport-center" activates at the vertical center. A number (0–1) sets a custom viewport fraction.',
    },
    {
      name: "topOffset",
      type: "number",
      required: false,
      defaultValue: "96",
      description:
        'Pixel offset from the container top used by the "top-line" activation mode.',
    },
    {
      name: "scrollOffset",
      type: "number",
      required: false,
      defaultValue: "topOffset",
      description:
        "Pixel offset applied when scrollTo programmatically scrolls to a heading. Defaults to topOffset.",
    },
    {
      name: "bottomMargin",
      type: "number",
      required: false,
      defaultValue: "0",
      description:
        "Fraction of viewport height used as bottom margin for bottomLock detection.",
    },
    {
      name: "threshold",
      type: "number",
      required: false,
      defaultValue: "0",
      description:
        "Fraction (0–1) of the heading element's height that must cross the activation line before it becomes active. 0 = top edge, 1 = bottom edge.",
    },
    {
      name: "bottomLock",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "When true, the last heading is always activated when the user scrolls to the bottom of the container.",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "Set to false to disable scroll observation. When disabled, activeId is set to null.",
    },
    {
      name: "settleDelay",
      type: "number",
      required: false,
      defaultValue: "150",
      description:
        "Milliseconds to wait after a programmatic scrollTo before resuming scroll tracking. Prevents flickering during smooth scroll animation.",
    },
    {
      name: "observe",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "Watch for DOM changes via MutationObserver. Disable for static content.",
    },
  ],
  returns: {
    type: "{ activeId: string | null; scrollTo: (id: string) => void }",
    description:
      "Object with the currently active heading ID and a function to programmatically scroll to a heading.",
    properties: [
      {
        name: "activeId",
        type: "string | null",
        required: true,
        description:
          "ID of the currently active heading, or null when disabled or no headings are found.",
      },
      {
        name: "scrollTo",
        type: "(id: string) => void",
        required: true,
        description:
          "Scrolls to the heading with the given ID. Immediately sets activeId to prevent flickering during the scroll animation.",
      },
    ],
  },
  notes: [
    {
      title: "Activation Modes",
      content:
        'Use "top-line" (default) for fixed-header layouts where headings activate near the top. Use "viewport-center" for centered reading experiences. Pass a number (0–1) for a custom viewport fraction.',
    },
    {
      title: "Scroll Settling",
      content:
        "When scrollTo is called, scroll-listener updates are suppressed until the animation settles (150ms after the last scroll event). This prevents the active heading from flickering through intermediate headings during programmatic scrolls.",
    },
    {
      title: "Bottom Lock",
      content:
        "When bottomLock is true (default), the last heading is always highlighted when scrolled to the bottom. This ensures the last section is reachable even if it's shorter than the viewport.",
    },
  ],
  examples: [
    { name: "active-heading-basic", title: "Basic Table of Contents" },
    { name: "active-heading-modes", title: "Activation Modes" },
  ],
  tags: ["hook", "scroll", "toc", "heading"],
}
