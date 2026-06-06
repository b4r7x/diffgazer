# Verification: File naming + barrel files in elite TS repos

Date: 2026-06-04. Method: GitHub Git Trees API (`/git/trees/<branch>?recursive=1`, none truncated) for
file listing; WebFetch/WebSearch of primary sources for barrel citations.

Counting rules: scope = real product/library source only (`.ts/.tsx/.js/.jsx/.mts/.cts`), excluding
`*.test.* / *.spec.* / *.bench.*`, `__tests__`, `tests/`, `fixtures/`, `examples/`, `*.d.ts`.
"2+ hyphen" / "1 hyphen" counts the hyphens in the **basename stem** (extension stripped). For monorepos,
only files under a `/src/` segment are counted (drops build/config noise).

---

## TASK 1 — File-naming evidence

### vercel/vercel — `packages/cli/src` (default branch `main`)

- Total source files: **949**
- 2+ hyphen basenames: **173 (18.2%)**; exactly 1 hyphen: 222 (23.4%); any hyphen (kebab-ish): **395 (41.6%)**
- Dominant convention: **kebab-case** (395 kebab) vs single-lowercase-word (554). No camelCase, no PascalCase.
  So: every file with >1 word is kebab. Multi-hyphen is freely used.
- Real 2+ hyphen examples:
  - `packages/cli/src/commands/ai-gateway/api-keys-create.ts`
  - `packages/cli/src/commands/api/operation-request-builder.ts`
  - `packages/cli/src/commands/curl/trace-session-token-provider.ts`
  - `packages/cli/src/commands/edge-config/resolve-edge-config-id.ts`
  - `packages/cli/src/commands/flags/sdk-keys-add.ts`
  - `packages/cli/src/commands/integration/add-auto-provision.ts`
  - `packages/cli/src/commands/microfrontends/remove-from-group.ts`
  - `packages/cli/src/commands/rolling-release/complete-rolling-release.ts`

### TanStack/query — `packages/*/src` (default branch `main`)

- Total source files: **288**
- 2+ hyphen: **33 (11.5%)**; 1 hyphen: 31 (10.8%); any hyphen: **64 (22.2%)**
- Dominant convention: **camelCase (101)** + single-word lowercase (80); kebab is third (64), Pascal (30).
- CRITICAL nuance — kebab is NOT in the core React Query library. Per-package kebab(1+ hyphen) share:
  - `query-core/src`: **0 kebab** of 24 — all camel/lowercase (`infiniteQueryObserver.ts`, `queryClient.ts`, `queryCache.ts`, `notifyManager.ts`).
  - `react-query/src`: **0 kebab** of 23 — camel/Pascal (`useBaseQuery.ts`, `useInfiniteQuery.ts`, `useMutationState.ts`, `QueryClientProvider.tsx`).
  - `vue-query`, `solid-query`, `preact-query`, `lit-query`: 0 kebab — camelCase.
  - Kebab is concentrated in tooling/adapters: `query-codemods` (30), `eslint-plugin-query` (16), `angular-query-experimental` (17), `angular` (17).
- Real 2+ hyphen examples (note: all from adapters/eslint, none from core):
  - `packages/angular-query-experimental/src/create-base-query.ts`
  - `packages/angular-query-experimental/src/inject-infinite-query.ts`
  - `packages/angular-query-experimental/src/infinite-query-options.ts`
  - `packages/eslint-plugin-query/src/rules/infinite-query-property-order/infinite-query-property-order.rule.ts`
  - `packages/eslint-plugin-query/src/rules/no-rest-destructuring/no-rest-destructuring.rule.ts`
  - `packages/eslint-plugin-query/src/rules/no-unstable-deps/no-unstable-deps.rule.ts`

### TanStack/router — `packages/*/src` (default branch `main`)

- Total source files: **605**
- 2+ hyphen: **45 (7.4%)**; 1 hyphen: 63 (10.4%); any hyphen: **108 (17.9%)**
- Dominant convention: single-word lowercase (244) + **camelCase (158)**; kebab third (108), Pascal (79).
- Same nuance: core is camel/Pascal, kebab lives in eslint/start-plugin/adapters.
  - `router-core/src`: 31 lowercase, 16 camel, **10 kebab**, 4 Pascal. camel/lowercase dominant
    (`searchMiddleware.ts`, `routeInfo.ts`, `structuralSharing.ts`, `useNavigate.ts`), with a few kebab
    (`lru-cache.ts`, `not-found.ts`, `scroll-restoration-inline.ts`, `new-process-route-tree.ts`).
  - `react-router/src`: Pascal components + camel hooks (`useBlocker.tsx`, `RouterProvider.tsx`), kebab rare.
  - Kebab heaviest in `react-start`, `solid-start`, `vue-start`, `eslint-plugin-start`, `router-plugin`.
- Real 2+ hyphen examples:
  - `packages/router-core/src/new-process-route-tree.ts`
  - `packages/router-core/src/scroll-restoration-inline.ts`
  - `packages/router-core/src/ssr/ssr-match-id.ts`
  - `packages/eslint-plugin-router/src/rules/route-param-names/route-param-names.rule.ts`
  - `packages/eslint-plugin-start/src/rules/no-async-client-component/no-async-client-component.rule.ts`
  - `packages/router-generator/src/validate-route-params.ts`

### shadcn-ui/ui (default branch `main`)

Structure changed: the docs site is now `apps/v4` (no `apps/www`); the CLI is `packages/shadcn/src`.
Two meaningful scopes:

App product source — `apps/v4/{app,components,hooks,lib}` (excludes `registry`, `examples`, `content`, `styles`, `public` demo blocks):
- Total: **310**; 2+ hyphen: **47 (15.2%)**; 1 hyphen: 171 (55.2%); any hyphen: **218 (70.3%)**
- Dominant convention: **kebab-case (218)** vs single-word lowercase (92). No camel, no Pascal. Strictly kebab.
- Real 2+ hyphen examples:
  - `apps/v4/app/(app)/create/components/base-color-picker.tsx`
  - `apps/v4/app/(app)/create/components/design-system-provider.tsx`
  - `apps/v4/app/(app)/create/hooks/use-action-menu.ts`
  - `apps/v4/app/(app)/create/lib/parse-preset-input.ts`
  - `apps/v4/app/(app)/examples/authentication/components/user-auth-form.tsx`
  - `apps/v4/app/(app)/examples/dashboard/components/chart-area-interactive.tsx`

CLI source — `packages/shadcn/src`:
- Total: **127**; 2+ hyphen: **17 (13.4%)**; 1 hyphen: 39 (30.7%); any hyphen: **56 (44.1%)**
- Dominant convention: **kebab-case (56)** + single-word lowercase (71). Strictly kebab for multi-word.
- Real 2+ hyphen examples:
  - `packages/shadcn/src/utils/get-package-manager.ts`
  - `packages/shadcn/src/utils/get-project-info.ts`
  - `packages/shadcn/src/utils/transformers/transform-css-vars.ts`
  - `packages/shadcn/src/utils/updaters/update-tailwind-config.ts`
  - `packages/shadcn/src/utils/dry-run-formatter.ts`

### vitest-dev/vitest — `packages/*/src` (default branch `main`)

- Total source files: **472**
- 2+ hyphen: **6 (1.3%)**; 1 hyphen: 50 (10.6%); any hyphen: **56 (11.9%)**
- Dominant convention: single-word lowercase (308) + **camelCase (99)**; kebab third (56). Pascal rare (8).
  Multi-hyphen names are genuinely rare here.
- Real 2+ hyphen examples (all 6 that exist):
  - `packages/expect/src/chai-style-assertions.ts`
  - `packages/expect/src/jest-asymmetric-matchers.ts`
  - `packages/expect/src/jest-matcher-utils.ts`
  - `packages/vitest/src/runtime/detect-async-leaks.ts`
  - `packages/vitest/src/types/happy-dom-options.ts`
  - `packages/browser/src/client/public/esm-client-injector.js`

### alan2207/bulletproof-react — `apps/react-vite/src` (default branch `master`)

- Total source files: **115**
- 2+ hyphen: **0 (0.0%)**; 1 hyphen: 42 (36.5%); any hyphen: **42 (36.5%)**
- Dominant convention: **kebab-case (42)** + single-word lowercase (64). Strictly kebab — but capped at ONE hyphen.
- There are ZERO files with 2+ hyphens. Every multi-word name is exactly two words:
  `api-client.ts`, `auth-layout.tsx`, `comments-list.tsx`, `confirmation-dialog.tsx`, `content-layout.tsx`,
  `create-comment.ts`, `dashboard-layout.tsx`, `delete-discussion.tsx`, `discussion-view.tsx`,
  `field-wrapper.tsx`, `form-drawer.tsx`, `get-comments.ts`, `get-discussions.ts`, `login-form.tsx`, `md-preview.tsx`.
- So the reference repo itself does NOT demonstrate "multi-hyphen kebab freely"; it shows disciplined,
  short, mostly two-word kebab names.

---

## TASK 2 — Barrel-file evidence

### TkDodo — "Please Stop Using Barrel Files"

- Title: **"Please Stop Using Barrel Files"**
- URL: https://tkdodo.eu/blog/please-stop-using-barrel-files
- Date: Jul 26, 2024
- Measured numbers (verbatim):
  - "In our NextJs project, I have seen pages that were loading over 11k modules, which took 5-10 seconds to start-up the page."
  - "After we started to get rid of most of our internal barrel files, we got that down to about 3.5k modules - a reduction of 68%."
- Stated exception (verbatim): "Where barrels are necessary is when you are writing a library. Libraries
  like `@tanstack/react-query` need a single entry point file that we can put into the `main` field of
  `package.json`. This is the public interface of what consumers can use. To me, this is the only place
  where a barrel makes sense."
- Takeaway: he opposes INTERNAL barrels; the only sanctioned barrel is the published library's single
  public entry point.

### bulletproof-react — current stance on barrel/index files

- URL: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  (raw: https://raw.githubusercontent.com/alan2207/bulletproof-react/master/docs/project-structure.md)
- Stance: DISCOURAGES internal barrel files. Verbatim:
  - "In the past, it was recommended to use barrel files to export all the files from a feature. However,
    it can cause issues for Vite to do tree shaking and can lead to performance issues."
  - "Therefore, it is recommended to import the files directly."

### Vitest — official profiling guide

- URL: https://vitest.dev/guide/profiling-test-performance
- Key number (verbatim): "The example below shows how importing files without barrel file reduces amount
  of transformed files by ~85%."
- Recommendation (verbatim): "Instead of importing from the top-level module, import directly from the
  specific function."

### Atlassian Engineering — "How We Achieved 75% Faster Builds by Removing Barrel Files"

- URL: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- Key numbers (Jira frontend): **75% reduction in build minutes** per commit; TypeScript highlighting
  >30% faster; local unit testing ~50% faster on average (up to 10x for some packages); 88% fewer tests
  run in a typical build (1600 -> 200); 73% reduction in average test runtime.

### Marvin Hagemeister — "Speeding up the JavaScript ecosystem - The barrel file debacle"

- URL: https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
- Date: Oct 8, 2023
- Key point: barrel files (files that only re-export, with no code of their own) are a primary reason
  tooling is slow in big projects — slower module loading, longer test runs, and especially import-cycle
  lint rules whose module-graph cost is paid per file, "taking a couple of hours in bigger projects."
  Inspired the `unbarrelify` removal tool.

### Vercel / Next.js — "How we optimized package imports in Next.js"

- URL: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- Problem (verbatim): "If you want to use one single export from a barrel file that imports thousands of
  other things, you are still paying the price of importing other unneeded modules." Popular React
  packages "take 200~800ms just to import them."
- Numbers from `optimizePackageImports`: dev cold-compile examples — `@mui/material` 7.1s -> 2.9s
  (2225 -> 735 modules); `lucide-react` 5.8s -> 3s (1583 -> 333); `@mui/icons` 10.2s -> 2.9s
  (11738 -> 632). Production builds ~28% faster; local cold start ~10% faster; serverless cold starts
  "up to 40% faster"; a recursive barrel package went from ~30s to ~7s to compile.

---

## Verdicts

CLAIM 1 — "elite TS repos use multi-hyphen kebab-case file names freely":
**PARTLY CONFIRMED.** kebab-case is the dominant multi-word convention in vercel/vercel CLI and
shadcn-ui/ui (app + CLI), and 2+ hyphen names are common there (15-18%). BUT it is not universal:
TanStack's CORE libraries (`query-core`, `react-query`, `router-core`, `react-router`, and the
vue/solid/preact adapters) are camelCase/PascalCase, not kebab — kebab there is confined to
codemods/eslint-plugins/framework-start adapters. vitest barely uses multi-hyphen (1.3%). And the
cited reference repo bulletproof-react uses kebab but has ZERO 2+ hyphen names (caps at two words).
So "kebab is common" is true; "multi-hyphen used freely everywhere" overstates it.

CLAIM 2 — "TkDodo + bulletproof-react advise against internal barrel files":
**CONFIRMED.** TkDodo's "Please Stop Using Barrel Files" measures a 68% module-count reduction
(11k -> 3.5k) from removing internal barrels and says the only acceptable barrel is a library's single
public entry. bulletproof-react's project-structure.md explicitly says barrels "can cause issues for
Vite to do tree shaking and can lead to performance issues" and recommends importing files directly.
Corroborated with hard numbers by Vitest (~85% fewer transforms), Atlassian (75% fewer build minutes),
Vercel/Next.js (up to 40% faster cold starts), and Marvin Hagemeister.
