# Quality Bar — diffgazer-workspace (2026-06-03)

Factual SOTA reference for the changed-files audit. Change set touches the `apps/docs` site
(sidebar, TOC scroll-spy, breadcrumbs, MDX renderers, source viewer, api-reference block,
docs-tree, sitemap) plus `libs/keys` hook docs/MDX. Sources: react.dev, tanstack.com,
tailwindcss.com, vitest.dev, typescriptlang.org, fumadocs.dev, CSS-Tricks/Sara Soueidan a11y.

## Stack versions

- React `^19.2.4` / ReactDOM `^19.2.4` (docs pins `^19.2.0`); peer `react >=19.2.0`.
- TypeScript `^5.9.3` (registry `^5.9.0`). Node types pinned `@types/node ^25.2.3`.
- Router: `@tanstack/react-router ^1.138.0` + `@tanstack/react-start ^1.138.0` +
  `@tanstack/router-plugin ^1.138.0` (`@tanstack/router-generator ^1.167.9` dev). NOT plain React Router.
- SSR/prerender host: `nitro ^3.0.260429-beta` via `tanstackStart({ prerender })` + `nitro()` vite plugins.
- MDX: `fumadocs-mdx ^14.2.7` + `fumadocs-core ^16.6.0`. Syntax highlighting = fumadocs `rehypeCode`
  (wrapper of `@shikijs/rehype`) configured in `source.config.ts`; standalone `shiki ^3.22.0` in libs/registry;
  `lowlight ^3.3.0` for client code-block highlighting. `@types/mdx ^2.0.13`, `@types/hast ^3.0.4`.
- Tailwind `^4.3.0` via `@tailwindcss/vite ^4.3.0` (root override pins `tailwindcss ^4.3.0`); `@tailwindcss/postcss` present.
  `tailwind-merge ^3.4.0`, `clsx ^2.1.1`, `class-variance-authority ^0.7.1`.
- Vite `^7.1.7` (root override `^7.3.2`), rollup override `^4.59.0`, `@vitejs/plugin-react ^5.0.4`.
- Vitest `^4.1.0` (docs `^4.0.0`), `@vitest/coverage-v8 ^4.1.0`, jsdom `^28.1.0` (docs `^27`),
  `@testing-library/react ^16.3.2`, `@testing-library/jest-dom ^6.9.1`, `@chialab/vitest-axe`/`axe-core ^4.11.4`.
- E2E/perf: `@playwright/test ^1.60.0`, `@axe-core/playwright ^4.11.2`, `@lhci/cli ^0.15.1` (Lighthouse CI).
- Zod `^4.3.6` (v4). Biome `2.3.14` for lint/format. pnpm `10.28.2`, turbo `^2.9.14`.
- Browserslist (libs/ui): Chrome >=111, Safari >=16.4, Firefox >=128, Edge >=111.

## Quality bar (what SOTA means for this repo today)

### React 19.2
- Pass `ref` as a normal prop; `forwardRef` is deprecated. Flag any new `forwardRef`. Type with `ref?: Ref<T>` in props.
- Do NOT sync derived state with `useEffect`. Compute during render. TOC active-id derivation, breadcrumb
  segment lists, and section grouping are derive-during-render candidates — only the heading-observer
  subscription legitimately needs an effect.
- `useEffect` is valid ONLY for external-system sync with cleanup: MutationObserver/IntersectionObserver/scroll
  listeners, history side effects. Each observer must `disconnect()`/`removeEventListener` in cleanup and
  re-subscribe when deps (ids, containerId, options) change. The current `toc.tsx` MutationObserver +
  `useActiveHeading` pattern is correct; reject any observer created without cleanup or with stale option closures.
- Subscriptions to a true external store (scroll position) are better modeled with `useSyncExternalStore` to avoid
  tearing under concurrent rendering; an effect+setState is acceptable but must guard against redundant renders
  (the entries-signature dedupe in toc.tsx is the right instinct).
- No defensive `useMemo`/`useCallback`/`memo` without a measured reason or referential contract.
- Hooks unconditional, before early returns (toc.tsx returns `null` AFTER all hooks — correct).
- Prefer stable IDs over storing object copies; union status over boolean soup.

### TanStack Router/Start 1.138 + Nitro prerender
- File-based routing with `autoCodeSplitting`: keep `loader`/`beforeLoad`/`validateSearch` in the main route file
  (needed at match/preload time). `FileRouteLoader` (separate loader file) is deprecated — flag it.
- Components are auto-split; do not hand-split loaders into chunks (extra server round-trip) unless justified via
  `codeSplitGroupings`/`splitBehavior`. Keep critical data in the initial bundle.
- Use `<Link>` for active state; rely on router active matching, not manual `pathname.startsWith`. `useLocation`
  in sidebar/breadcrumbs is fine for label derivation but active styling should prefer `<Link>`/`isActive`.
- Prerendered docs pages (`getPreRenderPages`, sitemap) must stay in sync: every route enumerated for prerender
  must resolve, and the sitemap generator must match the prerender page set (both are in this change set — verify parity).

### Tailwind CSS 4
- CSS-first config via `@theme` in CSS; no JS `tailwind.config`. Tokens (color/spacing/font/breakpoint) live in
  `@theme`; promote repeated bracket values to tokens. OKLCH colors with auto sRGB fallback.
- Single `@import "tailwindcss"`; native container queries (`@container`, `@sm`/`@lg`) without plugin; custom
  utilities via `@utility` (auto variant generation). Per repo rule: CVA for named variant dimensions, CSS files
  only for what Tailwind can't express, Records for non-class values, plain Tailwind for single boolean conditionals.
- Do NOT assert Tailwind class names in tests unless the class is the public API.

### TypeScript 5.9
- `strict: true` baseline. Expect/keep `verbatimModuleSyntax` (explicit `import type`) and
  `noUncheckedIndexedAccess` (array/index access yields `T | undefined` — handle it, don't `!` past it).
- type-check must cover source + tests + `scripts/` (node-typed `scripts/tsconfig.json`); never re-add a
  `*.test.*` exclude or leave `scripts/` uncovered (per AGENTS Verification Gates).

### MDX / fumadocs 16
- Highlighting via `rehypeCode` (Shiki) configured in `source.config.ts` — light/dark themes, `defaultColor:false`,
  transformers preserve `data-language`. Don't bypass with ad-hoc highlighters in renderers.
- Fewer client components / less JS is the fumadocs 16 goal; MDX renderers should stay mostly server/static and
  hydrate only interactive blocks (source-viewer, api-reference, copy buttons).
- Frontmatter validated by zod schema (`component`/`hook` optional) — keep MDX renderers driven by typed frontmatter.

### Docs navigation a11y (sidebar / TOC scroll-spy / breadcrumbs / headings)
- TOC must be a `<nav>` landmark with an accessible name (e.g. `aria-label="On this page"`); active link needs
  `aria-current` (toc.tsx uses `aria-current="location"` — acceptable; `"true"`/`"page"` also valid). Visual-only
  active styling without `aria-current` fails SR users.
- Scroll-spy: IntersectionObserver (or a measured scroll handler) is preferred over raw scroll listeners; this repo
  uses a scroll-position `useActiveHeading` with `top-line` activation + MutationObserver for runtime headings
  (`<Step>`, api-reference) — acceptable. Reject scroll handlers that force layout each frame without throttle.
- Breadcrumbs: ordered `<nav aria-label="Breadcrumb">` + `<ol>`; current page marked `aria-current="page"`;
  non-linkable segments render as text (the `SECTIONS_WITH_INDEX` allowlist guards against 404 links — keep its
  test in sync with the `content/docs` tree).
- Heading hierarchy: no skipped levels (h2 -> h3, not h2 -> h4); every in-content heading targeted by TOC needs a
  stable `id`. Skip link to main content; sticky TOC must remain keyboard-reachable and not trap scroll.
- Sidebar: roving/`<Link>` navigation, `aria-current` on the active page; pending-route affordance must not be
  SR-noisy. Keyboard nav (keys lib) tested for real focus movement, active descendant, boundary callbacks, and
  editable-target skipping.

### Testing (Vitest 4)
- Test user-visible behavior + a11y contracts; query by role/label/text, not implementation. v8 coverage (AST-remapped,
  Istanbul-accurate). Browser Mode is now stable but jsdom remains fine for these DOM tests.
- For scroll-spy/observer hooks, test active-id transitions, cleanup on unmount, and re-subscription on id changes —
  not internal refs. Use `vitest-axe`/`@axe-core/playwright` for a11y assertions on nav/TOC/breadcrumbs.
- Keep prerender/sitemap parity and breadcrumb-allowlist tests as behavior tests (both files are in the change set).

## Amplifier skills available locally (loadable via the Skill tool)

thermo-nuclear-review, thermo-nuclear-code-quality-review, security-review,
top-100-web-vulnerabilities-reference, code-audit, code-quality, clean-code, anti-slop,
reusability-audit, improve-codebase-architecture, typescript-best-practices,
test-behavior-not-implementation, web-performance-optimization, react-senior-guide,
react-useeffect, react-useref, react-anti-patterns, react-design-patterns,
tanstack-start-best-practices, tailwind-best-practices, sota.
