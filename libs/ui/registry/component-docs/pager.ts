import type { ComponentDoc } from "./types"

export const pagerDoc: ComponentDoc = {
  description:
    "Previous/next page navigation bar with arrow indicators.",
  notes: [
    {
      title: "Link Navigation",
      content: "Use PagerLink with a direction prop for standard anchor links. For framework-specific link components (TanStack Link, Next.js Link), use the render-prop pattern: <PagerLink direction=\"next\">{(props) => <Link {...props} to=\"...\">text</Link>}</PagerLink>.",
    },
  ],
  anatomy: [
    { name: "Pager", indent: 0, note: "Root nav element with top border and flex layout" },
    { name: "PagerLink", indent: 1, note: "direction=\"previous\" — left-aligned with ← arrow" },
    { name: "PagerLink", indent: 1, note: "direction=\"next\" — right-aligned with → arrow" },
  ],
  usage: { example: "pager-default" },
  examples: [
    { name: "pager-default", title: "Default" },
    { name: "pager-single", title: "Single" },
  ],
  keyboard: null,
}
