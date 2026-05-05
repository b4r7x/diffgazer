import type { HookDoc } from "@diffgazer/registry"

export const overflowItemsDoc: HookDoc = {
  description:
    "Measures how many items fit in a container and tracks the overflow count. Uses ResizeObserver for automatic recalculation. Single ref — no hidden measurement rows needed.",
  usage: {
    code: `const tags = ["React", "TypeScript", "Next.js", "Tailwind", "Vite"];

const { ref, visibleCount, overflowCount } =
  useOverflowItems({ itemCount: tags.length });

return (
  <div ref={ref} className="relative flex items-center gap-2 overflow-clip">
    {tags.map((tag, i) => (
      <div key={i} className={cn("shrink-0", i >= visibleCount && "invisible absolute pointer-events-none")}>
        <span>{tag}</span>
      </div>
    ))}
    <div className={cn("shrink-0", overflowCount === 0 && "invisible absolute pointer-events-none")}>
      <span>+{Math.max(overflowCount, 1)}</span>
    </div>
  </div>
);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "itemCount",
      type: "number",
      required: true,
      description:
        "Number of items to lay out. The hook uses this to drive measurement and re-observe on count changes.",
    },
    {
      name: "onVisibleCountChange",
      type: "(count: number) => void",
      required: false,
      description:
        "Called when the visible count changes. Useful for syncing external state without subscribing to the returned visibleCount in a separate effect.",
    },
  ],
  returns: {
    type: "{ ref: RefObject<HTMLDivElement | null>; visibleCount: number; overflowCount: number }",
    description:
      "A ref to attach to the container and reactive counts.",
    properties: [
      {
        name: "ref",
        type: "RefObject<HTMLDivElement | null>",
        required: true,
        description:
          "Attach to the container element. The hook reads child widths and observes size changes via ResizeObserver.",
      },
      {
        name: "visibleCount",
        type: "number",
        required: true,
        description:
          "Number of items that fit within the container width. Use this to hide overflow items via CSS (invisible absolute pointer-events-none).",
      },
      {
        name: "overflowCount",
        type: "number",
        required: true,
        description:
          "Number of items that do not fit (itemCount − visibleCount). Show the overflow indicator when this is greater than zero.",
      },
    ],
  },
  notes: [
    {
      title: "Container Contract",
      content:
        "The container's children must follow this order: [item0, item1, ..., itemN-1, indicator]. The first itemCount children are measured as items. The child at index itemCount is measured as the overflow indicator. The container must use CSS gap (e.g. Tailwind gap-*) — the hook reads it via getComputedStyle.",
    },
    {
      title: "Hiding Overflow Items",
      content:
        "Items where index >= visibleCount should get 'invisible absolute pointer-events-none' classes. This keeps them in the DOM for measurement while hiding them visually. The indicator should always be rendered (hidden when overflowCount === 0) so the hook can measure its width for space reservation.",
    },
    {
      title: "No Visual Flash",
      content:
        "The hook uses useLayoutEffect which fires before the browser paints. On the first render all items are visible in the flex flow, measured synchronously, then visibleCount is set — triggering a re-render before paint. The user never sees the intermediate state.",
    },
  ],
  examples: [
    { name: "overflow-items-basic", title: "Basic Overflow Badge" },
  ],
  tags: ["hook", "overflow", "resize-observer", "items"],
}
