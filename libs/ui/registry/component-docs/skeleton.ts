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
      title: "Loading Announcements",
      content:
        "Skeleton itself is decorative and aria-hidden. Put aria-busy on the region being loaded, or pair the loading state with a nearby status/live region when users need progress announced.",
    },
  ],
  usage: { example: "skeleton-default" },
  examples: [{ name: "skeleton-default", title: "Default" }],
  noProps: true,
};
