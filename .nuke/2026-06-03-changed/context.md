# Audit Context — Diffgazer workspace, changed-vs-HEAD (2026-06-03)

This is the shared project snapshot for every audit agent working the `2026-06-03-changed` change set. Read it before forming findings.

---

## 1. Project snapshot

Diffgazer is a **pnpm + turbo monorepo** (`pnpm@10.28.2`, `type: module`, root pkg `@diffgazer/repo`) for an AI code-review tool. Workspaces: apps (`web`, `docs`, `landing`), libs (`core`, `keys`, `ui`, `registry`), and CLIs (`cli/add` = `@diffgazer/add`/`dgadd`, `cli/server` = `@diffgazer/server`, `cli/diffgazer` = public `diffgazer` binary). Build orchestration is **turbo `^2.9.14`** (`turbo.json` defines `build`, `type-check`, `test`, `test:types`, `check`, `prepare:generated`; per-app overrides for docs/landing/diffgazer builds). Biome `2.3.14` is the linter/formatter. Changesets handles releases.

**Stack versions** (from root + apps/docs + libs/keys/ui/registry package.json):

- **React** `^19.2.4` (root dev), `^19.2.0` (apps/docs + libs); `react-dom` matched. Keys/UI peer-require `react >=19.2.0`.
- **TypeScript** `^5.9.3` (libs/registry pins `^5.9.0`).
- **Test runner: Vitest `^4.1.0`** (apps/docs `^4.0.0`), with `@testing-library/react ^16.x`, `@testing-library/jest-dom ^6.9.1`, `@testing-library/user-event ^14.6.1`, `jsdom ^28.x` (apps/docs `^27.0.0`), axe via `@chialab/vitest-axe ^0.19.1` + `axe-core ^4.11.4`. `test:types` uses Vitest `--typecheck`.
- **apps/docs router/framework: TanStack** — `@tanstack/react-router ^1.138.0`, `@tanstack/react-start ^1.138.0`, `@tanstack/router-plugin ^1.138.0`, `@tanstack/router-generator ^1.167.9` (dev). Built on **Vite `^7.1.7`** (`@vitejs/plugin-react ^5.0.4`) with **Nitro `^3.0.260429-beta`** for prerender/output; `DOCS_PRERENDER=1 vite build` then `generate-sitemap.mjs`.
- **MDX tooling (apps/docs): fumadocs** — `fumadocs-core ^16.6.0`, `fumadocs-mdx ^14.2.7`; `@types/mdx ^2.0.13`, `@types/hast ^3.0.4`, `lowlight ^3.3.0` for code highlight, `figlet ^1.10.0` for ASCII logo.
- **Tailwind v4** — `tailwindcss ^4.3.0`, `@tailwindcss/vite ^4.3.0` (docs), `@tailwindcss/postcss ^4.3.0` (root); class tooling `class-variance-authority ^0.7.1` (**CVA**), `clsx ^2.1.1`, `tailwind-merge ^3.4.0`.
- **Zod `^4.3.6`** (apps/docs, libs/ui-adjacent, libs/registry).
- **libs/keys** `0.2.0` — tsc-built ESM, shadcn registry build, RSC/dist-ESM verifiers, multi-entry `exports`. **libs/ui** `0.2.0` — **tsup**-built, multi-component `exports`, optional peer deps (`@diffgazer/keys`, `figlet`, `lowlight`). **libs/registry** `0.1.0` (private) — shadcn registry/artifacts/docs-sync engine; deps `@clack/prompts`, `commander ^13`, `diff ^8`, `shiki ^3.22`, `picocolors`.
- Node `>=18` engines; `@types/node` pinned `^25.2.3` via root pnpm overrides (also overrides tailwindcss/postcss/vite/rollup/undici/ws/h3/etc.).

---

## 2. Conventions (INTENTIONAL design — NOT findings)

Distilled from `/Users/voitz/Projects/diffgazer-workspace/AGENTS.md`. Do not flag these as problems.

### Architecture boundaries (who owns what)
- **libs/keys** — reusable keyboard-first behavior: scopes, key registration, list navigation, focus zones, focus trap/restore, focusable/tabbable utils, scroll lock, small keyboard/focus helpers.
- **libs/ui** — reusable shadcn-like UI primitives + headless-ish hooks; must NOT import app code.
- **libs/registry** — registry contracts, shadcn/public registry validation+building, copy-bundle behavior, shared CLI workflow helpers.
- **libs/core** — private business logic shared between CLI and apps (Zod schemas/types, result/error types, format/string utils, review state machines, provider filtering, API client factories, env/port parsing, form/API/derived-state React hooks). Must NOT import from `apps/*` or `cli/*`.
- **cli/add** — user-facing add/remove/list/diff; must preserve copy, package, and direct-registry consumption paths.
- **cli/server** — embedded Hono backend, CLI-internal only, bundled into the binary.
- **cli/diffgazer** — public binary (web + TUI modes); thin, consumes core/keys/server.
- **apps/web** — product composition, copy, domain flows, data fetching. Extract from web only when generic.
- **apps/docs** — component/hook docs site; consumes core/keys/registry/ui; must consume `@diffgazer/ui`, never mirror it; extract only generic utilities, never docs-specific layout.
- **apps/landing** — marketing page; uses only `libs/ui` (theme CSS), no domain/docs logic.
- **Extraction rules**: extract primitives not product widgets; don't move app-specific widgets into libs/ui; extract only when it names a real concept and removes real duplication; keep app adapters thin (compose libs, don't reimplement roving focus / focus trap / field wiring / ARIA).

### Public UI API
- Value controls: `value` / `defaultValue` / `onChange(value)`.
- Native wrappers (Input, Textarea) keep native `onChange(event)`.
- Non-value state keeps semantic names: `open`/`onOpenChange`, `highlighted`/`onHighlightChange`, `selectedId`/`onSelect`, `onNavigate`.
- No deprecated aliases pre-first-release — rename + update all docs/examples/registry/bundles/consumers.
- **Boolean form controls (Checkbox/Radio)** are a documented exception: `checked`/`defaultChecked` (Checkbox accepts `"indeterminate"`), `onChange(checked: boolean)`, `value: string` (form-submission value). Group primitives (`CheckboxGroup`/`RadioGroup`) follow the standard value contract.
- **Form primitives**: `Input` bare native wrapper; `InputGroup` is only a decorated shell; `Field` owns label/id/required/disabled/invalid/description/error + ARIA. Don't turn decorated inputs into fields — compose `Field` with a control.

### React rules
- Derive during render; do NOT sync derived state with `useEffect`.
- Effects only for external-system sync / visibility / lifecycle; event handlers for user actions.
- `useRef` for mutable non-render values, stale-closure escape, DOM handles, previous imperative state.
- Don't use `useRef`+`useEffect` as hidden state-sync unless needed for stale async/event callbacks.
- No defensive `useMemo`/`useCallback`/`memo` — only measured perf, stable context values, real referential contracts.
- Hooks unconditional + before early returns. Store stable IDs not object copies. Prefer union state over multiple booleans. Avoid nested ternaries / long nullish chains in JSX — name the decision with a helper.

### Keys library rules
- Public keyboard callbacks describe semantic events (`onNavigate`, `onHighlightChange`, `onNavigationBoundaryReached`, `onZoneChange`).
- Focusable ≠ tabbable: programmatic focus may use `tabIndex={-1}`; Tab cycling uses tabbable only.
- Focus utils respect element `ownerDocument`, not global `document`.
- Scopes registered before hooks relying on active scope.
- Keyboard handlers ignore editable targets unless component owns the input.
- Navigation utils accept disabled/skipped items and preserve DOM/user-visible order.

### UI library rules
- Variant conventions per `libs/ui/docs/content/patterns/variants.mdx`: **CVA** for named variant dimensions; CSS files only for what Tailwind can't express; Records only for non-class values; plain Tailwind for single boolean conditionals.
- Build composable primitives; keep repeated app layouts in apps/web unless generic.
- Preserve accessible roles/labels/descriptions/invalid/disabled/keyboard/form semantics.
- `Field` owns ARIA wiring; controls merge external ARIA props, never replace.
- Compound components keep semantic public state names.
- Copy/shadcn consumers must get source that builds without package-only assumptions; package consumers get complete exports/declarations/CSS/peer-dep behavior.

### Registry / CLI / handoff
- Every public registry item installable through all paths: direct copy, `dgadd`, npm package (where applicable).
- Copy-mode UI registry source rewrites keys package imports to local copied paths.
- Public `libs/keys/public/r` TS must NOT emit relative `.js` import specifiers (breaks copy/shadcn consumers).
- Update source registry files, public registry JSON, docs, examples, generated bundles, AND app consumers together on public API change.
- `dgadd remove` respects ownership metadata; doesn't remove shared copied deps still needed by retained items.

### Testing philosophy
- Test user-visible behavior + accessibility contracts; prefer role/label/text queries.
- Don't assert Tailwind class names unless the class IS the public API.
- Keyboard/focus: test real focus movement, active descendant, boundary callbacks, editable-target behavior, disabled/skipped behavior.
- Registry/CLI: test copy/package/direct paths + removal ownership.
- React hooks: test behavior under rerender + cleanup, not internal refs.

### Generated-artifacts policy
- **MUST NOT be committed**: `libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated` (deterministic generated data). Run `pnpm run prepare:artifacts` to (re)materialize when missing/stale.
- **COMMITTED on purpose** (reviewable handoff contract — being committed is INTENTIONAL, not a finding): `libs/ui/public/r/*.json` and `libs/keys/public/r`. The change set touches `libs/ui/public/r/sidebar.json` and `libs/ui/public/r/sidebar-variants.json` — these are EXPECTED to change in lockstep with their registry source.

---

## 3. Verification gates (verbatim commands)

From AGENTS.md "Verification Gates". Use exactly these.

- Keys changes: focused keys tests + `pnpm --filter @diffgazer/keys type-check`
- UI primitive changes: focused UI tests + `pnpm --filter @diffgazer/ui type-check`
- Web adoption changes: focused web tests + `pnpm --filter @diffgazer/web type-check`
- Registry / CLI / docs / public-handoff changes: `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`
- Before declaring SOTA/ready:
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
  - `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
  - `pnpm run verify:monorepo`
  - (catalog smoke validates bundled offline snapshot every run; add `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` to also validate the live models.dev fetch, as CI does)
- Always before final response: `git diff --check`

Note: there is **no `apps/docs`-specific gate line** in AGENTS.md; docs changes fall under the "docs … public-handoff" gate (`prepare:artifacts` + `validate:artifacts:check`) and the SOTA turbo type-check/test gates. apps/docs `type-check` runs `tsc --noEmit && tsc --noEmit -p tsconfig.test.json` (its own package.json).

---

## 4. Audit scope — changed-vs-HEAD file list (82 files)

Scope = these files **as they exist in the working tree**. Auditors should run `git diff HEAD -- <file>` to see what changed, and treat untracked (`??`) files as **fully new code** to review top-to-bottom. Status legend: `M` modified, `D` deleted, `??` untracked/new. `+a/-r` = added/removed lines from `git diff HEAD --numstat` (untracked files have no numstat; review whole file).

Reconciliation: 82 porcelain entries = 68 `M` + 2 `D` + 12 `??`.

### apps/docs — components (UI/MDX surface)
- `M apps/docs/src/components/breadcrumbs.tsx` (+6/-3)
- `M apps/docs/src/components/docs-mdx/blocks/api-reference.tsx` (+1/-1)
- `M apps/docs/src/components/docs-mdx/blocks/index.ts` (+1/-0)
- `M apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx` (+1/-1)
- `M apps/docs/src/components/docs-mdx/feature-mdx-components.tsx` (+4/-0)
- `M apps/docs/src/components/docs-mdx/markdown-renderers.tsx` (+12/-9)
- `M apps/docs/src/components/docs-page.tsx` (+4/-26)
- `M apps/docs/src/components/source-viewer.tsx` (+1/-1)
- `M apps/docs/src/components/toc.tsx` (+88/-6)
- `?? apps/docs/src/components/docs-mdx/blocks/steps.tsx` (NEW — Steps/Step MDX block)
- `?? apps/docs/src/components/toc.test.tsx` (NEW test)

### apps/docs — lib + layouts + routes
- `M apps/docs/src/lib/docs-tree.ts` (+52/-11)
- `M apps/docs/src/lib/docs-tree.test.ts` (+191/-11)
- `M apps/docs/src/lib/example-frames.ts` (+1/-0)
- `M apps/docs/src/layouts/sidebar.tsx` (+104/-57)
- `M apps/docs/src/layouts/sidebar.test.ts` (+137/-1)
- `M apps/docs/src/routes/$lib/$.tsx` (+63/-2)
- `M apps/docs/src/routes/$lib/index.tsx` (+24/-154)

### apps/docs — content (.mdx) + scripts
- `M apps/docs/content/docs/app/getting-started/first-review.mdx` (+51/-9)
- `M apps/docs/content/docs/app/getting-started/index.mdx` (+3/-3)
- `M apps/docs/content/docs/app/getting-started/installation.mdx` (+23/-7)
- `M apps/docs/content/docs/app/getting-started/quickstart.mdx` (+43/-8)
- `M apps/docs/scripts/generate-sitemap.mjs` (+4/-12)
- `M apps/docs/scripts/generate-sitemap.test.ts` (+18/-15)
- `M apps/docs/scripts/sync-artifacts.mjs` (+5/-0)

### libs/keys — docs content (.mdx)
- `M libs/keys/docs/content/getting-started/index.mdx` (+24/-20)
- `M libs/keys/docs/content/getting-started/installation.mdx` (+66/-22)
- `M libs/keys/docs/content/guides/index.mdx` (+12/-6)
- `M libs/keys/docs/content/hooks/index.mdx` (+32/-11)
- `M libs/keys/docs/content/hooks/use-action-row-navigation.mdx` (+44/-102)
- `M libs/keys/docs/content/hooks/use-focus-restore.mdx` (+23/-0)
- `M libs/keys/docs/content/hooks/use-focus-trap.mdx` (+33/-0)
- `M libs/keys/docs/content/hooks/use-focus-zone.mdx` (+31/-0)
- `M libs/keys/docs/content/hooks/use-key.mdx` (+35/-0)
- `M libs/keys/docs/content/hooks/use-navigation.mdx` (+43/-0)
- `M libs/keys/docs/content/hooks/use-scope.mdx` (+24/-0)
- `M libs/keys/docs/content/hooks/use-scoped-navigation.mdx` (+36/-0)
- `M libs/keys/docs/content/hooks/use-scroll-lock.mdx` (+20/-1)
- `D libs/keys/docs/content/index.mdx` (-18) — deleted library-root index page

### libs/keys — hook-docs (.ts metadata)
- `M libs/keys/docs/hook-docs/use-focus-restore.ts` (+1/-0)
- `M libs/keys/docs/hook-docs/use-focus-trap.ts` (+1/-0)
- `M libs/keys/docs/hook-docs/use-focus-zone.ts` (+1/-0)
- `M libs/keys/docs/hook-docs/use-key.ts` (+1/-0)
- `M libs/keys/docs/hook-docs/use-scope.ts` (+4/-1)
- `M libs/keys/docs/hook-docs/use-scoped-navigation.ts` (+4/-0)
- `M libs/keys/docs/hook-docs/use-scroll-lock.ts` (+1/-0)
- `?? libs/keys/docs/hook-docs/use-action-row-navigation.ts` (NEW hook-doc metadata)

### libs/keys — registry examples (all NEW)
- `?? libs/keys/registry/examples/use-action-row-navigation/use-action-row-navigation-basic.tsx`
- `?? libs/keys/registry/examples/use-focus-restore/use-focus-restore-fallback.tsx`
- `?? libs/keys/registry/examples/use-focus-trap/use-focus-trap-initial-focus.tsx`
- `?? libs/keys/registry/examples/use-focus-zone/use-focus-zone-tab-cycle.tsx`
- `?? libs/keys/registry/examples/use-key/use-key-scoped.tsx`
- `?? libs/keys/registry/examples/use-scope/use-scope-nested.tsx`
- `?? libs/keys/registry/examples/use-scoped-navigation/use-scoped-navigation-focus-within.tsx`
- `?? libs/keys/registry/examples/use-scroll-lock/use-scroll-lock-target.tsx`

### libs/registry — docs sync engine
- `M libs/registry/src/docs/index.ts` (+2/-1)
- `M libs/registry/src/docs/sync-operations.ts` (+8/-2)
- `M libs/registry/src/docs/types.ts` (+1/-0)
- `M libs/registry/src/testing/docs-sync.test.ts` (+42/-0)

### libs/ui — sidebar surface (component + variants + registry JSON + example + test)
- `M libs/ui/registry/lib/sidebar-variants.ts` (+19/-2) — adds `terminal` variant
- `M libs/ui/registry/ui/sidebar/sidebar-item.tsx` (+10/-0) — `terminal` VariantGlyph
- `M libs/ui/registry/ui/sidebar/sidebar-section-title.tsx` (+1/-1) — heading class change
- `M libs/ui/registry/ui/sidebar/sidebar.test.tsx` (+14/-1)
- `M libs/ui/registry/component-docs/sidebar.ts` (+1/-1)
- `M libs/ui/registry/registry.json` (+1/-1) — sidebar-variants description
- `M libs/ui/public/r/sidebar.json` (+2/-2) — COMMITTED handoff contract
- `M libs/ui/public/r/sidebar-variants.json` (+2/-2) — COMMITTED handoff contract
- `?? libs/ui/registry/examples/sidebar/sidebar-variants.tsx` (NEW example)

### libs/ui — docs content (.mdx)
- `M libs/ui/docs/content/changelog.mdx` (+0/-1)
- `M libs/ui/docs/content/components/sidebar.mdx` (+6/-0)
- `M libs/ui/docs/content/contributing.mdx` (+0/-1)
- `M libs/ui/docs/content/getting-started/consumption-modes.mdx` (+6/-6)
- `M libs/ui/docs/content/getting-started/index.mdx` (+46/-5)
- `M libs/ui/docs/content/getting-started/installation.mdx` (+57/-29)
- `M libs/ui/docs/content/getting-started/tailwind-setup.mdx` (+21/-9)
- `M libs/ui/docs/content/getting-started/typescript.mdx` (+12/-7)
- `M libs/ui/docs/content/hooks/index.mdx` (+34/-13)
- `D libs/ui/docs/content/index.mdx` (-21) — deleted library-root index page
- `M libs/ui/docs/content/integrations/index.mdx` (+25/-8)
- `M libs/ui/docs/content/patterns/index.mdx` (+19/-6)
- `M libs/ui/docs/content/theme/index.mdx` (+17/-7)
- `M libs/ui/docs/content/utils/index.mdx` (+39/-5)

---

## 5. Change-set intent (high level — no code pasted)

This change set reworks the **docs-site navigation/landing experience** and adds a **`terminal` sidebar variant**, with matching docs-content rewrites. What it does:

- **Library root → first-page redirect.** `apps/docs/src/routes/$lib/index.tsx` is gutted: the old programmatic "library landing" page (MDX index OR a generated section listing) is replaced by a server-fn (`resolveFirstPageSplat`) that computes the first navigable page and `throw redirect(... replace:true)` to `/$lib/$`, or `throw notFound()`. Both library-root index MDX pages are deleted (`libs/keys/docs/content/index.mdx`, `libs/ui/docs/content/index.mdx`), and the sitemap script (`generate-sitemap.mjs`) stops emitting redirecting roots and relies on `walkMdx` to list canonical first pages.
- **docs-tree restructuring.** `docs-tree.ts` adds `flattenPageTree`, `firstNavigablePage`, and `findPageNeighbors`/`PageNeighbors` (prev/next in sidebar order), and rewrites `normalizeSeparators` to a pending-separator model (a separator labels the section that follows; drops separators labeling no content; in consecutive runs keeps only the last). `collectLandingSections` is no longer used by the index route.
- **Footer pager.** `$lib/$.tsx` now computes `pageUrl`, threads it through, and renders a `DocsFooterPager` using `Pager`/`Pager.Link` (prev/next, `EOF` when no previous) wired to `findPageNeighbors`.
- **TOC rework.** `toc.tsx` now seeds entries from the compile-time fumadocs TOC for SSR, then a `useEffect`+`MutationObserver` re-derives entries from the rendered DOM (`#main-content` `h2[id]/h3[id]`) so runtime-injected headings (`<Step>` titles, API reference blocks) appear; a `(depth,id)` signature gates redundant updates. New `toc.test.tsx`.
- **Sidebar rework (apps/docs).** `sidebar.tsx` switches `Sidebar variant` from `bar` to `terminal`, changes `formatSectionLabel` (now `/section_name`), adds `findSectionIndexUrl` + `sidebarItemLabel` (relabels a section's index item to "Overview" when its title echoes the section header), exports `groupBySection`, and skips empty sections. Big new test coverage in `sidebar.test.ts`.
- **`terminal` sidebar variant (libs/ui).** New `terminal` entry in `SidebarVariant` union + `sidebarItemVariants` CVA (1px left rail, no bg fill), a `terminal` `VariantGlyph` (`>` when active), a section-title class change (uppercase/tracking-wider), new example `sidebar-variants.tsx`, plus the lockstep updates to `sidebar.json` / `sidebar-variants.json` public registry, `registry.json` description, and component-docs. Also tweaks the existing `bar` active-state background.
- **Steps MDX block + docs-page simplification.** New `Steps`/`Step` block (numbered sections, slugified `h2` ids that the new TOC picks up) registered into `feature-mdx-components`. `docs-page.tsx` drops the `variant`/`bordered` `DocsPageHeader` props (single compact style).
- **Hook docs/examples expansion (libs/keys).** Per-hook `.mdx` pages and `hook-docs/*.ts` metadata gain new worked examples; `hooks/index.mdx` reorganized into standalone vs provider-backed tables; 8 new registry example components added (one per hook), including a new `use-action-row-navigation` hook-doc.
- **registry docs-sync `extraRootPages`.** `libs/registry/src/docs` adds an optional `extraRootPages: string[]` option threaded `SyncDocsOptions → runDocsSyncPass → writeRootMeta` to append extra entries to root `meta.json` `pages`; covered by new assertions in `docs-sync.test.ts`. (Mechanism for re-adding root pages now that per-library index pages are deleted.)

---

## 6. Audit ground rules

- **Read-only** on the codebase. The ONLY writable file is this one (`/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/context.md`) and other `.md` files inside `.nuke/`. Never run `git add/commit/stash`; never edit source/config/.gitignore.
- A finding **needs `file:line` references and an end-to-end trace** (what breaks, where, under what input, and the downstream consequence).
- Findings must be **anchored in the change set**: changed lines, changed/new files in section 4, or breakage directly caused/exposed elsewhere by these changes (e.g. a deleted index page that a sitemap/link still references; a new TOC effect that contradicts the React rules; a registry source/JSON drift).
- **Conventions in section 2 are intentional design, not findings.** In particular: committed `libs/ui/public/r/*.json` and `libs/keys/public/r` are the reviewable handoff contract; the Checkbox/Radio boolean-prop exception; CVA-for-variants; semantic non-value callback names.
- When in doubt about whether something is generated vs hand-written: `*/docs/generated` and `cli/add/src/generated` are generated (and must not be committed); `public/r` is hand-reviewable committed contract.
