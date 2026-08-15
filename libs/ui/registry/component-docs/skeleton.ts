import type { ComponentDoc } from "./types.js";

export const skeletonDoc: ComponentDoc = {
  description:
    "Loading placeholder drawn as a strip of character cells with a left-to-right scan sweep. Purely decorative (aria-hidden). Size it in cells with chars, or set dimensions via className.",
  anatomy: [
    {
      name: "Skeleton",
      indent: 0,
      note: "Decorative character-cell placeholder. Use chars or className to set width and height.",
    },
  ],
  notes: [
    {
      title: "Dimensions",
      content:
        "Skeleton has no intrinsic width. Pass chars to reserve the width of the value it stands in for (a 7-cell sha, a 40-cell path), or use Tailwind classes like w-32 h-4 for a proportional block. Height comes from className; the strip has a 12px floor so the cells stay legible.",
    },
    {
      title: "Cell Grid",
      content:
        "The strip is subdivided into --skeleton-cell wide cells by a mask, so it speaks the same character-cell alphabet as Spinner and BlockBar. The mask cuts the element's own background, which means a consumer background class still tiles into cells rather than filling the strip solid.",
    },
    {
      title: "Reduced Motion",
      content:
        "The scan sweep is dropped entirely under prefers-reduced-motion: reduce. The static cell grid still reads as pending.",
    },
    {
      title: "Composition",
      content:
        "Skeleton is one rectangle by design. Build a placeholder by composing several of them in the shape of the content being loaded — a square for an avatar, short bars for metadata, full-width bars for text — and keep the rhythm of the real layout so the swap to content does not jump.",
    },
    {
      title: "Loading Announcements",
      content:
        "Skeleton itself is decorative and aria-hidden. Put aria-busy on the region being loaded, or pair the loading state with a nearby status/live region when users need progress announced.",
    },
  ],
  usage: { example: "skeleton-default" },
  examples: [
    { name: "skeleton-default", title: "Default" },
    { name: "skeleton-composed", title: "Composed placeholder" },
  ],
  dataAttributes: [
    {
      attribute: "data-chars",
      appliesTo: "Skeleton",
      values: "cell count, present only when chars is set",
      description: "Enables the cell-count width rule that reads --skeleton-chars.",
    },
  ],
  cssVariables: [
    {
      name: "--skeleton-cell",
      description: "Width of one placeholder cell, including its gap.",
      defaultValue: "8px",
    },
    {
      name: "--skeleton-gap",
      description: "Width of the knocked-out gap between two cells.",
      defaultValue: "1px",
    },
    {
      name: "--skeleton-cell-fill",
      description:
        "Fill color of the cells. Deliberately below text contrast — the strip is decorative.",
    },
  ],
  props: {
    Skeleton: {
      chars: {
        type: "number",
        required: false,
        defaultValue: null,
        description:
          "Width of the placeholder in character cells, so it reserves the width of the value it stands in for. Surfaces as data-chars plus the --skeleton-chars custom property; omit and set width via className instead.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Class names for the placeholder height and any width not set by chars.",
      },
    },
  },
};
