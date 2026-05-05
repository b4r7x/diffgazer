# Pager — Design

A previous/next navigation bar for sequential content (docs pages, multi-step flows). Two components: `Pager` (root nav) and `PagerLink` (directional link).

## API

```tsx
<Pager>
  <PagerLink direction="previous" href="/button">button</PagerLink>
  <PagerLink direction="next" href="/checkbox">checkbox</PagerLink>
</Pager>
```

`direction` is required. It controls alignment (`ml-auto` for next), arrow indicators, `aria-label`, and `rel="prev"/"next"`.

For framework links (Next.js, TanStack Router), use the render-prop:

```tsx
<PagerLink direction="next">
  {(props) => <Link {...props} to="/checkbox">checkbox</Link>}
</PagerLink>
```

## Why This Shape

The previous design had `PagerPrevious` and `PagerNext` as wrapper `<div>`s around `PagerLink`. They added nesting without behavior — just alignment classes. The `direction` prop on `PagerLink` already existed but was optional, so examples never used it, meaning arrows and ARIA labels were silently missing.

We removed the wrapper components and made `direction` required. PagerLink now owns everything: alignment, typography, arrows, ARIA, and `rel`. The API went from 4 components with 3 levels of nesting to 2 components with 2 levels.

shadcn/ui's `PaginationPrevious`/`PaginationNext` are separate components, but they're full links — not wrappers around another link component. Our approach is closer to that: PagerLink IS the link, and `direction` replaces the need for separate Previous/Next components.

## Accessibility

- `Pager` renders `<nav aria-label="Page navigation">`
- `PagerLink` adds `aria-label="Go to previous/next page"` based on direction
- `rel="prev"` / `rel="next"` for semantic link relations
- Arrow indicators (`←` / `→`) use `aria-hidden="true"`

## No State, No Context

This is a purely presentational compound component. No shared state, no context. The `Object.assign` dot notation (`Pager.Link`) is a DX convenience, not a structural requirement.

## Render-prop Contract

In render-prop mode, PagerLink passes `ref`, `className`, `rel`, `direction`, and any spread props. The consumer handles their own arrow rendering if desired — PagerLink only renders built-in arrows in the non-render-prop path. This is consistent with how other @diffgazer/ui triggers (PopoverTrigger, DialogTrigger) provide behavior props without modifying content.

## Limitations

- No disabled state — if there's no previous/next page, don't render the link
- No automatic page detection — the consumer provides `href` manually
- Arrows are plain text entities (`←`/`→`), not icons — matches the terminal aesthetic
