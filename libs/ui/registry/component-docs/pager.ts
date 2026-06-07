import type { ComponentDoc } from "./types";

export const pagerDoc: ComponentDoc = {
  description: "Previous/next page navigation bar with arrow indicators.",
  notes: [
    {
      title: "Link Navigation",
      content:
        'Use PagerLink with a direction prop for standard anchor links. For framework-specific link components (TanStack Link, Next.js Link), use the render-prop pattern: <PagerLink direction="next">{(props) => <Link {...props} to="...">text</Link>}</PagerLink>.',
    },
  ],
  anatomy: [
    { name: "Pager", indent: 0, note: "Root nav element with top border and flex layout" },
    { name: "PagerLink", indent: 1, note: 'direction="previous" — left-aligned with ← arrow' },
    { name: "PagerLink", indent: 1, note: 'direction="next" — right-aligned with → arrow' },
  ],
  usage: { example: "pager-default" },
  examples: [
    { name: "pager-default", title: "Default" },
    { name: "pager-single", title: "Single" },
  ],
  keyboard: null,
  props: {
    Pager: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: 'PagerLink children. Rendered inside <nav aria-label="Page navigation">.',
      },
    },
    PagerLink: {
      direction: {
        type: '"previous" | "next"',
        required: true,
        defaultValue: null,
        description: "Selects the arrow glyph, rel attribute (prev/next), and alignment.",
      },
      href: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Anchor href. Omit when rendering a framework Link via the render-prop form.",
      },
      children: {
        type: "ReactNode | (props: PagerLinkRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description:
          "Link label, or a render function that receives ref, className, rel, direction, and remaining anchor props for framework Link integration.",
      },
    },
  },
};
