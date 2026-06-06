# Research: Test Placement & Colocation (2025/2026 consensus)

Research agent: T-tests. Date: 2026-06-04.
Scope: where unit tests live, folder-per-module debate, monorepo specifics (tsconfig.test.json, e2e, smoke), and how naming rules interact with `.test.ts` / `use-foo.test.ts`.

Read-only on the codebase. Notes apply to the diffgazer monorepo (apps/web, apps/docs, apps/landing, cli/diffgazer, cli/add, cli/server, libs/core, libs/keys, libs/ui, libs/registry).

---

## 0. What the repo does TODAY (ground truth, read from the tree)

- Unit tests are **colocated** as `foo.test.ts` / `foo.test.tsx` directly next to source (e.g. `libs/core/src/errors.test.ts`, `apps/web/src/lib/back-navigation.test.ts`, `libs/keys/src/core/keys.test.ts`). No `__tests__/` directories anywhere. No central `tests/` root for unit tests.
- Hook tests already use **`use-foo.test.ts`** (hyphen + dot): e.g. `apps/web/src/hooks/use-scoped-route-state.test.ts`, `libs/core/src/api/hooks/use-review-stream.test.ts`, `libs/keys/src/hooks/use-focus-trap.test.ts`. This is the established repo spelling.
- Registry-shipped libs use a **`testing/` subfolder** convention instead of pure colocation in the published registry trees: `libs/registry/src/testing/*.test.ts`, `libs/ui/registry/hooks/testing/use-*.test.tsx`, `libs/core/src/testing/`, `cli/server/src/shared/lib/testing/`. This is a deliberate divergence: the registry source ships to copy/shadcn consumers, so tests are quarantined into `testing/` so they are easy to exclude from the published bundle. (See AGENTS.md "Generated Artifacts" / handoff rules.)
- E2E lives **per-app**: `apps/docs/tests/e2e/*.e2e.ts` (accordion, dialog, menu, tabs, etc.) with a `baselines/` dir for visual snapshots. Only `apps/docs` has e2e; `apps/web`/`apps/landing` do not.
- Smoke tests live at the **monorepo root**: `scripts/monorepo/smoke-*.mjs` (smoke-shadcn-install, smoke-package-install, smoke-keys-absent, smoke-modelsdev, smoke-cli, etc.) plus `scripts/monorepo/smoke-modelsdev.test.mjs`. These are cross-package install/handoff checks, correctly NOT colocated.
- Every package has a dedicated **`tsconfig.test.json`** (10 of them: apps/web, apps/landing, apps/docs, cli/server, cli/add, cli/diffgazer, libs/ui, libs/core, libs/registry, libs/keys). Example `libs/core/tsconfig.test.json` extends `./tsconfig/test.json`, `noEmit: true`, `include: ["src/**/*.ts", "src/**/*.test.ts"]`. `apps/web/tsconfig.test.json` extends `tsconfig.app.json`, adds `types: ["vite/client","vitest/globals","@testing-library/jest-dom"]`, includes all of `src/**/*.ts(x)`.
- Vitest configs are per-package (`vitest.config.ts` in apps/web, apps/landing, cli/*, libs/ui, libs/core; apps/docs uses `vite.config.ts`). No root workspace `vitest.config`/projects file observed.
- 144 `index.ts` files under non-dist source — barrel usage is significant, relevant to the colocation/navigation discussion below.

So: the repo is **already on the modern consensus** (colocated unit tests, dot-suffix naming, per-package test tsconfig, per-app e2e, root smoke). The open questions are about validating/refining, not overhauling.

---

## 1. Where should unit tests live? (foo.test.ts vs __tests__/ vs tests/ root)

**CONSENSUS (2025/2026): colocate unit tests as `foo.test.ts` next to `foo.ts`.** This is the dominant recommendation across official docs, the testing-library ecosystem, bulletproof-react, Kent C. Dodds, and the framework community. `__tests__/` is a legacy Jest default that is tolerated but no longer the recommended default. A separate `tests/` root is reserved for cross-cutting integration/e2e, not unit tests.

### Tooling defaults (neutral, both work)
- **Vitest** default `include`: `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` (from https://vitest.dev/config/include). It searches all subdirectories, so placement is the author's choice — colocated or in a `tests/` dir both work with zero config. Vitest docs take no position; "There's no single 'right' way to organize your test files." (https://vitest.dev/guide/)
- **Jest** default `testMatch`: looks for `.js/.jsx/.ts/.tsx` inside `__tests__/` folders AND any file with `.test`/`.spec` suffix (https://jestjs.io/docs/configuration). So Jest historically blessed BOTH `__tests__/` and the suffix convention. The `__tests__/` convention is a Jest-era artifact; modern Vitest-based stacks drop it because Vitest never required it.
- **Vitest in-source testing** (`if (import.meta.vitest)` blocks) exists but the docs themselves say to prefer separate files as projects grow / for components / e2e (https://vitest.dev/guide/in-source). Not relevant for this repo — ignore.

### Authoritative opinions
- **Kent C. Dodds — "Colocation"** (https://kentcdodds.com/blog/colocation): principle is "Place code as close to where it's relevant as possible." Direct quote: *"To help enable a more maintainable codebase, we should co-locate our tests files with the file or group of files they are testing."* Echoes Dan Abramov: *"Things that change together should be located as close as reasonable."* He even floats (without endorsing) same-file tests. Benefit cited: newcomers "can see immediately that the module is tested and use those tests as a reference."
- **Official React docs (FAQ: File Structure)** (https://legacy.reactjs.org/docs/faq-structure.html): "Don't overthink it… don't spend more than five minutes on choosing a file structure." Explicitly recommends colocation ("keep files that change together in close proximity") and shows tests colocated (`Button.js` + `Button.test.js`) in BOTH example structures (group-by-feature and group-by-type). Also: "limit yourself to a maximum of three or four nested folders."
- **bulletproof-react** (https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): feature-based structure with a root `src/testing/` folder for "test utilities and mocks" (NOT for the tests themselves). It does not prescribe `__tests__/`; the de-facto pattern in the repo is colocated `.test.tsx`. Critically it ALSO argues against barrel files (relevant to Q2): "it can cause issues for Vite to do tree shaking… import the files directly." Unidirectional flow: shared → features → app.
- **Testing Library ecosystem / community**: colocation is the standard. Quote captured: "Tests often serve as documentation. So having them next to our component makes perfect sense" and "Maintenance is much simpler when everything is in one place."
- **TkDodo**: no single "where do tests go" post, but his testing posts (https://tkdodo.eu/blog/testing-react-query) and barrel-file post assume colocation; his strong position is the anti-barrel one (Q2). He does not advocate `__tests__/` or a `tests/` root for units.
- **Robin Wieruch — React Folder Structure [2026]** (https://www.robinwieruch.de/react-folder-structure/): colocates tests with descriptive names (`app.js`, `app.test.js`, `app.css`). Advocates folder-per-component with `index.js` as public API, but explicitly notes barrels "have fallen out of favor… due to tree-shaking limitations" and that you can import directly to avoid the index navigation overhead.

### The dissent (separate `tests/` / exclusion concern)
The main counter-argument is **build/publish hygiene**: colocated `*.test.ts` must be explicitly excluded from compilation and from published packages, or test code leaks into `dist`/the npm tarball (https://bobbyhadz.com/blog/typescript-exclude-test-files-from-compilation, https://medium.com/trabe/control-what-you-publish-inside-your-npm-packages-e3ec911638b8). Mitigation everyone agrees on: use the package.json `files` allowlist (npm's preferred method) and/or tsconfig `exclude`, not `.npmignore`. For Node libs, Corey Cleary (https://www.coreycleary.me/where-to-put-your-tests-in-a-node-project-structure) notes a top-level `tests/` folder is a common Node convention — but that's about integration suites, not a blocker to colocating units.

**Verdict for unit tests: colocated `foo.test.ts` wins for 2025/2026. `__tests__/` = legacy, only keep if already entrenched. Separate `tests/` root = integration/e2e only.**

---

## 2. The owner's question: is "folder-per-module" (thing.tsx + thing.test.tsx + index.ts together) recommended or discouraged in 2026?

**This is the genuinely contested one, and it splits cleanly into TWO sub-questions that are often conflated:**

### 2a. Putting a component + its test in its own folder — UNCONTESTED, fine
Nobody objects to a folder containing `thing.tsx` + `thing.test.tsx` (+ `thing.css`, `thing.types.ts`). That IS colocation and is universally fine. React docs, Wieruch, Comeau, testing-library all show it.

### 2b. Adding an `index.ts` barrel that re-exports the folder — INCREASINGLY DISCOURAGED in 2026
This is where the index-file part of "folder-per-module" gets criticized. The barrel/index file is the controversial element, NOT the folder.

**FOR the folder-with-index pattern ("component folder pattern"):**
- **Josh Comeau** (https://www.joshwcomeau.com/react/file-structure/): explicitly endorses folder-per-component with `index.ts` that re-exports the real file (`export * from './FileViewer'; export { default } from './FileViewer';`). He solves the "every tab says index.tsx" complaint precisely THIS way — the real code lives in `FileViewer.tsx`, the index is a thin redirect, so editor tabs show the real name. Clean imports (`import FileViewer from '../FileViewer'`).
- **Robin Wieruch**: same — `index.js` as the folder's "public interface (public API)… where everything relevant to the outside world gets exported." Encapsulation argument.
- **Donavon West "Component Folder Pattern"** (styled-components blog) and the broader Angular/Atomic-Design world: standard there.

**AGAINST the index/barrel explosion:**
- **TkDodo — "Please Stop Using Barrel Files"** (https://tkdodo.eu/blog/please-stop-using-barrel-files): the strongest, most-cited 2024/2025 position. Three arguments:
  1. **Dev speed (primary):** *"In our NextJs project, I have seen pages that were loading over 11k modules, which took 5-10 seconds to start-up the page. After we started to get rid of most of our internal barrel files, we got that down to about 3.5k modules"* — 68% reduction. Importing from a barrel loads every re-exported module synchronously.
  2. **Circular imports:** a sibling importing the folder's own index creates `tab-panel.ts → index.ts → tab-panel.ts`; bundlers crash with cryptic errors.
  3. **Optimizer limits:** Next's `optimizePackageImports` can't optimize a barrel containing any non-re-export code (even `export const foo = 5`).
  Crucial nuance: *"Where barrels are necessary is when you are writing a library"* — a package needs a single `package.json` entry point. (Directly relevant: libs/ui, libs/keys, libs/core, libs/registry ARE libraries → their TOP-LEVEL public entry barrel is justified; per-folder internal barrels are not.)
- **bulletproof-react**: "avoid barrel files… import the files directly" (tree-shaking / Vite perf).
- **Steven Lemon "Are TypeScript Barrel Files an Anti-pattern?"** and "Why I Will Not Use Index Files in 2025": navigation/IDE cost — "all editor tabs say index.ts, providing no useful information — a steady drain on focus," renaming/refactoring friction, bundler over-inclusion.

**Synthesis on 2b:** The 2026 consensus is **NOT "one index.ts per component folder."** It is: (1) colocate freely (folder or flat, both fine); (2) avoid per-folder/internal barrels; (3) keep ONE barrel only at a true package/public-API boundary. Comeau/Wieruch's index-redirect is a defensible minority position that addresses the IDE-tab complaint but does NOT address TkDodo's module-graph/perf complaint and is the thing TkDodo/bulletproof argue against.

**Verdict for diffgazer:** Per-component-folder grouping is acceptable but unnecessary; the repo currently uses **flat colocated files with descriptive kebab-case names** (e.g. `back-navigation.ts` + `back-navigation.test.ts`), which is the lower-friction option the owner's KISS/YAGNI/readability goals favor. Do NOT introduce a folder + `index.ts` per component just for grouping — it adds the exact index-explosion (144 index.ts already exist) and module-graph cost TkDodo and bulletproof-react warn about. Reserve `index.ts` barrels for package public entry points (the 4 libs' top-level export surface). This also aligns with the owner's "single-word / at-most-one-hyphen" filename goal: flat descriptive files name the concept directly; barrels generate a sea of identical `index.ts`.

---

## 3. Monorepo specifics

### 3a. Separate `tsconfig.test.json` — RECOMMENDED, and the repo already does it correctly
- Consensus: a dedicated test tsconfig per package is standard for Vitest+TS monorepos, because per-package tsconfig properties OVERRIDE the root (arrays don't merge) — you must add test globs and test-only types per package (https://www.thecandidstartup.org/2025/09/08/vitest-3-monorepo-setup.html, https://www.thecandidstartup.org/2024/08/19/vitest-monorepo-setup.html).
- Why a SEPARATE test config (not just including tests in the app config): tests need extra types (`vitest/globals`, `@testing-library/jest-dom`, node) and relaxed rules (`noUnusedLocals: false`) that you don't want polluting the production build config. The repo's `apps/web/tsconfig.test.json` does exactly this (adds the test types, relaxes unused checks). `libs/core/tsconfig.test.json` keeps `noEmit:true` and includes `src/**/*.test.ts`.
- AGENTS.md already codifies this: apps use a solution `tsconfig.json` (`files:[]` + references to `tsconfig.app.json` + `tsconfig.test.json`, `tsc -b`); libs/core/keys/registry/ui + apps/docs chain `tsc --noEmit -p tsconfig.test.json`. This is the SOTA monorepo pattern (project references / solution config). Keep it. Do NOT collapse test files back into the app config (would lose editor jest-dom matchers + node globals, per AGENTS.md verification-gates note).

### 3b. E2E placement — per-app vs root e2e package
- Two legitimate patterns, genuine disagreement:
  - **Per-app `e2e/` (or `tests/e2e/`)**: tests live with the app they exercise. Simple, app owns its own server boot. (Kyrre Gjerstad; Nx per-project e2e.)
  - **Root/dedicated `e2e` package**: one place, shared base Playwright config, avoids per-app boilerplate; argued to be "the point of a monorepo" (https://www.kyrre.dev/blog/end-to-end-testing-setup, Nx "create an empty `e2e` project under apps/"). Slight tilt toward centralized in recent monorepo-focused posts.
- diffgazer reality: only `apps/docs` has e2e (`apps/docs/tests/e2e/*.e2e.ts` testing the rendered UI primitives + visual baselines). That is a per-app e2e suite and is correct because the e2e target IS the docs site that renders the components. A root e2e package would add indirection for a single consumer. **Keep per-app e2e here.** If apps/web later grows its own e2e, mirror the pattern (`apps/web/tests/e2e/`) rather than building a root package — until there are 2+ apps sharing identical Playwright setup, a root package is premature (YAGNI).
- Naming: docs uses `*.e2e.ts` (distinct suffix from `*.test.ts`) so the unit runner doesn't pick them up. Good — keep the distinct suffix; it cleanly separates Vitest unit globs from Playwright e2e globs.

### 3c. Smoke tests placement — root, NOT colocated (repo is correct)
- Smoke tests here are cross-package install/handoff validations (`smoke-shadcn-install`, `smoke-package-install`, `smoke-keys-absent`, `smoke-modelsdev`, `smoke-cli`) — they validate the BUILT/PUBLISHED artifacts across packages, so they belong at the orchestration layer: `scripts/monorepo/*.mjs`. Colocating them in a package would be wrong (they're not testing one package's source; they exercise the consumer experience). This matches the general rule: integration/cross-cutting suites go up at the root, unit tests go down next to source.
- `scripts/monorepo/smoke-modelsdev.test.mjs` uses `.test.mjs` — fine as long as the root scripts runner targets it and the per-package Vitest globs don't accidentally sweep `scripts/`. Worth a one-line check that package vitest `include` is scoped to `src/` (the configs are per-package so this is naturally contained).

---

## 4. Colocation × strict naming rules (.test.ts dot suffix; use-foo.test.ts hyphen+dot)

The owner's rule: kebab-case, at most one hyphen, ideally single word. Tension with `.test.ts` and `use-foo.test.ts`.

**Findings:**
- **`.test.` / `.spec.` are SUFFIX/EXTENSION segments, not "words in the name."** Both Vitest (`*.{test,spec}.?(c|m)[jt]s?(x)`) and Jest treat the `.test` segment as a recognized double-extension. It is a tooling contract, not a naming-style choice. Renaming it (e.g. `footest.ts`) breaks default discovery. So `.test.ts` is **non-negotiable and is correctly outside the one-hyphen rule** — the hyphen rule governs the base name (`back-navigation`), the dot-segments are extension grammar.
- **`use-` prefix is mandated by React** (hooks lint rules require the `use` prefix). Combined with kebab-case file naming, the canonical, widely-recommended spelling is `use-foo.ts` and its test `use-foo.test.ts` (confirmed across React naming-convention guides for 2025). This is the ACCEPTED spelling, and the repo already uses it consistently (40+ `use-*.test.ts(x)` files).
- On the "at most one hyphen / ideally single word" rule: that is a sensible BASE-NAME rule. `use-foo` already has one hyphen from the mandatory `use-` prefix, which means a multi-word hook name (`use-action-row-navigation`) necessarily exceeds one hyphen. **The rule must carve out the `use-` prefix** (it's a semantic/lint-required token, not a word separator). The repo has `use-action-row-navigation.test.tsx`, `use-openrouter-models-mapped.test.ts` — these are correct and readable; forcing them to one hyphen would harm readability (violates the owner's own "top readability" priority). Recommendation: state the rule as "kebab-case; minimize hyphens in the base name; the mandatory `use-` hook prefix and the `.test`/`.spec`/`.e2e` suffix segments are exempt."
- `.test.tsx` vs `.test.ts`: use `.tsx` when the test file contains JSX (rendering components/hooks with RTL), `.ts` otherwise. Repo already does this correctly.

**Verdict:** `foo.test.ts` and `use-foo.test.ts` are the correct, consensus spellings. The dot-suffix and `use-` prefix are exemptions to the one-hyphen rule, not violations. Document them as explicit carve-outs so the naming linter / convention doc doesn't flag legitimate files.

---

## What this means for diffgazer (actionable)

1. **Keep colocated unit tests (`foo.test.ts` next to `foo.ts`). Do not introduce `__tests__/` or a unit `tests/` root.** The repo is already on the 2026 consensus. (All workspaces.)
2. **Do NOT add per-component folders with `index.ts` barrels for grouping.** Flat colocated kebab-case files (current style) satisfy KISS/YAGNI/readability better and avoid the barrel module-graph + IDE-tab costs TkDodo and bulletproof-react flag. Keep `index.ts` barrels ONLY at the four libs' public package entry points (`libs/ui`, `libs/keys`, `libs/core`, `libs/registry`) — that is TkDodo's one sanctioned use. Audit the 144 internal `index.ts` files separately for unnecessary internal barrels (that's a different agent's lane, but flag it).
3. **Registry `testing/` subfolders are a justified exception, keep them.** Quarantining tests under `registry/.../testing/` keeps them out of the copy/shadcn handoff bundle. This is intentional handoff hygiene, not inconsistency — document it as the rule for registry-shipped source (libs/ui, libs/keys, libs/registry, libs/core registry trees).
4. **Keep per-package `tsconfig.test.json` (solution config + project references).** It is the SOTA monorepo TS-test pattern and AGENTS.md already enforces it. Don't merge tests into the production app config.
5. **Keep e2e per-app under `apps/docs/tests/e2e/*.e2e.ts` with the distinct `.e2e.ts` suffix.** Don't build a root e2e package for a single consumer (YAGNI). If apps/web adds e2e, mirror `apps/web/tests/e2e/`. Only extract a root e2e package once 2+ apps share identical Playwright config.
6. **Keep smoke tests at `scripts/monorepo/`.** Cross-package/published-artifact validation belongs at the orchestration root, never colocated.
7. **Naming rule carve-outs (write these into the convention doc):** `.test` / `.spec` / `.e2e` are extension-grammar suffixes, exempt from the one-hyphen rule. The React-mandated `use-` hook prefix is exempt too. Canonical spellings: `back-navigation.ts` → `back-navigation.test.ts`; `use-focus-trap.ts` → `use-focus-trap.test.ts`. Use `.tsx` only when the test renders JSX.

---

## Sources consulted (URLs)

1. Kent C. Dodds — Colocation: https://kentcdodds.com/blog/colocation
2. TkDodo — Please Stop Using Barrel Files: https://tkdodo.eu/blog/please-stop-using-barrel-files
3. TkDodo — Testing React Query: https://tkdodo.eu/blog/testing-react-query
4. Vitest — Getting Started: https://vitest.dev/guide/
5. Vitest — include config (default glob): https://vitest.dev/config/include
6. Vitest — In-Source Testing: https://vitest.dev/guide/in-source
7. Jest — Configuration (testMatch default): https://jestjs.io/docs/configuration
8. React docs — FAQ File Structure (colocation, "don't overthink it", max nesting): https://legacy.reactjs.org/docs/faq-structure.html
9. bulletproof-react — Project Structure: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
10. Josh W. Comeau — Delightful React File/Directory Structure: https://www.joshwcomeau.com/react/file-structure/
11. Robin Wieruch — React Folder Structure [2026]: https://www.robinwieruch.de/react-folder-structure/
12. Steven Lemon — Are TypeScript Barrel Files an Anti-pattern?: https://steven-lemon182.medium.com/are-typescript-barrel-files-an-anti-pattern-72a713004250
13. The Candid Startup — Vitest 3 Monorepo Setup: https://www.thecandidstartup.org/2025/09/08/vitest-3-monorepo-setup.html
14. The Candid Startup — Vitest Monorepo Setup: https://www.thecandidstartup.org/2024/08/19/vitest-monorepo-setup.html
15. Kyrre Gjerstad — E2E with Playwright: Monorepo vs Standard: https://www.kyrre.dev/blog/end-to-end-testing-setup
16. Nx — Introducing Playwright Support / e2e project: https://nx.dev/blog/introducing-playwright-support-for-nx
17. Corey Cleary — Where to put your tests in a Node project: https://www.coreycleary.me/where-to-put-your-tests-in-a-node-project-structure
18. Trabe/David Barral — Control what you publish in npm packages: https://medium.com/trabe/control-what-you-publish-inside-your-npm-packages-e3ec911638b8
19. bobbyhadz — Exclude test files from TS compilation: https://bobbyhadz.com/blog/typescript-exclude-test-files-from-compilation
20. JavaScript Room — Why Jest uses __tests__ folders: https://www.javascriptroom.com/blog/why-are-jest-test-naming-conventions-the-way-they-are/
21. profy.dev — Screaming Architecture / React folder structure: https://profy.dev/article/react-folder-structure
