# Bulletproof-React Structure: Exact Prescription, Criticisms, Applicability Beyond Web

Research agent **T-bulletproof** | structure-audit pipeline | 2026-06-04
Topic: bulletproof-react structure — exact prescription, criticisms, applicability beyond web apps.

Method: WebFetch of primary docs (bulletproof-react repo, Hono docs, Robin Wieruch), GitHub API
to read the *actual* example file names, and ~10 WebSearch queries from different angles
(criticism, cross-feature imports, colocation, CLI structure, Ink TUI, Hono server, library
packaging, monorepo features-vs-libs, barrel files, kebab naming). Cross-checked 10+ independent
sources; disagreements recorded explicitly.

Repo grounding done up front: read the actual `apps/web`, `cli/diffgazer`, `cli/server`,
`cli/add`, `libs/core`, `libs/ui` trees so every recommendation cites a concrete workspace.

---

## Q1. What bulletproof-react EXACTLY prescribes

### Source: project-structure.md (primary, read end-to-end)
URL: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md

**Top-level `src/` directories (verbatim list):**
- `app` — application layer: routes, main component (`app.tsx`), providers, router config.
- `assets` — static files (images, fonts).
- `components` — shared components used across the **entire** application.
- `config` — global config + exported environment variables.
- `features` — feature-based modules (the **primary** code organization).
- `hooks` — shared hooks used application-wide.
- `lib` — reusable libraries **preconfigured** for the application (e.g. the api-client).
- `stores` — global state stores.
- `testing` — test utilities and mocks.
- `types` — shared TypeScript types.
- `utils` — shared utility functions.

**Feature folder contents** — a feature `src/features/awesome-feature` *may* contain any of:
`api`, `assets`, `components`, `hooks`, `stores`, `types`, `utils`. It is explicitly a
**subset of the same technical folders, scoped to one feature.** Not every feature uses all of them.

**Barrel files: DISCOURAGED.** The doc states barrel files "can cause issues for Vite to do tree
shaking and can lead to performance issues. Therefore, it is recommended to import the files directly."
(This reverses earlier versions of the guide that exported a feature public API via `index.ts`.)

**Unidirectional codebase architecture (the load-bearing rule):** flow is **shared → features → app.**
- Verbatim: *"It might not be a good idea to import across the features. Instead, compose different
  features at the application level. This way, you can ensure that each feature is independent which
  makes the codebase less convoluted."*
- Features must NOT import from other features. Composition happens at the `app` layer.

**ESLint enforcement** (`import/no-restricted-paths`, two zones it ships):
1. Disallow cross-feature imports — each feature target forbids `from: ./src/features` except its own dir.
2. Enforce direction — `target: ./src/features` cannot import `from: ./src/app`; and the shared dirs
   (`components`, `hooks`, `lib`, `types`, `utils`) cannot import `from: [./src/features, ./src/app]`.

### Source: actual react-vite example (read via GitHub API — what they REALLY do)
- `src/` dirs: `app/ assets/ components/ config/ features/ hooks/ lib/ testing/ types/ utils/` + root
  `index.css main.tsx vite-env.d.ts`. (No `stores/` in this example — Zustand not needed there.)
- `features/` = `auth comments discussions teams users`.
- A feature folder is **flat by technical type**: e.g. `discussions/` has only `api/` and `components/`.
  - `discussions/components/`: `create-discussion.tsx delete-discussion.tsx discussion-view.tsx
    discussions-list.tsx update-discussion.tsx`.
  - `discussions/api/`: `create-discussion.ts delete-discussion.ts get-discussion.ts get-discounts.ts
    update-discussion.ts`.
- **Naming reality (DIRECTLY contradicts the owner's one-hyphen rule):** all kebab-case, and
  multi-hyphen is normal — `create-discussion.tsx`, `discussions-list.tsx`, `use-disclosure.ts`,
  and a UI dir literally named `md-preview/`. Component *files* are kebab-case even though the
  component export is PascalCase.
- **Tests: NOT colocated next to source.** Shared hooks use `hooks/__tests__/` (saw `use-disclosure.ts`
  sitting beside a `__tests__/` dir). bulletproof-react keeps unit tests in `__tests__/` folders rather
  than `*.test.ts` next to the file.
- `components/ui/` groups each primitive into **its own folder** (`button/ dialog/ drawer/ form/
  table/ ...`) — i.e. the per-component-folder pattern is used ONLY for shared UI primitives, not
  for feature components.

> Net: the published doc and the example agree on dirs and the unidirectional rule, but the
> repo's own naming (`md-preview`, `create-discussion`) shows bulletproof-react has **no hyphen cap**
> and **does not colocate tests**. Two of the owner's three open questions are answered by the
> source repo contradicting his preferences.

---

## Q2. Known criticisms and limitations

### Crit 1 — Overkill for small apps (consensus across multiple sources)
- WebDevSimplified / reacthandbook.dev / sandroroth.com: "can end up being overkill for projects
  with only a handful of features/pages, with many folders completely unused or containing a few files…
  only recommended for larger, advanced projects that need the extra separation."
- Robin Wieruch frames the same as a **progression**: flat → technical folders → feature folders →
  domains → packages. Jumping straight to full bulletproof for a 3-screen app is premature.

### Crit 2 — The shared-component-needs-feature-logic breakdown (the strongest, concrete critique)
Source: bulletproof-react Issue #238 "Project Structure Problem"
URL: https://github.com/alan2207/bulletproof-react/issues/238
- A reusable `ProductCard`/`CarouselCard` in `components/` needs wishlist logic that lives in
  `features/wishlist`. The rule "components must not import features" forbids it.
- Author's lament (verbatim paraphrase): *"components shouldn't import from features, but my components
  need feature functionality."* Prop-drilling the toggle "through four levels of components just to
  reach CarouselCard" is the cumbersome workaround.
- A single card may need **two** features (wishlist + cart), so it cannot live under either feature.
- Three unsatisfying options, none endorsed by the doc: prop-drill (cumbersome), hoist logic to shared
  (violates SRP/separation), or put business logic in a UI component (architecturally wrong).
- **The doc gives no escape hatch.** This is the real-world place the model breaks down.

### Crit 3 — No guidelines for shared↔feature dependency edges
- The search synthesis (sandroroth.com) notes: "global files access feature modules and feature modules
  access global files, with no guidelines for these dependencies, which may get messy if not handled
  carefully." The ESLint zones enforce *direction* but not *which* shared things a feature may pull.

### Crit 4 — `features/` doesn't scream the domain enough / reusables scatter
Source: profy.dev "Screaming Architecture" (Uncle Bob applied to React)
URLs: https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25 ;
https://profy.dev/article/react-folder-structure
- Pro-feature argument: a feature-driven tree "screams 'I'm a project management tool'" instead of
  "I'm a React app." Two entry points (features + pages) help onboarding.
- Criticism captured in its own comments/synthesis: "reusable components can end up in a 'shared'
  location, duplicated, or scattered"; "file hierarchies require knowledge of the app to traverse";
  "nested folder mess."

### Crit 5 — Weak community / stale docs
- sandroroth.com: "There is no real community around these guidelines… documented resources but no
  discussions and rarely any improvements on the docs." (i.e. treat it as a reference, not a living standard.)

---

## Q3. Applicability beyond web apps (CLI / Ink TUI / Hono server / publishable libs)

### Bulletproof-react is web-only by design — but its PRINCIPLES travel
- The author explicitly says to focus on principles, not the React-specific tooling.
- Synthesis (WebSearch): "specifically designed for React frontend applications, not Node.js CLI
  libraries or backend services… the underlying principles (unidirectional shared→features→app) could
  be adapted." So: dir-by-dir copy = no; the **unidirectional dependency rule** = yes, everywhere.

### Ink TUI (cli/diffgazer)
Sources: ink README (vadimdemedes/ink), freecodecamp Ink tutorial, combray.prose.sh (2025 TUI series),
ivanleo.com "Building a Coding CLI with React Ink", logrocket Ink UI.
- Ink **is React** (react-reconciler + yoga-layout), so component/hook/feature organization applies
  unchanged. `<Box>`/`<Text>` replace divs; `useInput`/`useFocus`/`useStdout` replace DOM events.
- 2025 recommended pattern: **oclif (or commander) owns command parsing**, then a command renders an
  Ink tree via `render(<Screen/>)`. So a TUI app is: thin command entry → screens/features → shared
  components — which is exactly bulletproof's `app → features → shared`, with `app/` holding screens.
- Repo already does this: `cli/diffgazer/src` = `app/(providers,screens) features/ components/(ui,layout)
  hooks/ lib/ theme/ types/`. This is a faithful, correct bulletproof port to a TUI.

### Hono server (cli/server)
Source: Hono official best practices (read end-to-end) https://hono.dev/docs/guides/best-practices
- **Hono explicitly discourages Rails-style controllers.** Verbatim concern: *"the path parameter
  cannot be inferred in the Controller without writing complex generics."* Extracting handlers into a
  `controllers/` layer **breaks type inference** — write handlers inline in the route.
- For scale: *"Use `app.route()` to build a larger application without creating 'Ruby on Rails-like
  Controllers'."* Split by **feature domain** into separate Hono instances (`authors.ts`, `books.ts`),
  mount with `app.route('/authors', authors)`. Use `createFactory()` for shared middleware.
- Hono gives **no folder prescription** beyond "split by feature." So bulletproof's `features/` maps
  cleanly: each server feature = one mounted sub-app.
- Independent production guide (Burkard, Medium) layers `schemas/ controllers/ services/ middlewares/
  models/`. This is the *opposite* of Hono's official advice (controllers) — see Controversy below.
- Repo already does it the Hono-blessed way: `cli/server/src` = `features/(config,git,health,review,
  settings,shutdown) shared/(middlewares,lib)`. Feature-per-domain + shared. Good.

### Publishable libraries (libs/core, libs/ui, libs/keys, libs/registry)
Sources: Nx blog "Managing TS Packages in Monorepos"; dev.to "Building a TypeScript Library in 2025";
colinhacks "Live types in a TS monorepo"; FSD monorepo article.
- Libraries are **NOT** organized by `features/`. They organize by **public-API surface + domain
  module**, with one `src/index.ts` as the single intentional public entry point.
- For a library, a barrel `index.ts` is *justified* — it is the package's public contract
  (Robin Wieruch: barrels are fine "if you don't just re-export everything… but only the public API…
  you don't leak implementation details"). This is the ONE place a barrel earns its keep.
- 2025 dev export pattern: `exports` field points `types`+`import` at `./src/index.ts` for in-repo dev,
  overridden via `publishConfig` to `./dist/...` on publish.
- Repo: `libs/core/src` already domain-moduled (`review/ providers/ schemas/ hooks/ api/ catalog/
  streaming/ theme/ forms/ navigation/`) + a top `index.ts`. This is correct library shape — do NOT
  retrofit `features/` here.

### cli/add (the registry CLI, bin `dgadd`)
Sources: dev.to "Recommended Folder Structure for Node(TS) 2025"; LogRocket Node architecture.
- CLI idiom is **`commands/` (one file/folder per subcommand)** + `utils/` + `lib/`, NOT `features/`.
  Repo already does this: `cli/add/src` = `commands/(add,...) utils/ generated/`. Correct CLI shape.

---

## Q4. Does `features/` still make sense in apps/web when libs/ui + libs/core exist?

This is the sharpest monorepo question and sources genuinely **disagree**.

### Camp A — "App should be almost empty; features belong in libs/ (domain packages)"
Sources: Nx "Folder Structure"; dev.to "80/20 Library-First Monorepo: Why Your Apps Should Be
Almost Empty"; dev.to "The 'Shared' Library is a Lie".
- Nx-school: apps are *thin shells* — "an app should be boring: import a feature library, set up
  routes, maybe add a layout; no API calls, no complex state, no business logic." Features live in
  `libs/{domain}/feature`. A global `shared`/`utils` dumping ground (400+ ungoverned files) is the
  anti-pattern to avoid; split shared into typed libs (`type:ui` = presentation-only, etc.).

### Camp B — "Share packages for cross-app reuse; keep features inside each app"
Sources: Feature-Sliced Design monorepo article (read end-to-end); FSD blog.
- Verbatim: *"Use the monorepo to share packages (UI kit, API clients, shared tooling); use FSD to
  structure code inside each app."* Features are app-specific; only cross-app primitives go to packages.
- They **coexist without redundancy**: *"Avoid a 'global shared folder' that becomes a dumping ground.
  Instead, shared is scoped and structured."* Rule: *"Apps don't import deep internals of packages;
  only from public APIs."*
- FSD even applies its own layering *inside* packages (`packages/ui/src/{shared,widgets}`).

### Resolution for diffgazer
- The deciding factor is **cross-app reuse**, which the repo's own AGENTS.md already encodes:
  `libs/*` = reusable across apps; `apps/web` = product-specific composition. A `features/review` is
  Diffgazer-product-specific and is consumed by exactly one product surface (web). Per Camp B + the
  repo contract's Extraction Rules ("Extract primitives, not product widgets"), **`apps/web/features/`
  is NOT redundant** with `libs/ui` + `libs/core`. They sit at different layers:
  - `libs/ui` = generic primitives (Button, Dialog) — no domain.
  - `libs/core` = shared domain logic/schemas/hooks used by BOTH web and CLI.
  - `apps/web/features/*` = product composition that wires core+ui into Diffgazer screens.
- The danger isn't the `features/` folder; it's **leakage** — a web feature reimplementing list nav,
  focus trap, or schemas that already live in `libs/keys`/`libs/core`. That's exactly what AGENTS.md's
  "keep app adapters thin" rule guards against.

---

## What this means for diffgazer (concrete, per-workspace)

**Already correct — keep, don't churn:**
- `apps/web/src` and `cli/diffgazer/src` are faithful bulletproof ports (`app/ features/ components/
  hooks/ lib/ types/ config/ testing/`). Ink TUI applying bulletproof is *validated* by 2025 practice.
- `cli/server/src` = `features/<domain>/ + shared/` matches Hono's official "split by `app.route()`,
  no controllers" advice. Confirm handlers stay inline (don't add a `controllers/` layer — it breaks
  Hono type inference).
- `cli/add/src/commands/` is the correct CLI idiom (not `features/`).
- `libs/core/src` domain modules + top `index.ts` is correct library shape. Do NOT add `features/` to libs.
- Colocated `*.test.ts(x)` next to source: this is the modern majority practice (Wieruch, colocation
  consensus) and is *better* than bulletproof's own `__tests__/`. Keep it. Bulletproof-react being
  inconsistent here is its weakness, not the repo's.

**Apply the unidirectional rule as ENFORCED lint (currently a convention, not a guard):**
- Add `import/no-restricted-paths` zones in `apps/web` and `cli/diffgazer`: forbid cross-`features/*`
  imports and `features → app` / `shared(components,hooks,lib,utils,types) → features|app`.
- For the monorepo edge: add a zone forbidding `apps/* / cli/*` from importing `libs/*/src/**`
  internals (force the package public API). This operationalizes AGENTS.md "consume `@diffgazer/ui`,
  never mirror it" and FSD's "only import from public APIs."

**The one-hyphen / single-word naming rule (owner's Q-c) — recommend RELAXING:**
- It contradicts (a) bulletproof-react's own files (`create-discussion.tsx`, `md-preview/`,
  `use-disclosure.ts`) and (b) the repo's own established kebab-case convention with descriptive
  multi-hyphen names: `use-review-severity-filter-keyboard.ts`, `block-bar-multi-segment.tsx`,
  `use-model-dialog-focus-trap.ts`. There are dozens of these; they read clearly.
- 2025/2026 consensus (sufle.io, Wieruch, Next.js conventions): **kebab-case for all files, no hyphen
  cap, descriptive names**, `.test.ts(x)` suffix, `use-` prefix for hooks. A file named
  `use-review-severity-filter-keyboard.ts` tells you everything; forcing it to one hyphen would force
  cryptic names or deeper folders.
- Recommendation: adopt "kebab-case, descriptive, one concept per file; folder path carries the rest
  of the context so names stay short" — but do NOT impose a hard hyphen count. Keep `.test.ts` and
  `use-x.ts` suffix conventions (they ARE the SOTA convention, not exceptions to fight).

**Barrel/`index.ts` policy (resolve the tension):**
- bulletproof-react now DISCOURAGES barrels (tree-shaking/Vite/Vitest cost — confirmed by Speakeasy,
  Capchase "5x faster builds", Next.js #12557, dev.to "stop using them").
- BUT libraries legitimately need ONE public barrel as their contract (Wieruch; Nx; FSD).
- Recommendation for diffgazer: **library packages keep exactly one top-level `src/index.ts` public
  barrel** (already the case in `libs/core`). **Inside apps/cli, avoid barrels** — apps/web has ~15
  `index.ts` files; audit them, keep only ones that express a real public boundary (e.g. a feature's
  intentional entry), delete pass-through re-export barrels that only add a hop and hurt Vitest.

**The shared-component-needs-feature-logic trap (Issue #238) — pre-empt it:**
- Diffgazer's `libs/ui` is correctly domain-free, so it can't fall into the ProductCard trap by
  construction (primitives don't import features). Keep it that way: never let a `libs/ui` primitive
  reach into product/domain logic. Product cards (history progress, breakdown bars) stay in
  `apps/web/features/*` exactly as AGENTS.md mandates. This is the *right* resolution to #238.

---

## Sources consulted (URLs)
1. https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md (primary doc)
2. https://github.com/alan2207/bulletproof-react/tree/master/apps/react-vite/src (actual example, via GitHub API)
3. https://github.com/alan2207/bulletproof-react/issues/238 (Project Structure Problem — strongest critique)
4. https://github.com/alan2207/bulletproof-react (repo overview / "React-only" framing)
5. https://www.robinwieruch.de/react-folder-structure/ (progression, component-folder, barrels, naming)
6. https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25 + https://profy.dev/article/react-folder-structure
7. https://hono.dev/docs/guides/best-practices (no-controllers, app.route(), type inference)
8. https://feature-sliced.design/blog/frontend-monorepo-explained (FSD: features in app, packages for reuse)
9. https://nx.dev/docs/concepts/decisions/folder-structure + https://dev.to/artur-havrylov/the-8020-library-first-monorepo-why-your-apps-should-be-almost-empty-1gom + https://dev.to/abdelaaziz_ouakala/the-shared-library-is-a-lie-fixing-your-nx-monorepo-architecture-3mie (Camp A: thin apps, features in libs)
10. Barrel-file performance: https://www.speakeasy.com/docs/sdks/customize/typescript/disabling-barrel-files , https://medium.com/capchase/the-hidden-cost-of-barrel-files-how-capchase-sped-up-builds-by-5x-fcb38bcbe8be , https://dev.to/tassiofront/barrel-files-and-why-you-should-stop-using-them-now-bc4 , https://github.com/vercel/next.js/issues/12557
11. Colocation debate: https://dev.to/rtfeldman/where-should-tests-live/comments , https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8
12. CLI/Ink/Node structure: https://github.com/vadimdemedes/ink , https://www.freecodecamp.org/news/react-js-ink-cli-tutorial/ , https://ivanleo.com/blog/migrating-to-react-ink , https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl
13. Naming: https://www.sufle.io/blog/naming-conventions-in-react , https://www.piyushgambhir.com/blogs/next-js-naming-conventions
14. TS library packaging: https://nx.dev/blog/managing-ts-packages-in-monorepos , https://dev.to/arshadyaseen/building-a-typescript-library-in-2025-2h0i , https://colinhacks.com/essays/live-types-typescript-monorepo
