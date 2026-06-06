# Research: File naming conventions — kebab-case, name length, suffix patterns, index files (2026)

Agent: T-naming. Read-only on the codebase; this file is the only write target.
Date: 2026-06-04.

## Scope of repo evidence (what diffgazer already does)

Sampled existing names (all kebab-case, frequently multi-hyphen, content-matched):

- `libs/keys/src/hooks/use-action-row-navigation.ts` (3 hyphens) exports `useActionRowNavigation`.
- `libs/keys/src/hooks/use-scoped-navigation.ts`, `use-focus-trap.ts`, `use-focus-restore.ts`, `use-scroll-lock.ts`.
- `libs/keys/src/core/normalize-key-input.ts`, `list-navigation.ts`, `navigation-directions.ts`, `navigation-dispatch.ts`.
- `libs/ui/src/validation/registry-import-validator.ts`, `registry-orphan-validator.ts`, `registry-exports-validator.ts`, `registry-validation-fs.ts`.
- `libs/core/src/result.ts`, `errors.ts`, `format.ts`, `strings.ts`, `json.ts`, `env.ts`, `get-figlet.ts`; subfolders `footer/`, `forms/`, `providers/` each with `index.ts` barrels and `use-*.ts` hooks; `providers/use-provider-models-mapped.ts`.
- `cli/add/src/commands/{add,remove,list,diff,init}.ts` (single-word command files — matches oclif convention), `commands/add/{file-ops,css-ops,manifest}.ts`, `utils/{transform,detect,registry,paths,hashing,namespaces,integration,add-integration}.ts`.
- `apps/web/src/app/routes/{home,review,history,settings,onboarding,help}.tsx`, `routes/__root.tsx` (TanStack Router file-based routing), `app/providers/{theme-provider,config-provider}.tsx`, `lib/{api,query-client,back-navigation,config-guards,config-guard-cache}.ts`, `hooks/use-theme.ts`.

Observations:
- Test files: `*.test.ts(x)` middle-extension suffix everywhere.
- Type files: `types.ts` per-folder (e.g. `libs/core/src/footer/types.ts`), not `x.types.ts`.
- Barrels: `index.ts` is used as folder public entry in libs and in `apps/web` feature/provider folders.
- Tooling: repo uses Biome (`biome.root.json`) not ESLint+unicorn. Biome's `useFilenamingConvention` is the relevant linter.
- The repo ALREADY violates the owner's proposed "at most one hyphen / single word" rule in many high-quality places (e.g. `use-action-row-navigation.ts`, `registry-import-validator.ts`). These names are good by every source below; a hyphen cap would degrade them.

---

## Q1 — Is kebab-case the 2026 consensus for TS/React file names? Is PascalCase dead?

CONSENSUS: kebab-case for FILE names is the dominant 2026 convention across the JS/TS/React ecosystem.
The exported SYMBOL stays PascalCase for components and `useX` camelCase for hooks. So PascalCase
is alive and well for identifiers, but PascalCase FILE names are in decline.

Evidence:
- eslint-plugin-unicorn `filename-case`: default is `kebabCase`. Supports kebabCase / camelCase / snakeCase / pascalCase. `index.*` files are auto-ignored "as they can't change case." No hyphen-count or length rule exists. (https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md)
- bulletproof-react `project-standards.md` enforces kebab-case for files AND folders via `check-file` plugin:
  ```js
  'check-file/filename-naming-convention': ['error', { '**/*.{ts,tsx}': 'KEBAB_CASE' }, { ignoreMiddleExtensions: true }],
  'check-file/folder-naming-convention': ['error', { 'src/**/!(__tests__)': 'KEBAB_CASE' }],
  ```
  No PascalCase component-file exception. `ignoreMiddleExtensions: true` is what lets `smoke.spec.ts` / `babel.config.js` pass. (https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md)
- Next.js community + docs convention: kebab-case for files/folders (URL/SEO/cross-platform friendly), PascalCase for the exported component. "The component's filename will be kebab-case, but the component's exported name should be PascalCase." (https://www.piyushgambhir.com/blogs/next-js-naming-conventions, https://shipixen.com/blog/nextjs-file-naming-best-practices)
- Angular v20 (2025 RFC) — the framework that POPULARIZED PascalCase-ish `feature.type.ts` — now uses dash-separated lowercase names and drops type suffixes in its own examples; rationale: "closer to React and other TS-based frameworks." This is a major convergence signal toward kebab-case. (https://github.com/angular/angular/discussions/59522, https://angular.dev/style-guide)
- Biome `useFilenamingConvention` default accepts camelCase | kebab-case | snake_case | or the exported symbol name. kebab-case explicitly allowed. (https://biomejs.dev/linter/rules/use-filenaming-convention/)

OUTLIER (controversy): Google TypeScript Style Guide leans snake_case ("files are `snake_case`", shown via `import * as fooBar from './foo_bar'`). It does NOT mandate kebab-case. Google is the main authoritative dissent from kebab. But Google is an internal-monorepo style and is not where the open-source React/TS community landed. (https://google.github.io/styleguide/tsguide.html)

PascalCase-file holdouts: a meaningful minority still uses `MyComponent.tsx` so file name === component name (helps Go-to-File, makes the component obvious). Sources call this "still common in React" but increasingly a team-preference rather than a best practice. The hybrid (kebab file + PascalCase export) is described as "gaining traction." (https://medium.com/@sadeqshahmoradi76/pascalcase-or-kebab-case-..., https://rajithasanjayamal.medium.com/naming-conventions-best-practices-in-react-..., https://bressain.com/blog/kebab-casing/)

Verdict for diffgazer: kebab-case files are already the repo standard and match the 2026 consensus. Keep PascalCase only for the exported component identifier, never the file name. No change needed; just keep it enforced.

---

## Q2 — Hyphen-count cap vs "short but meaningful, content-matched" names

FINDING: An explicit "at most one hyphen" or "single-word" file-name cap is NOT a recognized practice
in ANY authoritative source reviewed. None of unicorn, bulletproof-react/check-file, Biome, Google TS,
Angular, or Next.js impose or recommend a hyphen-count or word-count limit. Linters cap CASE, not LENGTH.

The recognized practice is the opposite framing: names must be DESCRIPTIVE and CONTENT-MATCHED, "short
but meaningful," and abbreviation is discouraged. A hard hyphen cap directly conflicts with this because
it forces abbreviation or vaguer names.

Evidence (the real naming-quality rules that DO exist):
- Google TS Style Guide: "Names *must* be descriptive and clear to a new reader. Do not use abbreviations that are ambiguous or unfamiliar to readers outside your project, and do not abbreviate by deleting letters within a word." (https://google.github.io/styleguide/tsguide.html)
- "Don't Write Utils" (Douglas Parsons): name files/dirs by WHAT THEY CONTAIN, not how they're used. "These names [utils, shared, common, helpers, lib] are all to do with intent, rather than describing what the code is." Vague names "enable lazy thinking" and become dumping grounds. Standard libraries have no `utils`. (https://dev.to/dglsparsons/don-t-write-utils-...)
- "Stop naming your modules utils" / Dunghill anti-pattern: a filename that carries no information about its contents (e.g. `misc.ts`) is a code smell; split into specific files like `string-formatters.ts`, `validation-rules.ts`. (https://breadcrumbscollector.tech/stop-naming-your-python-modules-utils/, https://mattilehtinen.com/articles/dunghill-anti-pattern-...)
- React naming guides: hook files should be the kebab form of the hook, multi-word is fine: "`use-local-storage.ts` is perfectly aligned with best practices." Long descriptive hook names are explicitly endorsed "within reason of length." (https://www.sufle.io/blog/naming-conventions-in-react)
- File-name-matches-exported-symbol is an actual recognized rule (Biome `export` case; common React guidance "file name should match the main exported component"). This is the closest thing to a hard rule and it pushes toward content-matching, not toward shortness. (https://biomejs.dev/linter/rules/use-filenaming-convention/)

Concrete diffgazer conflict: `use-action-row-navigation.ts` (3 hyphens) exactly mirrors `useActionRowNavigation`.
Under a one-hyphen cap it would have to become something like `use-rownav.ts` / `use-action-nav.ts` —
an abbreviation/loss of meaning that every source above warns against. Same for
`registry-import-validator.ts` -> would be forced into a worse name.

Verdict for diffgazer: DROP the hyphen-count cap as a hard rule. Replace it with the defensible rules the
ecosystem actually endorses: (1) kebab-case; (2) name the file after the concept/primary export it contains;
(3) prefer short, but never at the cost of clarity — descriptive multi-hyphen names are correct;
(4) ban grab-bag names `utils.ts`/`helpers.ts`/`common.ts`/`misc.ts`/`lib.ts` as folder dumping grounds and
prefer concept-named files. The owner's *aesthetic preference* for short/single-word names is fine as a
soft tie-breaker ("if two names are equally clear, pick the shorter"), not as an enforced cap.
NOTE: the repo already has `cli/add/src/utils/` and `apps/web/src/lib/`, `apps/web/src/utils/` — these are
the grab-bag folders the literature warns about; the *files inside* are concept-named (good), but the folder
names themselves are the weak spot, not the hyphen counts.

---

## Q3 — Suffix conventions (use-x.ts, x.types.ts, x.test.ts, x.schema.ts, x.store.ts): recommended or discouraged in 2026?

CONSENSUS: Two suffixes are universal/recommended; the rest are team-preference and should be used only
when they earn their keep.

- `use-x.ts` for hooks: RECOMMENDED and near-universal. Keeps the file name aligned with the `useX` export, makes hooks greppable. (sufle.io, Next.js naming guides)
- `x.test.ts` / `x.spec.ts`: RECOMMENDED and universal. These are "middle extensions" — linters treat `my-file.test.ts` as name `my-file` + extensions `.test.ts`. bulletproof-react's `ignoreMiddleExtensions: true` and Biome's "consecutive extensions" model both exist specifically to allow this. The repo already uses `.test.ts(x)` everywhere. (bulletproof-react project-standards; https://biomejs.dev/linter/rules/use-filenaming-convention/)
- `x.types.ts`, `x.constants.ts`, `x.schema.ts`, `x.store.ts`, `x.utils.ts`: RECOGNIZED but OPTIONAL. They're documented as a coherent system (component-colocated `Foo.types.ts`, `Foo.constants.ts`, etc.) where the suffix marks "internal derivative — only reach it through the public API." (https://dev.to/damiansiredev/file-naming-conventions-..., https://www.webdevtutor.net/blog/typescript-type-file-naming-convention)
  - Caveat (controversy): these dot-type suffixes are the SAME pattern Angular just walked back. Angular v20 explicitly stopped using `.service`/`.component`/`.module` suffixes because "IDEs have become good enough to find what we need, no matter the file name." So suffix-heavy naming is trending DOWN, not up. (Angular RFC 59522)

How they coexist with short names: middle-extension suffixes do NOT count against "short names" — the *base
name* stays short (`use-key.ts`, `keys.test.ts`, `review.schema.ts`). They're orthogonal to kebab-case and
to any length preference.

Verdict for diffgazer:
- KEEP `use-*.ts` and `*.test.ts` — already in use, matches consensus.
- The repo currently uses bare `types.ts` per folder (e.g. `libs/core/src/footer/types.ts`) rather than `footer.types.ts`. That's fine and arguably cleaner inside a one-concept folder. Don't introduce `x.types.ts` dot-suffixes repo-wide; it adds suffix noise the ecosystem is moving away from. Use `schema.ts`/`types.ts`/`store.ts` as plain concept files inside the owning folder, reserving dot-suffixes only where a file genuinely co-locates next to a sibling of the same base name and you need to disambiguate (rare here).
- For Zod schemas in `libs/core`, a `*.schema.ts` suffix is defensible ONLY if schemas and their types/runtime live in separate sibling files with a shared base; otherwise prefer a concept name like `review.ts` / `config.ts`.

---

## Q4 — index.ts as folder entry: good vs harmful

CONSENSUS (2026): index.ts barrels are GOOD as a single public entry point for a published LIBRARY, and
HARMFUL/discouraged as per-folder barrels inside APP code.

Evidence:
- TkDodo "Please Stop Using Barrel Files": "Where barrels are necessary is when you are writing a library." For app code they hurt. Concrete harms he measured: a Next.js page pulled 11,000+ modules via barrels (5–10s dev startup); removing internal barrels cut to ~3,500 modules (~68% fewer). Also: circular-import crashes (auto-import makes accidental cycles likely), and tree-shaking failures. (https://tkdodo.eu/blog/please-stop-using-barrel-files)
- Bundle-size case studies: 752 kB -> 186 kB and 210 kB -> 47 kB after removing barrels; barrels impede tree-shaking. (https://articles.wesionary.team/the-hidden-costs-of-barrel-files-...)
- "A practical guide against barrel files for library authors" (Pascal Schilp): even library authors should be careful — a single big barrel forces consumers to load everything; prefer multiple entry points / `exports` map subpaths. (https://dev.to/thepassle/a-practical-guide-against-barrel-files-for-library-authors-118c)
- Editor/debugger ergonomics: many open `index.ts` tabs are indistinguishable ("editor tabs all say index.ts, which tells you nothing"); Go-to-Definition lands on the barrel rather than the real source. (https://medium.com/@aleksandr_ross/why-i-will-not-use-index-files-in-2025-..., https://krishnavadlamudi44.medium.com/the-index-ts-dilemma-...)

Verdict for diffgazer:
- KEEP a single top-level `src/index.ts` barrel as the PUBLIC entry for each published lib: `libs/core`, `libs/keys`, `libs/ui`, `libs/registry`. That's exactly the case the consensus blesses.
- For libs, prefer the package `exports` map with subpath entry points over one mega-barrel where the public API is large (mitigates the "consumers load everything" problem and improves tree-shaking for copy/package consumers — directly relevant to `libs/ui`/`libs/keys` registry handoff).
- AVOID/trim per-folder internal `index.ts` barrels inside app code (`apps/web`, `apps/docs`, `apps/landing`) and inside CLI internals (`cli/*`). The repo has internal barrels like `apps/web/src/app/providers/index.tsx`, `libs/core/src/footer/index.ts`, `forms/index.ts`, `providers/index.ts`. Inside a published lib these are tolerable if they only feed the top-level barrel, but they're the exact thing that creates tab-soup and cycle risk. Prefer direct deep imports within the same package.
- Do NOT route INTRA-package imports through the package's own barrel (the cause of TkDodo's cycles + slow dev). Within `libs/core`, import `./result` directly, not `@diffgazer/core`.

---

## Q5 — Dot-segments (foo.service.ts, NestJS) vs hyphen segments (foo-service.ts)

CONSENSUS (2026): For multi-WORD names, use hyphens (kebab-case): `foo-service.ts`. Reserve the DOT for
true "kind" middle-extensions that tooling understands (`.test`, `.spec`, `.d`, `.config`, and optionally
`.types`/`.schema`). Do NOT use the dot as a generic word separator.

Evidence:
- Angular (origin of the dot-type convention) v20 moved AWAY from `*.component.ts`/`*.service.ts` toward role/domain names like `auth-store`, `user-api`, `data-access` (hyphen segments, no type dot). It now makes "no statement" about type suffixes and its own examples omit them. The clearest signal that even the home of dot-suffixes considers them optional/legacy in 2025+. (https://github.com/angular/angular/discussions/59522, https://angular.dev/style-guide)
- NestJS still uses `user.service.ts` / `create-user.dto.ts`: note it mixes BOTH — hyphens for multi-word base (`create-user`) and a dot for the type kind (`.dto`, `.service`). So even NestJS uses hyphens for words and dots only for the kind. (https://medium.com/@nairi.abgaryan/..., https://mahabub-r.medium.com/...)
- Tooling reality: linters parse `name.kind.kind.ext` (Biome "consecutive extensions"; bulletproof `ignoreMiddleExtensions`). A dot used as a word separator (`foo.bar.ts` meaning "foo bar") confuses the name-vs-extension split and the linter would treat `bar` as a middle extension. So dots-as-word-separators is actively fragile with modern tooling. (https://biomejs.dev/linter/rules/use-filenaming-convention/)

Verdict for diffgazer: This is a non-issue — the repo already uses hyphen segments (`back-navigation.ts`,
`config-provider.tsx`, `registry-import-validator.ts`) and dots only for `.test`. Keep that. Do not adopt
NestJS-style `.service`/`.controller` dots in `cli/server` or anywhere; use domain/role hyphen names
(e.g. `review-pipeline.ts`, `git-runner.ts`, `shutdown-token.ts`) which also fits the CLI-internal,
non-framework nature of `cli/server`.

---

## Bonus — does bulletproof-react structure / kebab apply to CLI/TUI/server? (cross-cutting, relevant to owner's open questions)

- CLI: oclif (the dominant Node CLI framework) puts commands in `src/commands/<name>.ts` where the file
  name IS the command name. diffgazer's `cli/add/src/commands/{add,remove,list,diff,init}.ts` already matches
  this exactly — single-word command files are correct here, and they happen to satisfy the owner's
  "single word" wish naturally because commands ARE single words. (https://oclif.io/docs/introduction/)
- The kebab-case file rule is FRAMEWORK-AGNOSTIC (it's about the filesystem/cross-platform/readability, not
  about React). So it applies uniformly to `cli/*`, `cli/server` (Hono), and TUI (Ink) code. Nothing about
  Hono or Ink suggests a different file-casing convention.
- bulletproof-react's *feature-folder* architecture is a frontend-app idea; its FILE-NAMING rules (kebab files
  + kebab folders) generalize cleanly to CLI/server/libs. Use bulletproof for naming everywhere, but don't
  force its `features/` app layout onto CLI command trees or library `src/` layouts.

---

## What this means for diffgazer (actionable)

1. Keep kebab-case files + kebab-case folders everywhere (web, docs, landing, cli/*, libs/*). Already true; enforce via Biome `useFilenamingConvention` with `filenameCases: ["kebab-case"]` plus `export` (so `index.ts` and symbol-matched files pass), and rely on consecutive-extension handling for `.test.ts`.
2. Drop the "at most one hyphen / single word" hard cap. It conflicts with the repo's own good names (`use-action-row-navigation.ts`, `registry-import-validator.ts`) and with every authoritative naming-quality rule (descriptive, content-matched, no abbreviations). Keep "short if equally clear" as a soft tie-breaker only.
3. Adopt the real rules instead: file name = the concept / primary export; ban grab-bag basenames (`utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib.ts`); reconsider the grab-bag FOLDER names `cli/add/src/utils/` and `apps/web/src/{lib,utils}/` — rename to concept folders or split (the files inside are already concept-named, so this is low-cost).
4. Keep `use-*.ts` and `*.test.ts`. Don't roll out `x.types.ts`/`x.schema.ts` dot-suffixes repo-wide — the ecosystem (esp. Angular v20) is moving away from type-suffix dots; prefer plain concept files (`types.ts`, `schema.ts`) inside the owning folder. Use hyphens for word separation, dots only for tooling-known kinds.
5. index.ts: keep ONE public barrel per published lib (`libs/core|keys|ui|registry`), prefer package `exports` subpaths for large public APIs (helps `libs/ui`/`libs/keys` copy/package handoff + tree-shaking). Avoid/trim internal per-folder barrels in `apps/*` and `cli/*`; never route intra-package imports through the package's own barrel (cycle + dev-speed risk per TkDodo).
6. CLI/server/TUI: same kebab-case rule; command files named after the command (oclif-style, already done); name `cli/server` internals by role/domain (`review-pipeline.ts`, `git-runner.ts`) — no NestJS `.service` dots.

## Sources consulted
- https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md
- https://biomejs.dev/linter/rules/use-filenaming-convention/
- https://tkdodo.eu/blog/please-stop-using-barrel-files
- https://github.com/angular/angular/discussions/59522
- https://angular.dev/style-guide
- https://google.github.io/styleguide/tsguide.html
- https://dev.to/dglsparsons/don-t-write-utils-how-to-become-an-amazing-programmer-by-naming-carefully-m1m
- https://breadcrumbscollector.tech/stop-naming-your-python-modules-utils/
- https://mattilehtinen.com/articles/dunghill-anti-pattern-why-utility-classes-and-modules-smell/
- https://www.sufle.io/blog/naming-conventions-in-react
- https://www.piyushgambhir.com/blogs/next-js-naming-conventions
- https://shipixen.com/blog/nextjs-file-naming-best-practices
- https://medium.com/@sadeqshahmoradi76/pascalcase-or-kebab-case-best-or-bad-practice-in-file-naming-7382635d517e
- https://bressain.com/blog/kebab-casing/
- https://medium.com/@aleksandr_ross/why-i-will-not-use-index-files-in-2025-b40db08dab00
- https://krishnavadlamudi44.medium.com/the-index-ts-dilemma-balancing-convenience-and-performance-in-typescript-projects-85e9dd4fc18f
- https://articles.wesionary.team/the-hidden-costs-of-barrel-files-25de560b9f63
- https://dev.to/thepassle/a-practical-guide-against-barrel-files-for-library-authors-118c
- https://oclif.io/docs/introduction/
- https://www.webdevtutor.net/blog/typescript-type-file-naming-convention
- https://dev.to/damiansiredev/file-naming-conventions-keep-your-project-clean-and-readable-1plk
- https://tanstack.com/router/latest/docs/routing/file-naming-conventions
