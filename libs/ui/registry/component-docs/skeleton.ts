import type { ComponentDoc } from "./types";

export const skeletonDoc: ComponentDoc = {
  description:
    "Loading placeholder with a subtle pulse animation. Purely decorative (aria-hidden). Control dimensions via className.",
  anatomy: [
    {
      name: "Skeleton",
      indent: 0,
      note: "Decorative placeholder div. Use className to set width and height.",
    },
  ],
  notes: [
    {
      title: "Dimensions",
      content:
        "Skeleton has no intrinsic size. Use Tailwind classes like w-32 h-4 or w-full h-6 to define the placeholder shape.",
    },
    {
      title: "Reduced Motion",
      content:
        "The pulse animation uses motion-safe:animate-pulse, so it is automatically disabled when the user prefers reduced motion.",
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
  noProps: true,
};
