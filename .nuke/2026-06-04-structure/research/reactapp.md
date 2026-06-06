# React SPA Structure SOTA beyond bulletproof-react (2026)

Research agent: T-reactapp
Date: 2026-06-04
Topic: React SPA structure SOTA beyond bulletproof-react (2026), applied to `apps/web` in the diffgazer monorepo.

---

## 0. Current state of `apps/web/src` (ground truth, read-only inspection)

```
apps/web/src/
  app/
    providers/        config-provider.tsx (+test), theme-provider.tsx (+test), index.tsx
    router.tsx        # TanStack Router, CODE-based (createRoute/createRootRoute), lazy() per route
    routes/
      __root.tsx
      home.tsx review.tsx history.tsx settings.tsx help.tsx onboarding.tsx
      settings/       analysis.tsx providers.tsx storage.tsx theme.tsx diagnostics.tsx agent-execution.tsx trust-permissions.tsx
  components/
    ui/               card-layout.tsx, progress/, severity/   # app-local primitives NOT in libs/ui
    layout/           header.tsx (+test), footer.tsx (+integration.test), global-layout.tsx, index.ts
    shared/           api-key-method-selector.tsx, storage-selector-content.tsx, trust-permissions-content.tsx, use-trust-form-keyboard.ts, index.ts
  config/             navigation.ts
  features/
    home/ review/ history/ onboarding/ providers/ settings/
      components/     e.g. review has ~30 component files + colocated .test.tsx / .keyboard.test.tsx
      hooks/          e.g. review/hooks/use-issue-selection.ts (+test), use-review-lifecycle.ts, index.ts
      utils/          (home only)
      index.ts        # 6 feature-level barrels + a few nested hooks/components barrels (10 total)
  hooks/              use-scoped-route-state.ts (+test), use-theme.ts, use-action-row-navigation.test.tsx
  lib/                api.ts, query-client.ts, config-guards.ts (+test), back-navigation.ts (+test), config-guard-cache.ts
  types/              focus-element.ts, theme.ts
  utils/              download.ts (+test)
  styles/  testing/   main.tsx  test-setup.ts
```

Key facts that drive recommendations:
- The structure is **already bulletproof-react-shaped** (app / components / config / features / hooks / lib / types / utils + per-feature components|hooks|utils + barrels).
- Routing is **TanStack Router, code-based** (manual `router.tsx` with `createRoute` + `lazy()`), NOT file-based codegen. `app/routes/*.tsx` files mirror the URL tree but are hand-wired in `router.tsx`.
- File naming is **kebab-case with `.test.tsx` colocated and `use-x.ts` hooks** already in place (matches owner's stated preference).
- There is **NO ESLint `import/no-restricted-paths` boundary enforcement** in `apps/web` — bulletproof-react's single most load-bearing rule (unidirectional codebase) is not mechanically enforced.
- The monorepo already has `libs/ui` (shadcn-like primitives) and `libs/core` (shared schemas/hooks/business logic), so `apps/web/src` is a *consumer app*, not the primitive home.

---

## Q1. 2025/2026 trends for Vite React SPAs (route colocation, app/ dir, components/ui vs features)

### Consensus across sources
1. **Feature-first organization is the durable default.** Bulletproof-react, Robin Wieruch, profy.dev, Sandro Roth, the React official FAQ, and Infinum all converge: group by feature/domain, keep a thin technical-shared layer, and *"colocate first, extract later."*
   - bulletproof-react: "Most of the code lives inside the `features` folder." src/ has `app, assets, components, config, features, hooks, lib, stores, testing, types, utils`. (https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
   - React official FAQ: "Don't spend more than five minutes on choosing a file structure... keep files that often change together close to each other." (https://legacy.reactjs.org/docs/faq-structure.html)
   - Kent C. Dodds: "Place code as close to where it's relevant as possible... things that change together should be located as close as reasonable." (https://kentcdodds.com/blog/colocation)

2. **The `app/` layer is now standard in SPAs (Next leaking in).** Bulletproof-react explicitly has an `app/` layer holding `routes`, `app.tsx`, `provider.tsx`, `router.tsx`. This is exactly what `apps/web/src/app/` already does (providers + router + routes). The trend is real and the repo is already on the right side of it.

3. **Route-based colocation via TanStack Router file-based routing is the rising influence, but code-based is still first-class.** TanStack Router supports directory routing, flat (dot) routing, and a mixed approach, plus a route-file ignore prefix (`-`) so you can colocate non-route files like `-components/` inside route folders (https://tanstack.com/router/latest/docs/routing/routing-concepts). File-based routing's selling points: automatic code-splitting, higher type-safety ceiling, enforced consistent structure (https://tanstack.com/router/v1/docs/routing/file-based-routing). Swizec's 8-months-in-production write-up confirms colocation-by-route works well in practice (https://swizec.com/blog/tips-from-8-months-of-tan-stack-router-in-production/).
   - **DISAGREEMENT with feature-first:** file-based routing pulls toward *route-colocated* code (`-components` inside route dirs), whereas bulletproof keeps routes thin in `app/routes` and the real code in `features/`. These two pull in opposite directions. For diffgazer, the repo already chose the bulletproof split (thin `app/routes/*.tsx` re-exporting feature pages), which is the better fit because the same review/settings logic is consumed by the TUI too — it cannot live inside route files.

4. **components/ui vs features split is universal**, but the *meaning* of `components/ui` differs in a monorepo (see Q3).

### Per-source notes
- Robin Wieruch (2026): feature folders + technical folders, layered. "separate feature related components from reusable components and... technical concerns from feature related components." (https://www.robinwieruch.de/react-folder-structure/)
- profy.dev "Screaming Architecture": evolution flat -> grouped-by-type -> feature/domain; final structure is feature-screaming. (https://profy.dev/article/react-folder-structure — fetched via search summary; direct fetch 403/refused)
- Feature-Sliced Design (FSD): layers (app, pages, widgets, features, entities, shared) + slices + segments, strict unidirectional layer dependencies. Positioned as the heavier alternative for large apps. (https://feature-sliced.design/)

---

## Q2. Where do hooks, contexts/providers, api clients (TanStack Query), and stores live in a modern SPA?

### Consensus
- **Providers + router live in `app/`.** bulletproof-react puts `provider.tsx` / `router.tsx` in `app/`. The repo already does this (`app/providers/`, `app/router.tsx`). QueryClientProvider belongs at the app root (the React Query overview + Zustand/Query structure articles both say wrap the app root with `QueryClientProvider`). (https://tanstack.com/query/v5/docs/framework/react/overview)

- **API/query logic is colocated as custom hooks per feature, not in a central `services/` dump.** bulletproof-react gives each feature an `api/` folder ("API requests and hooks for feature"). TkDodo's canonical guidance: keep a `queries` (or `queryOptions`) file per feature exporting only custom hooks so query *keys* and *functions* stay local; "one Query Key factory per feature." Since v5 the first abstraction to reach for is `queryOptions`, with hooks built on top. (https://tkdodo.eu/blog/practical-react-query, https://tkdodo.eu/blog/the-query-options-api, https://tkdodo.eu/blog/effective-react-query-keys)

- **Server state vs client state are different layers.** TanStack Query owns server/cache state; Zustand (or Context) owns UI/client state. "TanStack Query does not replace Zustand... Zustand works well with UI state (modal openness), TanStack Query works well with backend data." (https://medium.com/@zerebkov.artjom/how-to-structure-next-js-project-with-zustand-and-react-query-c4949544b0fe)

- **Stores:** bulletproof-react has top-level `src/stores` for *global* state and per-feature `stores/` for feature state. Use global `src/stores` sparingly; prefer feature-local.

- **Hooks:** shared/cross-cutting hooks in `src/hooks`; feature hooks in `features/<x>/hooks`. This is exactly the repo's current split.

### Application to diffgazer
- `apps/web/src/lib/query-client.ts` + `lib/api.ts` is the correct home for the *configured* client (bulletproof's `lib` = "reusable preconfigured libraries").
- Per-feature query hooks/`queryOptions` should live in `features/<x>/api/` (the repo currently does not have `api/` folders — query usage may be inlined in hooks; adding a thin `features/<x>/api/` only when a feature actually does data fetching is the YAGNI-correct move).
- Note: in this monorepo, **shared schemas/types/business hooks already live in `libs/core`** (per AGENTS.md: "form/API/derived-state React hooks", Zod schemas, "API client factories"). So `apps/web` should not duplicate those — it consumes `@diffgazer/core` and only keeps *app-composition* hooks locally.

---

## Q3. components/ui (copied shadcn primitives) vs components/ (app) vs features/<x>/components — practical consensus for an app consuming a shadcn-like internal library

### The general (non-monorepo) consensus
A 3-tier component hierarchy is the dominant 2025/2026 pattern:
- `components/ui/` = raw shadcn primitives (buttons, inputs, dialogs).
- `components/` (or `components/shared`, sometimes `blocks/`) = app-level reusable compositions built from primitives, feature-agnostic.
- `features/<x>/components/` = feature-specific components.

Sources:
- shadcn 2026 handbooks: "separates `components/ui` (primitives), `blocks` (composed sections), and `features`"; three-tier `ui/` raw, `primitives/` lightly-modified, `blocks/` product compositions. Golden rule: don't edit the generated primitive files — wrap them. (https://shadcnspace.com/blog/shadcn-ui-handbook, https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44)
- Infinum / "Context + Domain": Core domain (primitives) -> Shared domain (built from core, shared across features) -> Features domain. "features can use what comes from the shared folder, but not the other way around." (https://infinum.com/handbook/frontend/react/project-structure)

### The monorepo twist (THIS is what matters for diffgazer)
In a monorepo that already has `libs/ui`, the raw-primitive tier lives in the **package**, not in `apps/web/src/components/ui`. So in `apps/web`:
- `libs/ui` (`@diffgazer/ui`) IS the `components/ui` tier — copied/owned shadcn-like primitives with a public contract.
- `apps/web/src/components/ui/` should therefore only hold **app-local primitives that are intentionally NOT generic enough to extract** (the repo currently has `card-layout`, `progress/`, `severity/` there). Per AGENTS.md extraction rules these are correctly app-local because they're product-shaped (severity, review progress), not generic primitives.
- `apps/web/src/components/shared/` = app-level reusable compositions used by 2+ features (the repo's `api-key-method-selector`, `storage-selector-content`, `trust-permissions-content` are exactly this — shared across settings + onboarding).
- `apps/web/src/components/layout/` = app shell (header/footer/global-layout). Correct and standard.
- `features/<x>/components/` = single-feature components (review's ~30 components). Correct.

**The naming clash to flag:** having `apps/web/src/components/ui/` *and* `@diffgazer/ui` both named "ui" is mildly confusing — a reader may expect `components/ui` to be the primitive library. Two defensible options: (a) keep `components/ui` only for app-local primitives and document the distinction, or (b) rename the app-local folder to `components/elements` or fold those into `components/shared`. The owner's "screaming/SRP" preference leans toward (b) to remove the ambiguity, but it is a cosmetic call, not a correctness one.

### Controversy
- shadcn docs/community still assume `components/ui` is where primitives live; in a monorepo that assumption is wrong and a reader coming from shadcn docs will be surprised. Worth a one-line README in `apps/web/src/components/`.

---

## Q4. What stays app-local vs extracted when the monorepo already has libs/ui + libs/core

### Consensus: "duplicate until it hurts; extract leaf types mechanically, generalize data-access deliberately"
- "It is better to duplicate code until you have seen the same code work in multiple contexts, and then extract." (Robin Wieruch monorepos; codefiend) — direct counter to premature extraction.
- The "80/20 Library-First Monorepo" argues apps should be *almost empty* and most code should live in typed libs (`data-access, state, ui, util, hooks, features`); leaf types (util, ui, hooks) promote mechanically, data-access needs generalization. Failure symptom: "everything ends up in `shared/` and no one knows what's safe to reuse." Mitigation: every reusable slice needs a public `index.ts` + a short doc (purpose, consumers, stability). (https://dev.to/artur-havrylov/the-8020-library-first-monorepo-why-your-apps-should-be-almost-empty-1gom)
- FSD monorepo guide: extract a new package when a domain becomes **multi-app AND high-change.** (https://feature-sliced.design/blog/frontend-monorepo-explained)

### What strong teams keep INSIDE apps/web/src (applied to diffgazer + AGENTS.md boundaries)
KEEP LOCAL:
- Product composition, copy, domain flows, app-only layout (AGENTS.md says exactly this for `apps/web`).
- Feature components and feature hooks that encode review/settings/onboarding domain behavior.
- App-local primitives that are deliberately product-shaped (`severity`, review `progress`, `card-layout`).
- Route wiring (`app/router.tsx`, `app/routes/*`), app providers, app navigation config.
- App-specific query hooks / `queryOptions` (the *configured* client can be `lib/`, but the per-feature queries stay in the feature).

EXTRACT (and the repo already has the right homes):
- Generic keyboard/focus behavior -> `libs/keys` (AGENTS.md).
- Generic UI primitives / reusable compound components -> `libs/ui`.
- Zod schemas, result/error types, format utils, review state machines, provider filtering, API client factories, shared form/API/derived-state hooks -> `libs/core`.

DO NOT extract: app-specific widgets (history progress lists, breakdown bars, onboarding copy, domain cards) — AGENTS.md explicitly forbids moving these into `libs/ui`.

### Tension to record
The "80/20 almost-empty apps" school says push *more* into libs; the bulletproof/Wieruch "colocate first" school says keep it in the app until duplication is proven. For diffgazer the deciding factor is the AGENTS.md boundary contract + the second consumer (TUI/`cli/diffgazer`): anything the TUI also needs is already supposed to be in `libs/core`/`libs/keys`, so the app can stay genuinely thin on logic while keeping its product composition local. That is the correct synthesis here.

---

## OPEN PERSONAL QUESTIONS (owner)

### (a) Is grouping a module into its own folder (component + test + index together) recommended or discouraged in 2026?
**Split decision — this is a genuine controversy.**
- PRO folder-per-component: Robin Wieruch (2026) "strongly advocates folder-per-component at scale," critiques flat ("doesn't scale well... we lose sight of every individual component"). Josh Comeau's "Delightful React file structure" and Kent Dodds colocation both favor a component folder bundling test/style/story. The folder-per-component crowd uses an `index` so imports stay `import Button from './Button'`.
- AGAINST / nuance: React official FAQ + multiple 2025 pieces warn against deep nesting ("max 3-4 levels", many say "max 2-3"). The flat-with-colocated-tests camp argues a folder-per-component with a barrel `index.ts` adds a navigation hop and a barrel file for almost no benefit until the component has 3+ sibling files (component + test + styles + hook).
- **Practical 2026 consensus:** colocate test (and any feature-local hook/util) NEXT TO the component as flat sibling files (`button.tsx`, `button.test.tsx`); only promote to a folder once a single unit genuinely owns 3+ files. Avoid a per-component `index.ts` barrel (see (c) tree-shaking). The diffgazer `apps/web` already does the flat-sibling thing (`issue-list-pane.tsx` + `issue-list-pane.test.tsx` in `features/review/components/`) — this is the SOTA-correct choice and matches the owner's "small focused files / top readability" goal. **Recommendation: keep flat-sibling colocation; do NOT migrate to folder-per-component; do NOT add per-component index barrels.**

### (b) Does bulletproof-react-style structure apply to CLI/TUI/server code?
**Mostly NO for the layout taxonomy; YES for the principles.**
- bulletproof-react is explicitly a *React application* architecture (its `app/routes`, `features`, `components/ui`, providers all assume a rendered UI app). The "feature module" + unidirectional-import + public-`index.ts` *principles* transfer cleanly to any TS code.
- CLI consensus (Commander/oclif + Ink): organize by **`commands/`** (command routing) separate from **components/features** (Ink TUI UI), render Ink inside a command handler. (https://blog.logrocket.com/building-typescript-cli-node-js-commander/, https://dev.to/skirianov/building-reactive-clis-with-ink-react-cli-library-4jpa)
- For diffgazer specifically (per AGENTS.md): `cli/diffgazer` is a thin binary with two modes (web embeds the built SPA; TUI is Ink). The Ink TUI half *can* reuse a light feature/components split (it is React), but the command/mode wiring is CLI-shaped, not bulletproof-shaped. `cli/server` (Hono) is backend — it should follow a backend module layout (routes/handlers/services), not `features/components`. `cli/add` is a command CLI -> `commands/` layout. **Recommendation: apply bulletproof's *principles* (feature modules where there's real UI, unidirectional imports, public index per package) everywhere, but apply its *folder taxonomy* (`features/`, `components/ui`, `app/routes`) only to `apps/web`, `apps/docs`, `apps/landing` and the Ink TUI surface — not to Hono server or command-dispatch CLIs.**

### (c) Strict one-hyphen/single-word file naming vs common suffixes (.test.ts / use-x.ts)
**The community uses kebab-case files + suffix conventions; treat `.test.tsx`, `.integration.test.ts`, `.keyboard.test.tsx`, and `use-` as STRUCTURED suffixes/prefixes, not as "extra hyphens" to be minimized.**
- 2025/2026 hybrid consensus: kebab-case FILE names (`my-component.tsx`) + PascalCase COMPONENT identifiers (`MyComponent`) is the dominant pattern (cross-OS safe, fuzzy-search friendly). Wieruch uses kebab-case throughout. (https://www.robinwieruch.de/react-folder-structure/, multiple naming-convention articles)
- Test files: `.test.tsx` / `.spec.tsx` is the near-universal colocated convention; `__tests__` folders are the older alternative most 2026 sources now de-emphasize in favor of colocation.
- Hooks: the React-identifier convention is `useThing` (camelCase) for the *symbol*; the *file* in kebab-case repos is `use-thing.ts`. The `use-` prefix is semantically required (React's hook detection + lint rules rely on the `use` prefix), so it is not an arbitrary hyphen.
- **Reconciling with the owner's "at most one hyphen, ideally single word" rule:** a clean way to phrase the rule so it doesn't fight conventions: count the *base name* concept words for the one-hyphen budget, and treat `use-` and the `.test`/`.integration.test`/`.keyboard.test` segments as separate structured affixes that do NOT consume the hyphen budget. Under that reading, `use-theme.ts`, `download.test.ts`, `footer.integration.test.ts` all comply. Files like `api-key-method-selector.tsx` (3 hyphens in the base) and `use-review-severity-filter-keyboard.ts` are the ones that violate the spirit — they signal a too-broad concept that could be split or renamed. **Recommendation: keep kebab + `.test.tsx` + `use-` as-is (they are SOTA and already in the repo); apply the one-hyphen budget only to the descriptive base name, and use multi-hyphen base names as a *smell* prompting a rename/split rather than a hard error.**

---

## CONTROVERSIES (where credible sources disagree)

1. **Route-colocation (TanStack file-based `-components`) vs feature-first (`features/`).** TanStack docs + Swizec push route-colocated code; bulletproof/Wieruch keep routes thin and code in features. For an app whose logic is also consumed by a TUI, feature-first wins (logic can't live in route files).
2. **Folder-per-component vs flat-sibling colocation.** Wieruch/Comeau (folder-per-component at scale) vs React-FAQ/anti-nesting camp (flat, max 2-3 levels). 2026 pragmatic middle: flat siblings until 3+ files justify a folder.
3. **Barrel `index.ts` everywhere vs none.** bulletproof + Wieruch (public-API barrels are good) vs Vite/Biome/Atlassian/Capchase (barrels hurt tree-shaking, HMR, build time — Atlassian 75% faster builds, Capchase 5x faster after removal). Synthesis: ONE public barrel per package/feature *boundary*; never per-component, never re-export-everything. (https://vite.dev/guide/performance, https://medium.com/capchase/the-hidden-cost-of-barrel-files-how-capchase-sped-up-builds-by-5x-fcb38bcbe8be)
4. **FSD vs bulletproof.** FSD = stricter layers + enforced unidirectional deps, better at huge scale, heavier; bulletproof = simpler, "no real guidelines for global<->feature deps, may get messy." For diffgazer's size, bulletproof + an enforced import-boundary lint rule is the right weight; full FSD layers (entities/widgets) would be over-engineering (YAGNI).
5. **Apps-almost-empty (80/20 library-first) vs colocate-first.** Push-to-libs vs keep-in-app-until-proven. Decided here by AGENTS.md boundaries + the TUI second consumer.

---

## WHAT THIS MEANS FOR DIFFGAZER (concrete, repo-applicable)

1. **`apps/web` is already SOTA-shaped — do not restructure it.** It matches bulletproof-react (app/components/config/features/hooks/lib/types/utils + per-feature components|hooks|utils), uses kebab-case + colocated `.test.tsx` + `use-` hooks, and keeps product-shaped primitives local. The biggest *missing* piece is enforcement, not layout.

2. **Add `import/no-restricted-paths` (or an equivalent boundary lint) to `apps/web`.** bulletproof-react's single load-bearing rule (unidirectional: `shared -> features -> app`, and no cross-feature imports) is currently NOT enforced anywhere in the app. This is the highest-value structural change: forbid `features/*` importing each other and forbid `components|hooks|lib|types|utils` importing from `features|app`. (bulletproof project-structure.md gives the exact zones config.)

3. **Resolve the `components/ui` naming ambiguity.** `apps/web/src/components/ui/` collides conceptually with `@diffgazer/ui`. Either rename it (`components/elements`) or add a one-line README clarifying that primitives live in `@diffgazer/ui` and `components/ui` is app-local-only. Cosmetic but improves "screaming" readability.

4. **Keep flat-sibling colocation; do not adopt folder-per-component and do not add per-component barrels.** Trim barrels to the feature *boundary* only (`features/<x>/index.ts` as public API). The 10 existing barrels are mostly fine; audit any `hooks/index.ts` / `components/index.ts` that re-export everything — those are the tree-shaking/HMR risk, and a flat structure rarely needs them.

5. **Per-feature `api/` only when a feature fetches.** Don't pre-create `api/` folders. When a feature does data fetching, colocate `queryOptions` + key factory there (TkDodo pattern); keep the *configured* client in `lib/query-client.ts`. Reuse `libs/core` API client factories rather than re-implementing.

6. **Do NOT extend the bulletproof folder taxonomy to `cli/server` (Hono) or command CLIs (`cli/add`).** Use backend module layout for the server and a `commands/` layout for command CLIs. The Ink TUI surface in `cli/diffgazer` MAY use a light feature/components split since it is React, but keep it thin (AGENTS.md: the binary stays thin, logic in `libs/core`/`libs/keys`).

7. **File-naming rule phrasing:** apply the "at most one hyphen / single word" budget to the descriptive BASE name only; treat `use-`, `.test`, `.integration.test`, `.keyboard.test` as structured affixes outside the budget. Flag multi-hyphen base names (`api-key-method-selector`, `use-review-severity-filter-keyboard`) as rename/split candidates, not hard violations.

---

## SOURCES CONSULTED (URLs)
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- https://www.robinwieruch.de/react-folder-structure/
- https://legacy.reactjs.org/docs/faq-structure.html
- https://kentcdodds.com/blog/colocation
- https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster
- https://tanstack.com/router/latest/docs/routing/routing-concepts
- https://tanstack.com/router/v1/docs/routing/file-based-routing
- https://swizec.com/blog/tips-from-8-months-of-tan-stack-router-in-production/
- https://tkdodo.eu/blog/practical-react-query
- https://tkdodo.eu/blog/the-query-options-api
- https://tkdodo.eu/blog/effective-react-query-keys
- https://tanstack.com/query/v5/docs/framework/react/overview
- https://medium.com/@zerebkov.artjom/how-to-structure-next-js-project-with-zustand-and-react-query-c4949544b0fe
- https://shadcnspace.com/blog/shadcn-ui-handbook
- https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44
- https://infinum.com/handbook/frontend/react/project-structure
- https://sandroroth.com/blog/project-structure/
- https://profy.dev/article/react-folder-structure
- https://feature-sliced.design/
- https://feature-sliced.design/blog/frontend-monorepo-explained
- https://dev.to/artur-havrylov/the-8020-library-first-monorepo-why-your-apps-should-be-almost-empty-1gom
- https://www.robinwieruch.de/javascript-monorepos/
- https://vite.dev/guide/performance
- https://medium.com/capchase/the-hidden-cost-of-barrel-files-how-capchase-sped-up-builds-by-5x-fcb38bcbe8be
- https://blog.logrocket.com/building-typescript-cli-node-js-commander/
- https://dev.to/skirianov/building-reactive-clis-with-ink-react-cli-library-4jpa
- https://www.developerway.com/posts/react-project-structure (403 on direct fetch; cited via search summary)
