# Barrel Files & Public API Surfaces — 2026 Consensus

Research agent: T-barrels | Date: 2026-06-04
Topic: Barrel-file backlash, the package-boundary-vs-internal rule, exports-map design for monorepo libs, and tooling to enforce no-internal-barrel policies.

---

## TL;DR consensus (cross-checked, 9+ sources)

By 2025/2026 there is a strong, near-unanimous consensus among framework maintainers (Vite, Vitest, Next.js/Vercel, Turborepo) and respected engineering voices (TkDodo, Pascal "thepassle" Schilp, Atlassian engineering, bulletproof-react):

- **Internal folder barrels (`index.ts` that re-exports siblings purely for import ergonomics) are harmful.** They slow dev servers, tests, type-checking and builds, undermine tree-shaking, and breed circular imports. Import the real file directly.
- **A barrel as a *package public entry* is the one place a barrel is acceptable** — but the modern refinement is: even at the package boundary, prefer **multiple granular subpath exports** in `package.json#exports` over a single fat `.` barrel. A single `.` barrel is "fine" only for small surface-area packages.
- **External npm packages with huge barrels** (icon/component libs) are a separate problem solved by bundler features (`optimizePackageImports`), not by you restructuring your own code.
- Enforcement exists and is mature: `eslint-plugin-no-barrel-files`, `eslint-plugin-import` boundaries, `eslint-plugin-boundaries`, `dependency-cruiser`, plus Biome/Oxlint built-ins. (Note: `sherif` does NOT do this — it lints dependency-version consistency only.)

---

## Q1 — Barrel-file backlash: tree-shaking, build/test slowdowns, circular imports. What do the docs and credible writeups conclude? (with numbers)

### Vite official docs — Performance guide
URL: https://vite.dev/guide/performance

Defines a barrel file as "files that re-export the APIs of other files in the same directory" with the example:
```js
export * from './color.js'
export * from './dom.js'
export * from './slash.js'
```
Core claim (verbatim): **"When you only import an individual API, e.g. `import { slash } from './utils'`, all the files in that barrel file need to be fetched and transformed"** — because the bundler cannot know which file holds the export without processing them all. Result: "you're loading more files than required on the initial page load, resulting in a slower page load."
Recommendation (verbatim): **"you should avoid barrel files and import the individual APIs directly, e.g. `import { slash } from './utils/slash.js'`."**
Notably the page does NOT discuss `exports` field or `sideEffects` — its scope is narrowly the dev-transform cost.

### Vitest official docs — Profiling Test Performance
URL: https://vitest.dev/guide/profiling-test-performance

States barrels are a primary cause of slow tests. If profiling logs "contain files that should not be loaded when your test is run, you might have barrel files that are importing files unnecessarily."
Quantified (verbatim): **"importing files without barrel file reduces amount of transformed files by ~85%."**
Fix: import `from '../src/utils/formatters'` not `from '../src/utils'`.
Corroborating: the Vitest team tweeted "One of the main reasons why your tests might run slower is relying on barrel files." (https://x.com/vitest_dev/status/1711334274199175567)

### TkDodo — "Please Stop Using Barrel Files"
URL: https://tkdodo.eu/blog/please-stop-using-barrel-files

The most-cited 2024/2025 writeup. Key mechanisms:
- **Synchronous full-graph load**: importing from a barrel makes "JavaScript ... traverse the `index.ts` file and load every module inside of it, synchronously." Worse when a shared package "exports a ton of things via a barrel and you only need a single module from it."
- **Circular imports**: importing from the barrel that re-exports the very file you're in "will create a circular import." He's "seen bundlers crash with the weirdest of error messages because of it."
- **Quantified anecdote (verbatim)**: "In our NextJs project, I have seen pages that were loading over 11k modules, which took 5-10 seconds to start-up the page. After we started to get rid of most of our internal barrel files, we got that down to about 3.5k modules - a reduction of 68%."
- Auto-import is the trap: "most of the time, we just auto import and leave it at whatever our editor (or copilot) decides."

### Atlassian Engineering — "How We Achieved 75% Faster Builds by Removing Barrel Files"
URL: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files

Largest quantified case study. Scale: "thousands of internal packages," changed ~90,000–100,000 files.
- Headline: **75% reduction in overall build time per commit** (CI minutes).
- "TypeScript highlighting speed improved by more than 30%."
- "Local unit testing became around 50% faster on average, with certain packages seeing up to 10x improvements."
- Unit tests: "88% fewer tests run in a typical build, dropping from 1600 to 200 tests, with 73% reduction in average runtime."
- Mechanism (verbatim): "even though you're only importing `Button`, tools like TypeScript and Jest need to process the entire barrel file. This means they must read from disk, parse, and analyze `DataTable`, `Chart`, `Form`, and all 50+ other components—plus all of their dependencies."
- Philosophy: "The best optimisation is the complexity you choose not to maintain."

### Vercel / Next.js — "How we optimized package imports in Next.js"
URL: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js

- Mechanism (verbatim): "There's a hidden cost with JavaScript runtimes in every `require(...)` and `import '...'`."
- Scale of external-lib problem (verbatim): "Some popular icon and component libraries have **up to 10,000 re-exports in their entry barrel file**." and "For many popular React packages, **it takes 200~800ms just to import them**."
- Tree-shaking caveat (verbatim): "Tree-shaking is a *bundler* feature ... not a JavaScript runtime feature." Externalized deps can't be optimized inside.
- `optimizePackageImports` results: `@material-ui/icons` dev 10.2s→2.9s; `lucide-react` 5.8s→3.0s; "`next build` runs ~28% faster"; "up to 40% faster cold starts" in serverless; a synthetic 10k-module package compiled ~7s vs ~30s.

### bulletproof-react (the owner's reference architecture) — REVERSED its stance
URL: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md (raw via githubusercontent)

Directly load-bearing for diffgazer's owner. Verbatim:
**"In the past, it was recommended to use barrel files to export all the files from a feature. However, it can cause issues for Vite to do tree shaking and can lead to performance issues. Therefore, it is recommended to import the files directly."**

It now enforces, via ESLint, two import-direction rules instead:
1. No cross-feature imports (`features/auth` cannot import `features/comments`).
2. Unidirectional architecture: "the code should flow in one direction, from shared parts of the code to the application (shared -> features -> app)."

**Conclusion Q1**: Unanimous. Internal barrels measurably degrade dev/test/build/type-check performance (Vite, Vitest ~85% fewer transforms, Atlassian 75% builds / 50% local tests, TkDodo 68% fewer modules), and cause circular-import fragility. Even the owner's chosen reference (bulletproof-react) abandoned feature barrels.

---

## Q2 — The nuanced rule: package public entry = fine, internal folder barrels = harmful. Is that the actual consensus?

Yes — but with an important 2025/2026 refinement that pushes even further.

- **TkDodo** (verbatim): "Where barrels are necessary is when you are writing a library. Libraries like `@tanstack/react-query` need a single entry point file." and "To me, this is the only place where a barrel makes sense." He explicitly says barrels "aren't made to group content of directories in your product application."
- **Marc Nuri / general consensus** echoes: a barrel is appropriate as the single entry that goes in `package.json` `main`/`exports` — the public interface — and "this is the only place where a barrel makes sense."

### The refinement (this is where credible sources go BEYOND the simple rule)
**Pascal Schilp (thepassle) — "A practical guide against barrel files for library authors"**
URL: https://dev.to/thepassle/a-practical-guide-against-barrel-files-for-library-authors-118c

Schilp argues that even the *library public entry* should usually NOT be one fat barrel:
- "if you import only one thing from that barrel file, you end up loading everything in its module graph" — this applies to library *consumers* too.
- Recommends providing "granular entrypoints for your library, with a sensible grouping of functionality" — i.e. subpath exports, not a single `.`.
- Tree-shaking is not a safety net: "you've incorrectly assumed that everybody uses a bundler for every step of their development or testing workflow." Granular entrypoints give *certainty* instead of relying on bundler heuristics; also covers CDN consumers where no tree-shaking happens.
- Side effects break tree-shaking silently: even `Math.random().toString().slice(1)` "is seen as sideeffectful and might mess with your treeshaking."

So the nuanced 2026 consensus is a spectrum, not a binary:
1. Internal folder barrels for import ergonomics → **avoid** (universal agreement).
2. A single `.` public barrel for a *small* package → acceptable / pragmatic.
3. A single `.` public barrel for a *large* multi-domain package → still bad; prefer **granular subpath exports** (`./hooks`, `./schemas/review`, etc.). This is the thepassle + Turborepo position.

**Conclusion Q2**: The "package boundary = OK, internal = bad" rule is the correct headline. The sharper, more current rule is: barrels are only for the *published surface*, and the published surface should itself be split into granular subpath exports rather than one giant re-export — especially for large packages.

---

## Q3 — package.json `exports` for internal monorepo libs: single entry vs subpath exports (`./hooks`, `./components/*`)

### Turborepo official docs — "Structuring a repository"
URL: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository

- Shows **multiple subpath exports** as the recommended shape:
  ```json
  "exports": { ".": "./src/constants.ts", "./add": "./src/add.ts", "./subtract": "./src/subtract.ts" }
  ```
- Explicit anti-barrel guidance (verbatim): **"Barrel files are files that re-export other files in the same package, creating one entrypoint for the entire package... they're difficult for compilers and bundlers to handle and can quickly lead to performance problems."**
- Two package patterns documented:
  - **Just-in-Time Packages**: "exports TypeScript directly" (source-level `exports` pointing at `./src/*.ts`); modern Node + TS can consume source.
  - **Compiled Packages**: build with a bundler (e.g. tsup) and export the built `dist`.

### Subpath exports as the explicit barrel alternative
- "Organize your library with subpath exports" (dev.to/receter): subpath exports are "a better alternative for avoiding the performance issues associated with barrel files."
- Schilp recommends wildcard subpaths when the surface is large: `"exports": { "./lib/*": "./lib/*" }`, or grouped entrypoints `./math.js`, `./timing.js`.

### Single-string `exports` = strictest boundary
- tshy (isaacs) and the general consensus: `"exports": "./index.js"` (a single string) forbids ALL subpath imports, giving the strongest encapsulation. Useful when you truly want one entrypoint and want to forbid deep imports entirely.

### tsup-built vs source-exported
- **Source-exported (Just-in-Time)**: point `exports` subpaths directly at `./src/*.ts`. Zero build step, best DX, but consumer must transpile and you lose a build-time boundary. Good for internal-only libs in apps that already bundle (Vite/Next).
- **tsup-built (Compiled/Publishable)**: each subpath maps to a `dist/*.js` + `dist/*.d.ts`. Required for anything published or consumed by a runtime that won't transpile (e.g. the `diffgazer` CLI binary, Node ESM). Set `sideEffects: false` (or an array) so consumers tree-shake; ensure tsup emits one chunk per entry (multiple entry points, not a single barrel entry) so subpaths stay independent.

### Best-practice ranking for internal monorepo libs (2026)
1. **Multiple granular subpath exports**, one file per export concept (Turborepo's recommended default; matches diffgazer's current libs/ui and libs/core).
2. Single `.` barrel acceptable only for tiny packages (e.g. a 2-symbol util).
3. Single-string `exports` when you want to *forbid* deep imports (strongest boundary).
4. Avoid `dist/index.js` that `export *` everything AND is the only entry — that re-creates the barrel problem at the package level.

**Conclusion Q3**: For tsup-built and source-exported internal libs alike, the consensus is granular subpath exports (`./hooks`, `./schemas/review`, `./components/button`), not a single fat `.` barrel. diffgazer already does this for `@diffgazer/ui` (per-component subpaths) and `@diffgazer/core` (per-domain subpaths) — that is the SOTA shape.

---

## Q4 — Tooling that enforces no-internal-barrel / no-deep-import policies

### ESLint core: `no-restricted-imports` / `typescript-eslint` `no-restricted-imports`
URL: https://eslint.org/docs/latest/rules/no-restricted-imports ; https://typescript-eslint.io/rules/no-restricted-imports/
- Zero-dependency baseline. Use `patterns` to ban importing internal barrels (e.g. ban `@diffgazer/core` bare and force `@diffgazer/core/*`), or to ban cross-feature deep paths. This is exactly what bulletproof-react uses for its unidirectional + no-cross-feature rules.

### `eslint-plugin-no-barrel-files` (art0rz)
URL: https://github.com/art0rz/eslint-plugin-no-barrel-files
- Rule `no-barrel-files` (verbatim): "Disallows common barrel-file patterns such as re-exporting imported bindings or using `export *`." Flags `export * from "./foo"`, `export { Foo } from "./Foo"`, `export { default as Moo } from "./Moo"`, and re-export of imported bindings. ALLOWS direct exports of locally-defined code (`export function Bar() {}`).
- Rule `prefer-source-imports`: "Reports imports that go through a barrel when the rule can resolve the original source module" (has autofix; `fixStyle: relative | preserve-alias | auto`).
- Rationale: "slow down builds and tests; make circular dependencies easier to introduce; make tree shaking less effective; blur module boundaries."
- **Limitation**: all-or-nothing per file glob — it has no concept of "package public entry." You must use ESLint `overrides`/`ignores` to exempt the package's public `src/index.ts` / public registry entry files.

### Other barrel-specific plugins
- `eslint-plugin-no-barrel-import` (wzhudev): forbids importing from barrel index files.
- `eslint-plugin-force-barrel-imports` (mayorandrew): the *opposite* — forces going through the barrel (visibility control). Not what diffgazer wants.
- `eslint-plugin-barrel-files` (thepassle's recommended) + `npx barrel-begone` analyzer for entrypoint bloat.
- Built-ins: **Biome** and **Oxlint** ship barrel-detection rules (no extra plugin install, Rust-fast).

### `eslint-plugin-boundaries` (javierbrea) + Nx `enforce-module-boundaries`
URL: https://github.com/javierbrea/eslint-plugin-boundaries ; https://nx.dev/docs/features/enforce-module-boundaries
- Architecture-layer enforcement: define element types (e.g. `lib`, `app`, `feature`) and an allow/deny matrix. Directly encodes diffgazer's AGENTS.md boundaries (libs/core must not import apps/* or cli/*; apps/landing only libs/ui; cli/server CLI-internal).

### `dependency-cruiser` (sverweij)
URL: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- Framework-agnostic. The most flexible: forbid rules, circular-dependency detection (the `no-circular` rule), orphan detection, "shared code only imported by one module" detection. Has `via`/`viaNot` (`viaOnly`/`viaSomeNot` in v12+) to log errors on cycles EXCEPT through known "knots (typically barrel files)" — i.e. you can grandfather existing barrel cycles while blocking new ones. `skipUnusedAnalyses` to keep it fast.

### `sherif` (QuiiBz) — IMPORTANT scope correction
URL: https://github.com/QuiiBz/sherif
- Rust, zero-config monorepo linter. It enforces **dependency-version consistency** (same dep version across packages, react/react-dom aligned), NOT barrel/import policy. Useful for the monorepo but does NOT address the barrel question. Do not rely on it for no-barrel enforcement.

**Conclusion Q4**: For diffgazer, layer the tools: `eslint-plugin-no-barrel-files` (`prefer-source-imports` autofix) for the internal-barrel ban with `overrides` exempting each package's published entry; `eslint-plugin-boundaries` (or Nx-style `no-restricted-imports` patterns) for the AGENTS.md architecture matrix; `dependency-cruiser` `no-circular` in CI as the circular-import safety net; keep `sherif` only for version consistency.

---

## What this means for diffgazer (concrete, per-workspace)

Current state (observed from package.json + filesystem):
- `@diffgazer/ui`: ~60 granular subpath exports, one per component/hook (`./components/button`, `./hooks/listbox`, `./lib/utils`). **This is the SOTA shape — keep it.** No single `.` barrel; good.
- `@diffgazer/core`: granular subpath exports per domain (`./schemas/review`, `./api/hooks`, `./forms`). Good. It DOES have a `.` entry mapping to `dist/index.js` plus a `src/index.ts` barrel — the `.` entry is fine as a curated public surface, but verify `dist/index.js` does not `export *` the entire library (that would re-introduce the barrel cost for anyone importing `@diffgazer/core` bare). Prefer consumers import the subpaths.
- `@diffgazer/keys`: `.` entry + 5 semantic subpaths (`./navigation`, `./focus-trap`). Reasonable; small surface.
- `@diffgazer/registry`, `@diffgazer/server`: small, single/few entries — fine.
- 149 internal `index.ts` files exist (notably `apps/web/src/features/*/index.ts`, `apps/web/src/features/*/hooks/index.ts`, `libs/core/src/*/index.ts`). These are the **internal barrels the consensus warns against**, especially the per-feature and per-hooks-folder ones in `apps/web` — exactly what bulletproof-react removed.

Recommendations:
1. **apps/web**: Follow bulletproof-react's own reversal. Drop the per-feature and per-hooks-folder `index.ts` barrels (`features/review/index.ts`, `features/*/hooks/index.ts`, etc.); import the concrete file. This is a Vite app — Vite docs and bulletproof-react both say this directly improves dev-server transform count and avoids feature circular imports. Keep the ESLint cross-feature + unidirectional (`shared -> features -> app`) rules instead of using barrels for "feature boundary."
2. **libs (ui/core/keys/registry)**: Keep granular subpath `exports`. Do NOT collapse them into a single `.` barrel. For `@diffgazer/core`, audit `src/index.ts`/`dist/index.js`: if it `export *`s everything, either trim it to a deliberate small surface or steer all consumers to subpaths. Each tsup entry should be its own chunk; set/verify `"sideEffects": false` (or a precise array for the CSS files in `@diffgazer/ui`) so consumers tree-shake.
3. **Enforcement**: Add `eslint-plugin-no-barrel-files` with `overrides` that exempt only the published entry files (`libs/*/src/index.ts`, public registry roots, `cli/*/src/index.tsx`). Use its `prefer-source-imports` autofix to migrate existing imports. Add `eslint-plugin-boundaries` to codify AGENTS.md (libs/core ⊄ apps/cli; apps/landing → libs/ui only; cli/server CLI-internal). Add `dependency-cruiser` `no-circular` to CI.
4. **CLI/TUI/server**: barrels at `cli/add/src/index.ts`, `cli/diffgazer/src/index.tsx`, `cli/server/src/index.ts` are the binary/package *entry* — these are the legitimate single-entry case (and they are bin targets, not import surfaces). Internal `cli/diffgazer/src/app/index.tsx` should be evaluated like any internal barrel: if it's just re-exporting for ergonomics, inline the direct imports. The barrel performance argument applies to bundled CLI/Ink code too (tsup `noExternal` bundles server into the binary — fewer transitive modules = faster bundle/startup).
5. **File naming tie-in (owner's separate concern)**: granular subpath exports reward one-concept-per-file naming (`use-navigation.ts` → `@diffgazer/keys/navigation`). The barrel removal and the single-word/one-hyphen file-naming goal reinforce each other: small focused files + explicit subpath exports = no barrel needed.

Net: diffgazer's *library* exports are already on the SOTA path (granular subpaths). The main barrel debt is the **internal `index.ts` barrels inside `apps/web/src/features` and some `libs/*/src/*` folders** — and removing those is exactly the move bulletproof-react itself made.

---

## Sources consulted (URLs)
- https://vite.dev/guide/performance
- https://vitest.dev/guide/profiling-test-performance
- https://tkdodo.eu/blog/please-stop-using-barrel-files
- https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- https://dev.to/thepassle/a-practical-guide-against-barrel-files-for-library-authors-118c
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- https://github.com/art0rz/eslint-plugin-no-barrel-files
- https://github.com/javierbrea/eslint-plugin-boundaries
- https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- https://github.com/QuiiBz/sherif
- https://typescript-eslint.io/rules/no-restricted-imports/
- https://eslint.org/docs/latest/rules/no-restricted-imports
- https://nx.dev/docs/features/enforce-module-boundaries
- https://x.com/vitest_dev/status/1711334274199175567
- https://github.com/vitejs/vite/issues/21966 (Vite 8: tree-shaking fails for barrels mixing inline exports with re-exports)
