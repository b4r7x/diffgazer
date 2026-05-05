import type { ComponentDoc } from "./types"

export const composeRefsDoc: ComponentDoc = {
  description:
    "Utility to compose multiple React refs into a single ref callback. Use when a component needs an internal ref while also forwarding an external ref prop (React 19 ref-as-prop pattern).",
  notes: [
    {
      title: "When to Use",
      content:
        "Use composeRefs whenever a component needs to maintain its own ref (e.g., for measuring or focus management) while also accepting a forwarded ref from the parent. This is the standard pattern for React 19's ref-as-prop.",
    },
    {
      title: "Ref Types",
      content:
        "Handles RefCallback, RefObject (MutableRefObject), null, and undefined refs safely. Each ref in the array is called or assigned when the element mounts/unmounts.",
    },
    {
      title: "Used By",
      content:
        "Core utility used by 10 components and 1 hook: checkbox, radio, overflow, dialog, tabs, toggle-group, command-palette, select, sidebar, popover, and listbox (hook).",
    },
  ],
  usage: {
    code: `function MyList({ ref, ...props }: { ref?: Ref<HTMLDivElement> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return <div ref={composeRefs(containerRef, ref)} {...props} />;
}`,
    lang: "tsx",
  },
  tags: ["lib", "ref", "composition", "react-19"],
}
