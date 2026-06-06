# Research: Publishable TS Library & shadcn-style Registry Package Structure (2026)

Agent: T-library. Read-only on the codebase; this is the only writable location.
Date: 2026-06-04.

## Scope

Four questions about how a publishable TypeScript library + shadcn-style copy-source
registry should be organized, applied concretely to diffgazer's `libs/ui`, `libs/keys`,
`libs/core`, `libs/registry`, and `cli/add`.

---

## Repo baseline (what diffgazer already does)

Established by reading the repo directly (READ-ONLY):

- `libs/ui` separates **authored registry source** (`registry/ui/<component>/`,
  `registry/hooks/`, `registry/lib/`) from **published artifacts** (`dist/components/<name>.js`,
  `dist/hooks/<name>.js`, `dist/lib/<name>.js`) and **distributed registry JSON** (`public/r/*.json`).
- Components are authored as **grouped folders**: e.g.
  `registry/ui/tabs/{tabs.tsx, tabs-list.tsx, tabs-trigger.tsx, tabs-content.tsx, tabs-context.tsx, tabs.test.tsx, index.ts}`.
  Test colocated; `index.ts` barrel per component folder.
- `package.json` uses **per-subpath exports** (`./components/button`, `./components/tabs`, …),
  each mapping to one `dist/components/<name>.js` + `.d.ts`. `"type":"module"`,
  `"sideEffects": ["**/*.css"]`.
- `tsup.config.ts` auto-discovers entries from `registry/registry.json`, maps registry
  `type` → dist dir (`registry:ui`→`components/`, `registry:hook`→`hooks/`, `registry:lib`→`lib/`),
  uses an esbuild alias plugin to rewrite `@/lib/*`, `@/hooks/*`, `@/components/ui/*`, drops
  `.css` imports (aggregated into `styles.css`), marks `@diffgazer/keys` external, and re-injects
  `"use client"` post-build per `meta.client`. `dts:false` (declarations emitted separately).
- The **distributed registry JSON excludes tests**: `public/r/button.json` contains
  `registry/ui/button/index.ts` + `button.tsx`, **zero** `.test.` files (verified: `grep -c test` = 0
  across `public/r/*.json`). `tabs.json` files = index.ts, tabs.tsx, tabs-list.tsx, tabs-trigger.tsx,
  tabs-content.tsx, tabs-context.tsx — no test.
- `libs/keys` uses **domain-grouped** `src/` (`src/core`, `src/hooks`, `src/dom`, `src/context`,
  `src/providers`, `src/testing`) with tests colocated (`use-focus-trap.ts` + `use-focus-trap.test.ts`).
  Its `public/r/*.json` items use `target` to **flatten** copied helpers into the consumer's tree
  (e.g. `src/core/navigation-dispatch.ts` → `src/hooks/utils/navigation-dispatch.ts`), so copy
  consumers never get the library's internal `core/dom/context` split.
- Naming: shipped primitives obey ≤2-hyphen (mostly), but `registry/examples/**` and a few shipped
  files exceed the owner's "≤1 hyphen" rule: `block-bar-multi-segment.tsx`, `command-palette-auto-tones.tsx`
  (examples); `get-visible-enabled-options.ts` (3 hyphens, shipped, `registry/ui/select`);
  `sidebar-section-content.tsx`, `horizontal-stepper-context.tsx`, `use-controllable-state.ts` (2 hyphens, shipped).

---

## Q1. SOTA src/ organization for npm TS libraries (tsup/tsdown/unbuild)

### Findings

**Flat vs grouped, and the public-API / internal split.**
- The authoritative reference here is shadcn/ui's own v4 registry. Fetching
  `github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4` shows folders:
  `blocks, charts, examples, hooks, internal, lib, ui` + `registry.ts`. **shadcn itself ships an
  `internal/` folder** alongside the public categories — direct validation of the "private,
  not-exported" pattern at the SOTA reference.
- The `#`-prefixed `imports` map in `package.json` is the standardized way to keep modules private:
  "Entries in the imports field must always start with `#`… For example `"#utils/*": "./src/utils/*"`"
  ([Modules: Packages, Node.js docs](https://nodejs.org/download/release/v15.5.0/docs/api/packages.html);
  [DEV: subpath exports](https://dev.to/receter/organize-your-library-with-subpath-exports-4jb9)).
  When `exports` is defined, **all other subpaths are encapsulated** — `require('pkg/internal.js')`
  throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. So the `exports` map alone enforces the public surface;
  an `internal/` source folder simply isn't listed in `exports`.
- Public-API discipline: "whatever isn't exported from the public API is implementation detail and
  can be reorganized freely … internal APIs must not be exposed to prevent consumers from importing
  internal resources" (Angular libraries guidance,
  [angular.dev/tools/libraries/creating-libraries](https://angular.dev/tools/libraries/creating-libraries);
  [Medium: Angular Libraries entry-points](https://medium.com/@lincoln.a.m.c/angular-libraries-entry-points-path-mappings-and-workspace-configurations-96522f32fd76)).

**One-module-per-export + exports map.**
- Per-component subpath exports are the recommended tree-shaking-safe pattern. The mechanism that
  "restored tree-shaking" in real cases was "explicit exports in package.json (with separate entry
  points for each component)" ([Next.js #12557 tree shaking + barrel files](https://github.com/vercel/next.js/issues/12557);
  [The Barrel Trap, DEV](https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872)).
  diffgazer already does exactly this.

**sideEffects.**
- `sideEffects` must be set so bundlers can prune. With CSS side effects you must list the CSS rather
  than `false`: diffgazer's `"sideEffects": ["**/*.css"]` is the correct shape (a blanket `false`
  would let bundlers drop CSS-only imports). Webpack reads the **closest ancestor package.json** for
  `sideEffects`; nested package.json files (used for subpath aliasing) without it break tree shaking
  ([apollo-client #8168](https://github.com/apollographql/apollo-client/issues/8168)).

**Declaration strategy.**
- tsup's multi-entry DTS is historically fragile/slow: "Declaration files don't work with multiple
  entrypoints" ([tsup #316](https://github.com/egoist/tsup/issues/316)). Modern guidance: enable
  `isolatedDeclarations` in tsconfig so DTS can be emitted per-entry quickly (tsdown uses oxc-transform
  when `isolatedDeclarations` is on; "recommended if speed is critical")
  ([tsdown dts docs](https://tsdown.dev/options/dts); [TS #47947 isolatedDeclarations](https://github.com/microsoft/TypeScript/issues/47947)).
  diffgazer's `dts:false` + separate declaration build is a deliberate, valid split.

### What this means for diffgazer (Q1)
- Keep `libs/ui` per-subpath exports and `sideEffects:["**/*.css"]` — already SOTA.
- The **authored layout (grouped `registry/ui/<name>/`) is fine and ahead of the curve**; shadcn v4
  even adds `internal/`. For `libs/core` (a normal npm-style lib, not registry-distributed), consider
  an explicit public surface: only the subpaths you intend as API in `exports`, everything else
  implicitly private. An `#internal/*` imports map is the standards-based way to name private modules
  if/when deep relative imports get noisy.
- If DTS build time becomes a problem, turn on `isolatedDeclarations` rather than fighting tsup multi-entry DTS.

---

## Q2. How shadcn-ui organizes its registry source

### Findings (cross-checked: GitHub tree fetch + shadcn docs + DeepWiki)

- **Top-level under a style:** `apps/v4/registry/new-york-v4/{ui, hooks, lib, blocks, charts, examples, internal}`
  + `registry.ts` (verified by GitHub tree fetch).
- **Components are single files** in `ui/` (e.g. `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`) —
  a `_registry.ts`/`registry.ts` indexes them. (Verified by the `new-york-v4/ui` tree fetch; only
  `.tsx` files, no per-component subfolders, no colocated tests.)
- **Build output is separate:** authored `apps/v4/registry/` → distributed JSON in `apps/v4/public/r/`.
  `build-registry.mts` generates per-base/style combos, runs `transformIcons`/`transformStyle`, emits
  artifacts to `public/r/` (DeepWiki: shadcn-ui/ui component-registry).
- **Registry item types** (from [registry-item.json docs](https://ui.shadcn.com/docs/registry/registry-item-json)):
  `registry:ui` (single-file primitives), `registry:component` (simple components),
  `registry:block` (multi-file), `registry:hook`, `registry:lib`, `registry:page`, `registry:file`,
  `registry:theme`, `registry:style`, `registry:base`, `registry:font`, `registry:item`.
- **Import targeting:** the `target` property places files in the consumer; placeholders `@ui/`,
  `@components/`, `@lib/`, `@hooks/` "resolve to" dirs configured in the consumer's `components.json`;
  the CLI reads `components.json` to pick target paths. `target` is required only for `registry:page`
  and `registry:file`.
- **Larger registries** use `include` to compose multiple `registry.json` files; structure mirrors
  `components/ui/{button.tsx,…}` + `hooks/` ([shadcn registry getting-started](https://ui.shadcn.com/docs/registry/getting-started)).
- **No tests/stories in the registry tree** at shadcn (the `ui/` listing is `.tsx` only).

### What this means for diffgazer (Q2)
- diffgazer's `registry/ui/<component>/` (grouped folder) **diverges from shadcn's single-file `ui/`**.
  This is a deliberate, defensible choice: diffgazer ships compound components (tabs has 5 parts) and
  wants per-part files + colocated test + folder-level `index.ts`. shadcn keeps a compound component in
  one big file. Both are valid; diffgazer's is more SRP/readable, shadcn's is fewer files. Keep the
  folder approach — it matches the owner's "small focused files" goal — but be aware it is *not* the
  literal shadcn layout, so don't claim "same as shadcn."
- diffgazer already uses the standard `$schema` and registry types in `public/r/*.json` — correct and
  interoperable with the shadcn CLI ecosystem.

---

## Q3. Tests and stories placement (colocated vs separate; registry copies)

### Findings

- **Colocation is the 2025/2026 consensus for authored source.** Kent C. Dodds
  ([kentcdodds.com/blog/colocation](https://kentcdodds.com/blog/colocation)): "To help enable a more
  maintainable codebase, we should co-locate our tests files with the file or group of files they are
  testing." Core principle: "Place code as close to where it's relevant as possible." He keeps
  `component.js` + `component.test.js` adjacent, and supports grouping related modules into a folder
  with a README.
- **Documented tradeoff:** colocation can clutter, and "build systems may inadvertently include tests
  in production builds" (the colocation cross-language survey,
  [Medium: Colocation of Tests](https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8)).
  This is exactly why a registry/library must *exclude* tests from the distributed/built output.
- **Registry-distributed components keep tests OUT of copied source.** shadcn's `ui/` has no test files;
  diffgazer's distributed `public/r/*.json` provably excludes `.test.*` (verified grep). Community
  guidance: a copy step that filters source "excluding `.test.ts`, `.spec.ts`" before `shadcn build`
  ([shadcn registry build search results]; [OpenStatus registry blog](https://www.openstatus.dev/blog/shadcn-component-registry)).
- **Stories:** Same rule — stories live next to source for DX but are excluded from both the npm dist
  and the registry JSON (treated like tests). No source disagreed with this.

### What this means for diffgazer (Q3)
- Keep tests colocated in `registry/ui/<name>/<name>.test.tsx` and `libs/keys/src/**/*.test.ts` —
  this is correct and matches Kent C. Dodds. The owner's "module-in-its-own-folder (component+test+index)"
  instinct is explicitly endorsed by Dodds for grouped modules.
- The **load-bearing invariant**: tests/stories must never enter `dist/` or `public/r/*.json`. diffgazer's
  registry-build already enforces this (verified). Keep an assertion/test that fails if any `public/r`
  item references a `.test.`/`.stories.` path, so it can't regress.

---

## Q4. One library shipping BOTH as npm package AND copy-source registry

### Findings — two industry patterns

**Pattern A — package-name alias, rewritten to `@/` (OpenStatus).**
- `packages/ui` doubles as a working internal package and a public registry source. Internal apps import
  `@openstatus/ui/components/ui/button`; the registry build rewrites that to `@/components/ui/button`
  with "a simple regex" before `shadcn build`, then copies JSON into the Next app's `public/`
  ([OpenStatus blog](https://www.openstatus.dev/blog/shadcn-component-registry)). Three stages:
  transform (copy to `dist/` + rewrite imports), `shadcn build`, copy to web.

**Pattern B — `@/` aliases in authored source, rewritten two ways (shadcn-native; diffgazer).**
- Author with `@/lib/utils`, `@/components/ui/*`, `@/hooks/*` (the shadcn convention). Then:
  - **npm path:** a bundler alias plugin resolves `@/…` into real files at build (diffgazer's tsup
    `aliasPlugin` resolves `@/lib/<n>`→`registry/lib/<n>.ts`, `@/components/ui/<n>`→`registry/ui/<n>/index.ts`,
    and maps keys hooks to `external @diffgazer/keys`).
  - **copy path:** the registry JSON keeps `@/…` import specifiers (the consumer's tsconfig resolves
    them) and uses per-file `target` to flatten internal structure into the consumer tree (diffgazer's
    `keys` registry maps `src/core/*`→`src/hooks/utils/*`).

**No deep relative imports in registry source — the hard rule.**
- The AGENTS.md contract already states: "Public `libs/keys/public/r` TypeScript content must not emit
  relative `.js` import specifiers that break copy/shadcn consumers" and "If a component depends on keys
  utilities in copy mode, public UI registry source must rewrite package imports to local copied
  hook/utility paths." This is the right rule: copy-source must use **alias imports** (`@/…`) or
  **target-flattened local paths**, never `../../core/foo.js`, because the consumer doesn't have the
  library's folder tree.
- Standards backing: once `exports` is set, deep paths into a package are blocked anyway
  ([Node.js packages docs](https://nodejs.org/download/release/v15.5.0/docs/api/packages.html);
  [ethers discussion #4163](https://github.com/ethers-io/ethers.js/discussions/4163)) — so the npm path
  also must not rely on deep relatives crossing the public surface.

### Disagreement between A and B
- A (package-name alias) is simpler to grep and keeps a single import style internally, but requires a
  rewrite step and is *not* what a shadcn consumer expects to read.
- B (`@/` aliases) authors in the exact shape consumers receive (zero rewrite for the copy path's import
  text), at the cost of a bundler alias plugin for the npm path. **B is more SOTA for a dual-publish
  library** because the copy-source is already idiomatic shadcn and needs no import-text rewriting —
  only path `target` remapping. diffgazer uses B. Keep it.

### What this means for diffgazer (Q4)
- Keep Pattern B. The tsup alias plugin + registry `target` remapping is the cleaner dual-publish design.
- Enforce, in CI, that no `public/r` file `content` contains a relative `../` or `./*.js` specifier that
  escapes its own copied folder (the `validation/registry-import-validator.ts` in `libs/ui/src/validation`
  is the right home for this — it already exists).
- For compound components copied as a folder, the per-component `index.ts` barrel is fine for the **copy
  path** (consumer gets one folder), but for the **npm path** prefer importing the concrete file in the
  bundler alias (diffgazer resolves `@/components/ui/<n>`→`<n>/index.ts`, acceptable because it's bundled,
  not re-exported to the consumer's bundler).

---

## File naming (owner's open question c)

### Findings
- kebab-case filenames are the 2025/2026 web standard; "Next.js, Tailwind, ShadCN, and Chakra UI have
  shifted to kebab casing" ([DEV: kebab-case filenames](https://dev.to/adarshasnah/kebab-case-filenames-and-pascalcase-classes-naming-conventions-that-scale-7dp);
  [Biome useFilenamingConvention](https://biomejs.dev/linter/rules/use-filenaming-convention/)).
- **Suffix conventions are universal and expected:** `.test.ts`/`.spec.ts` are interchangeable and
  tool-detected; Jest/Vitest default to `.test.ts`
  ([javaspring.net test naming](https://www.javaspring.net/blog/what-is-the-convention-for-javascript-test-files/)).
  Hook files use the `use-` prefix in kebab-case (`use-auth.ts`) — this is the documented React
  convention, and the `use` does **not** count as a "word that should be removed"
  ([Stackademic: React hook naming](https://blog.stackademic.com/react-hook-naming-conventions-best-practices-and-guidelines-32ac80c1580e)).
- **Descriptive > terse:** "the most important aspect is clarity and descriptive naming … clear Hook
  names convey purpose, reducing the need for comments." No reputable source advocates forcing
  single-word filenames at the cost of clarity.

### What this means for diffgazer (naming)
- The owner's "≤1 hyphen / ideally single-word" rule is **stricter than any industry convention** and
  conflicts with two universal patterns: `.test.ts` (a dotted suffix, not a hyphen — compatible) and
  `use-x.ts` hooks (one hyphen for `use-auth`, **two** for `use-focus-trap`, `use-controllable-state`).
  The rule cannot coexist with descriptive multi-word hooks/components without harming readability.
- Concrete recommendation: **scope the hyphen rule to "one *semantic* hyphen beyond required prefixes/
  suffixes"** — i.e. treat `.test`/`.stories` suffixes and the `use-` hook prefix and the
  `<component>-<part>` compound-component convention as not counting against the limit. Otherwise
  diffgazer must rename `use-focus-trap`, `use-controllable-state`, `sidebar-section-content`,
  `horizontal-stepper-context`, `get-visible-enabled-options`, and every `tabs-trigger` style part —
  which *reduces* readability and breaks the established shadcn `<name>-<part>.tsx` idiom.
- Files genuinely worth flagging under the spirit of the rule are the over-long **example** names
  (`command-palette-auto-tones.tsx`, `block-bar-multi-segment.tsx`) in `registry/examples/**`, which are
  docs fixtures, not shipped primitives — low priority.

---

## Cross-source disagreements (controversies)

1. **Component = single file (shadcn) vs grouped folder (bulletproof-react / diffgazer).**
   shadcn keeps `button.tsx` flat; bulletproof-react and diffgazer group related files into a folder
   with optional `index.ts`. Both are mainstream. Folder grouping wins on SRP/readability for compound
   components; flat wins on file count and matches the literal shadcn registry.
2. **Barrel `index.ts`: convenience vs tree-shaking hazard.** bulletproof-react says "import the files
   directly" to protect Vite tree-shaking; Angular-style guidance uses barrels as the public-API surface.
   Resolution for libraries: barrels are fine **per leaf module/component folder** and as the explicit
   public entry, but a **single mega-barrel re-exporting everything is the documented hazard** (Atlassian
   75% faster builds, 400KB savings after removing one). diffgazer's per-component `index.ts` + per-subpath
   `exports` is the safe middle.
3. **Author `@/` aliases (shadcn-native, Pattern B) vs author package-name imports (OpenStatus, Pattern A).**
   Disagreement on which import style to author in for a dual-publish lib. B keeps copy-source idiomatic;
   A keeps internal imports greppable. diffgazer uses B.
4. **Strict single-word/one-hyphen filenames vs descriptive kebab-case with suffix/prefix conventions.**
   The owner's rule vs the entire ecosystem (`.test.ts`, `use-x.ts`, `<name>-<part>.tsx`). Industry sides
   with descriptive + conventional suffixes.

---

## Net "what this means for diffgazer"

1. `libs/ui` package shape is already SOTA: per-subpath `exports`, `sideEffects:["**/*.css"]`,
   tsup alias rewriting, tests excluded from `public/r`. Don't change the fundamentals.
2. Keep grouped component folders + colocated tests + per-folder `index.ts`. This matches Kent C. Dodds
   and the owner's instinct; it is *more* readable than shadcn's single-file style. Just don't call it
   "identical to shadcn."
3. shadcn v4 itself ships an `internal/` folder — adopt the same idea where useful: for `libs/core`,
   define the public surface via `exports` and keep everything else implicitly private; use a
   `#internal/*` imports map only if deep relatives get noisy.
4. Dual-publish: keep Pattern B (`@/` aliases authored, rewritten by tsup for npm, kept + `target`-flattened
   for copy). Enforce "no escaping relative imports in `public/r` content" in
   `libs/ui/src/validation/registry-import-validator.ts`.
5. Relax the one-hyphen rule to exempt `.test`/`.stories` suffixes, the `use-` hook prefix, and the
   `<component>-<part>` compound idiom; otherwise mass renames would *hurt* readability and break the
   shadcn `<name>-<part>` convention. Apply the strict spirit only to over-named docs examples.
6. Bulletproof-react's feature-folder + unidirectional `shared→features→app` model is for **applications**
   (it self-describes Next/Remix/RN apps, never libraries). It maps onto `apps/web` and `apps/docs`, not
   onto `libs/*` or `cli/*`. For libs, the right analogue is "public-API surface → internal modules,"
   enforced by the `exports` map rather than ESLint `import/no-restricted-paths`.

---

## Sources consulted (URLs)

- shadcn registry source tree (GitHub): https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4 (folders: ui, hooks, lib, blocks, charts, examples, **internal**)
- shadcn ui components tree (single files): https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui
- shadcn registry root: https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry
- shadcn registry-item.json (types, target, aliases): https://ui.shadcn.com/docs/registry/registry-item-json
- shadcn registry getting-started (include, multiple registry.json): https://ui.shadcn.com/docs/registry/getting-started
- shadcn registry intro: https://ui.shadcn.com/docs/registry
- DeepWiki shadcn component registry (build-registry.mts): https://deepwiki.com/shadcn-ui/ui/4-component-registry
- OpenStatus dual registry build (import rewrite, 3-stage pipeline): https://www.openstatus.dev/blog/shadcn-component-registry
- Kent C. Dodds, Colocation: https://kentcdodds.com/blog/colocation
- bulletproof-react project structure (features, no-barrel, app-scoped): https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- Node.js Modules: Packages (exports encapsulation, # imports): https://nodejs.org/download/release/v15.5.0/docs/api/packages.html
- DEV: Organize your library with subpath exports: https://dev.to/receter/organize-your-library-with-subpath-exports-4jb9
- apollo-client #8168 nested package.json break tree shaking: https://github.com/apollographql/apollo-client/issues/8168
- ethers discussion #4163 (subpath not in exports): https://github.com/ethers-io/ethers.js/discussions/4163
- Next.js #12557 tree shaking + barrel files: https://github.com/vercel/next.js/issues/12557
- The Barrel Trap (explicit imports): https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872
- Hidden Costs of Barrel Files: https://articles.wesionary.team/the-hidden-costs-of-barrel-files-25de560b9f63
- tsup #316 (multi-entry DTS): https://github.com/egoist/tsup/issues/316
- tsdown DTS (isolatedDeclarations): https://tsdown.dev/options/dts
- TypeScript #47947 isolatedDeclarations: https://github.com/microsoft/TypeScript/issues/47947
- tsup docs: https://tsup.egoist.dev/
- Angular creating libraries (public-api): https://angular.dev/tools/libraries/creating-libraries
- Biome useFilenamingConvention: https://biomejs.dev/linter/rules/use-filenaming-convention/
- DEV: kebab-case filenames: https://dev.to/adarshasnah/kebab-case-filenames-and-pascalcase-classes-naming-conventions-that-scale-7dp
- javaspring.net test naming (.test vs .spec): https://www.javaspring.net/blog/what-is-the-convention-for-javascript-test-files/
- Stackademic React hook naming (use- prefix, descriptive): https://blog.stackademic.com/react-hook-naming-conventions-best-practices-and-guidelines-32ac80c1580e
- Colocation of Tests cross-language (build inclusion tradeoff): https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8
- Robin Wieruch React Folder Structure 2026: https://www.robinwieruch.de/react-folder-structure/
