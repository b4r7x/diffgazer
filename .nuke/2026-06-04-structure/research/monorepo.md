# Monorepo workspace organization: apps/ vs packages/ vs custom groups (cli/, libs/)

Research agent: T-monorepo. Date: 2026-06-04. Read-only on the codebase.

Scope of this note: top-level workspace grouping, where CLI binaries live, package naming
(scoped vs unscoped, agnostic vs branded, dir==name), and internal-package strategies
(JIT vs compiled vs publishable) + where build scripts belong. Conclusions are tied to the
actual diffgazer workspaces, which I inventoried first (see "diffgazer baseline" below).

## diffgazer baseline (read from the repo, ground truth)

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "cli/*"
  - "libs/*"
  - "libs/keys/artifacts"
```

Workspace -> package name / private / bin (read from each package.json):

| dir            | package name        | private | bin                                  |
|----------------|---------------------|---------|--------------------------------------|
| apps/docs      | @diffgazer/docs     | true    | -                                    |
| apps/landing   | @diffgazer/landing  | true    | -                                    |
| apps/web       | @diffgazer/web      | true    | -                                    |
| cli/add        | @diffgazer/add      | false   | dgadd -> ./dist/index.js             |
| cli/diffgazer  | diffgazer           | false   | diffgazer -> bin/diffgazer.js        |
| cli/server     | @diffgazer/server   | true    | -                                    |
| libs/core      | @diffgazer/core     | true    | -                                    |
| libs/keys      | @diffgazer/keys     | false   | -                                    |
| libs/registry  | @diffgazer/registry | true    | -                                    |
| libs/ui        | @diffgazer/ui       | false   | -                                    |

Build-script `scripts/` dirs inside workspaces: apps/docs/scripts, cli/add/scripts,
libs/ui/scripts, libs/core/scripts, libs/keys/scripts. Root `scripts/monorepo`.

So: 3 top-level groups (`apps/`, `cli/`, `libs/`); public binary `diffgazer` is unscoped+branded;
the registry-add CLI is scoped+agnostic (`@diffgazer/add`, bin `dgadd`); libraries are scoped.

---

## Q1. Official Turborepo + pnpm conventions: is apps/ + packages/ canonical? Are cli/ libs/ idiomatic or fighting the tooling?

### Turborepo official docs (authoritative)

Source: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository (fetched full).

- Canonical split, verbatim recommendation: *"splitting your packages into `apps/` for
  applications and services and `packages/` for everything else, like libraries and tooling."*
  So the docs phrase it as a recommendation, not a hard requirement — "everything else"
  explicitly bundles libraries AND tooling into one bucket by default.
- Custom groupings are EXPLICITLY ALLOWED. The docs say you can use multiple glob patterns like
  `packages/*` and `packages/group/*`. The ONLY hard rule is no nested packages: *"every directory
  **with a `package.json`** in the `apps` or `packages` directories will be considered a package"*
  and you must not have a package at `apps/a` and another at `apps/a/b`.
- Directory name and package name are decoupled: *"Directory names simply organize packages; the
  `package.json` name field defines the actual package name independently."* No rule that they match.

KEY: The tooling itself does NOT care about the folder names. Turborepo discovers packages from the
workspace globs (`pnpm-workspace.yaml`), not from a magic `apps/`/`packages/` convention. A custom
top-level group like `cli/` or `libs/` is a glob entry; it is fully first-class. There is zero
"fighting the tooling" — Turborepo's own repo proves this (see Q2).

### pnpm official + 2025 guidance

Source: https://pnpm.io/workspaces , https://pnpm.io/settings , and 2025 guides
(jsdev.space complete-monorepo-guide, glen-thomas mastering-pnpm-workspaces).

- pnpm reads `pnpm-workspace.yaml` `packages:` globs. Any glob set works. The `apps/*` + `packages/*`
  default is convention echoed from Turborepo/Nx, not a pnpm requirement.
- Recommended adjacent settings in 2025 guides: `link-workspace-packages: true` (t3-turbo uses
  `linkWorkspacePackages: true`), `auto-install-peers`, `save-exact`, catalogs for version pinning.
  diffgazer should confirm `link-workspace-packages`/catalog usage but that's out of structure scope.

### Verdict Q1

`apps/` + `packages/` is the canonical DEFAULT, but it is a soft convention. Custom top-level groups
are idiomatic and tool-blessed as long as each group is a workspace glob and packages are not nested.
diffgazer's `apps/ cli/ libs/` is squarely within the supported pattern and is closer to what large
real repos actually do (Q2) than the minimal 2-bucket starter. The one nuance: the Turborepo docs
treat `libs` as a rename of `packages` ("everything else, like libraries and tooling"), so splitting
`libs/` out from `cli/` is a finer-grained, more SRP-aligned version of the same idea.

---

## Q2. Survey of real high-quality monorepos (inspected directly via GitHub API/raw, not blogs)

I read the actual `pnpm-workspace.yaml` and `package.json` files of each repo on `main`.

### vercel/turborepo (the canonical Turborepo repo)

`pnpm-workspace.yaml` packages globs:
```
apps/*
cli
docs/*
packages/*
turborepo-tests/*
crates/*/js
examples
lockfile-tests
```
- Uses CUSTOM top-level groups: `cli`, `docs/*`, `crates/*/js`, `turborepo-tests/*`, `lockfile-tests`
  ALONGSIDE `apps/*` and `packages/*`. This is the single strongest data point: Turborepo's own
  monorepo does NOT restrict itself to apps/packages.
- `apps/` contains only `docs`. Most real packages live in `packages/`.
- The public `turbo` binary lives in `packages/turbo`: name `turbo` (UNSCOPED), `private: false`,
  `bin: { turbo: "./bin/turbo" }`. The Rust CLI orchestrator is the separate top-level `cli` group
  (package `@turbo/cli`, `private: true`).
- Other CLIs are scoped library-style packages: `create-turbo` (unscoped, public, bin create-turbo),
  `@turbo/gen` (dir `turbo-gen`, bin), `turbo-codemod`, `turbo-ignore`, etc.

### shadcn-ui/ui

`pnpm-workspace.yaml`: `apps/*`, `packages/*` (+ negation globs for test/fixtures/temp).
- `apps/` = `v4` (the docs/registry site). `packages/` = `shadcn` (the CLI), `tests`.
- The CLI binary package is `packages/shadcn`: name `shadcn` (UNSCOPED, branded), `bin: ./dist/index.js`.
- Takeaway: the public CLI is a PACKAGE (not an app), unscoped/branded, dir name == package name.

### t3-oss/create-t3-turbo (the canonical "agnostic naming" example)

`pnpm-workspace.yaml`: `apps/*`, `packages/*`, `tooling/*`.
- THREE top-level groups. `tooling/` is split out from `packages/` for config-only packages
  (eslint, prettier, tailwind, typescript, github).
- ALL local packages use a generic/agnostic scope `@acme/*`: `@acme/db`, `@acme/eslint-config`, etc.
  This is the textbook "non-branded placeholder scope" pattern the owner is asking about.
- Functional packages: api, auth, db, ui, validators. Tooling: eslint, github, prettier, tailwind, typescript.

### trpc/trpc

`pnpm-workspace.yaml`: `packages/*`, `examples/*`, `www`. NO `apps/` at all.
- Everything ships from `packages/*`: client, next, openapi, react-query, server, tanstack-react-query,
  tests, upgrade.
- The CLI lives in `packages/`: `@trpc/upgrade` (SCOPED), `bin: ./dist/bin.js`. So a maintenance/codemod
  CLI is a scoped package next to the libraries.
- Scope `@trpc/*` is branded (matches the published brand).

### vitest-dev/vitest

`pnpm-workspace.yaml` packages: `docs`, `packages/*`, `examples/*`, `test/*`, `test/e2e/...`. NO `apps/`.
- Everything is `packages/*`: vitest, browser, coverage-v8, ui, utils, spy, expect, mocker, snapshot, etc.
- The public binary is `packages/vitest`: name `vitest` (UNSCOPED, branded), `bin: { vitest: "./vitest.mjs" }`.
- Sub-libraries scoped `@vitest/ui`, `@vitest/coverage-v8`, etc.

### cal.com

Source: https://handbook.cal.com/engineering/codebase/monorepo-turborepo
- `apps/` = deployable Next.js webapps (web, website, api, swagger, docs). `packages/` = shared code.
- Their own framing, verbatim sense: the apps/packages distinction is *"mainly a nomenclature thing"*
  to differentiate full deployable apps from reusable shared code. Confirms it's convention, not law.

### Cross-repo pattern table

| repo            | top-level groups                                  | apps/? | CLI binary lives in | binary pkg naming        |
|-----------------|---------------------------------------------------|--------|---------------------|--------------------------|
| vercel/turborepo| apps, cli, docs, packages, crates/*/js, ...tests  | yes    | packages/turbo + cli| `turbo` unscoped/branded |
| shadcn-ui/ui    | apps, packages                                    | yes    | packages/shadcn     | `shadcn` unscoped/branded|
| create-t3-turbo | apps, packages, tooling                           | yes    | (no public CLI)     | `@acme/*` agnostic scope |
| trpc/trpc       | packages, examples, www                           | no     | packages/upgrade    | `@trpc/upgrade` scoped   |
| vitest          | packages, docs, examples, test                    | no     | packages/vitest     | `vitest` unscoped/branded|
| cal.com         | apps, packages                                    | yes    | (apps = deployables)| n/a                      |

### Verdict Q2

1. There is NO single canonical layout among elite repos. Two of six (trpc, vitest) don't even have
   an `apps/` folder. Several use 3+ custom top-level groups (turborepo, t3-turbo).
2. CLI binaries live wherever fits the mental model: turborepo/shadcn/vitest treat the binary as a
   PACKAGE (it ships from `packages/`); trpc puts its codemod CLI in `packages/`. None of these put
   the primary published CLI in `apps/` — `apps/` is reserved for deployable web apps. diffgazer's
   `cli/` group is a more explicit version of "these are the shipped binaries/internal CLI services."
3. Binary NAMING is the strongest convention found: PUBLIC binaries are UNSCOPED and BRANDED
   (`turbo`, `vitest`, `shadcn`, `create-turbo`) so users type the literal command; INTERNAL/library
   packages and secondary CLIs are SCOPED (`@turbo/gen`, `@trpc/upgrade`, `@vitest/ui`). This exactly
   validates diffgazer: `diffgazer` (public, unscoped) vs `@diffgazer/add` (scoped lib-style; its
   user-facing command is `dgadd`).
4. Dir name == package name (minus scope) is the dominant practice (shadcn/shadcn, vitest/vitest,
   turbo-gen/@turbo/gen) but not enforced by tooling.

---

## Q3. Package naming: scoped vs unscoped, dir==name, agnostic vs branded

Sources: Turborepo structuring docs, Turborepo creating-internal-package docs, the 5 inspected repos,
the Nx naming discussion (https://github.com/nrwl/nx/discussions/16184), monorepo naming guides.

### Established conventions

- Scope for internal/library packages: use ONE consistent scope for all local packages
  (Turborepo docs: *"if your organization is named `acme`, you might name your packages
  `@acme/package-name`"*; docs use `@repo` as the placeholder). Reasons cited across sources:
  (a) avoid npm registry collisions, (b) keep `node_modules/@scope/*` grouped, (c) instantly signal
  "this is ours" at import sites.
- Public binaries: unscoped + branded so the install/run command is the literal name. Confirmed by
  `turbo`, `vitest`, `shadcn`, `create-turbo`.
- Directory name SHOULD match the package name (without scope) for navigability, and is the dominant
  practice, but the docs explicitly decouple them. The `package.json` `name` field is the only thing
  that matters to tooling/imports (Turborepo: *"The `name` field in your `package.json` determines how
  your package can be imported throughout your workspace."*).

### Agnostic vs branded — what real repos do

- AGNOSTIC scope: create-t3-turbo uses `@acme/*` precisely because it is a STARTER TEMPLATE meant to
  be re-branded. It is the canonical example the owner is thinking of, and it is agnostic ON PURPOSE
  (placeholder), not as a permanent style for a shipping product.
- BRANDED scope: trpc (`@trpc/*`), vitest (`@vitest/*`), turbo (`@turbo/*`) — every SHIPPING product
  uses its own brand as the scope. The public unscoped binary is also branded (`turbo`, `vitest`).

So the real-world signal: agnostic scope is for templates/placeholders; shipping products brand their
scope but keep individual package SHORT NAMES generic/functional (`ui`, `core`, `server`, `gen`,
`upgrade`, `add`). That is exactly the right reading of "agnostic": the per-package leaf name should be
a generic concept word, while the scope carries the brand.

### Verdict Q3 for diffgazer

diffgazer is already aligned with shipping-product practice and the owner's "agnostic" intent:
- Single consistent brand scope `@diffgazer/*` for libraries/internal (matches trpc/vitest/turbo).
- Public binary `diffgazer` is unscoped + branded (matches turbo/vitest/shadcn) — correct.
- Leaf names are generic/agnostic concept words: `core`, `ui`, `keys`, `registry`, `server`, `add`,
  `docs`, `web`, `landing`. This is the agnostic naming the owner wants; do NOT rename leaves to
  branded variants.
- `cli/add` (dir) -> `@diffgazer/add` (name) -> `dgadd` (bin). The dir name `add` matches the leaf
  `add`; consistent with dir==name. The bin `dgadd` is the one place naming diverges from the package
  name; that's fine and common (shadcn's package is `shadcn` and bin is `shadcn`, but a short prefixed
  bin like `dgadd` is a deliberate, defensible collision-avoidance choice — though see controversy:
  some would argue the bin should just be `diffgazer add` as a subcommand to avoid two binaries).
- `cli/diffgazer` (dir `diffgazer`) -> package `diffgazer` (unscoped) -> bin `diffgazer`. Dir == name
  == bin. Textbook for a public binary (mirrors `packages/turbo` -> `turbo`, `packages/vitest` -> `vitest`).

---

## Q4. Internal-package patterns: JIT (source exports) vs compiled; where build scripts belong

Sources: https://turborepo.dev/docs/core-concepts/internal-packages (fetched full),
https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package (fetched full),
GitHub discussion vercel/turborepo#9550.

### The three strategies (verbatim-grounded)

1. JUST-IN-TIME (JIT) packages — export TypeScript source directly; no build step. *"directly exporting
   TypeScript files."* Use when: *"Your applications are built using a modern bundler like Turbopack,
   webpack, or Vite"* and you want minimal config. Tradeoffs (verbatim): *"Only applicable when consumers
   do transpiling"*; cannot use TS `paths` (use Node subpath `imports` w/ TS 5.4+); *"Turborepo cannot
   cache a build for a Just-in-Time Package"*; type errors in deps surface at the consumer.
2. COMPILED packages — each package runs its own `tsc` to `dist/`, cacheable by Turborepo.
   *"The majority of Compiled Packages should use `tsc`."* Tradeoff: more config (build outputs,
   `sideEffects`, multiple tsconfigs).
3. PUBLISHABLE packages — strictest; for npm registry. *"Publishing a package to the npm registry comes
   with the most strict requirements"* — full exports/declarations/peerDeps; use changesets.

### Where build scripts belong

- Turborepo "creating an internal package" page: build/compile commands belong in `package.json`
  `scripts` (e.g. `"build": "tsc"`), NOT a dedicated `scripts/` folder. The page does NOT mention a
  `scripts/` directory at all.
- For SHARED tooling/config, the strong 2025 convention (create-t3-turbo, create-turbo default,
  multiple guides) is a separate `tooling/` group or `packages/*-config` packages
  (`@repo/eslint-config`, `@repo/typescript-config`, `@acme/eslint-config`). The "Three-Layer
  Architecture" guidance: `/apps` thin deployables, `/packages` thick shared logic+UI, `/tooling`
  centralized configs.
- For repo-wide ORCHESTRATION scripts (release, smoke, invariant checks), elite repos keep a root
  `scripts/` dir (vercel/turborepo and trpc both have top-level `scripts/`). diffgazer's
  `scripts/monorepo/*` matches this exactly.
- Per-package generator/build helper scripts (codegen, artifact copy) living in a package-local
  `scripts/` dir (diffgazer: cli/add/scripts, libs/ui/scripts, libs/core/scripts, libs/keys/scripts,
  apps/docs/scripts) is NOT something the official docs bless or forbid; it's a pragmatic local
  convention. The AGENTS.md verification gate already notes these are owned by a node-typed
  `scripts/tsconfig.json`, so they're intentional, type-checked, and editor-resolvable.

### diffgazer reality vs strategies

- `@diffgazer/add` is private:false with a `bin` and a `generate:bundles`/build pipeline -> PUBLISHABLE.
- `@diffgazer/ui` and `@diffgazer/keys` are private:false with public registries under `public/r` and
  build steps -> PUBLISHABLE (shadcn-style copy + npm package, plus registry handoff). Their `scripts/`
  dirs generate the public registry/bundle artifacts.
- `@diffgazer/core`, `@diffgazer/registry`, `@diffgazer/server` are private:true -> internal; they are
  consumed by the CLI and apps. The repo's `prepare:library-artifacts` builds `@diffgazer/core`,
  `@diffgazer/registry`, `@diffgazer/keys`, `@diffgazer/ui` (so these are COMPILED, not JIT).
- The Vite/Ink apps could in principle JIT-consume some libs, but the registry/copy/handoff contract
  (AGENTS.md "Public UI API", "Registry, CLI, and Handoff") REQUIRES compiled/publishable outputs and
  committed `public/r` registries. So JIT is NOT appropriate for the public libs here — diffgazer
  correctly uses compiled/publishable. JIT could only be considered for a purely-internal, never-published
  helper consumed solely by bundler apps; given the artifact/handoff gates, compiled is the safer default.

### Verdict Q4

diffgazer's compiled+publishable split is correct for a repo whose libs ship as both npm packages AND
shadcn-style copy registries; JIT would break the copy/declaration/handoff contract. Build commands
correctly live in `package.json` scripts + Turbo tasks. Root `scripts/monorepo` (orchestration) and
per-package `scripts/` (codegen) are both defensible and match real repos. The only thing worth a second
look is whether the per-package `scripts/` dirs could be consolidated, but that's an SRP/DRY call, not a
correctness issue.

---

## Controversies / where credible sources disagree

1. Is `apps/` mandatory? Turborepo docs and cal.com say apps/packages is the recommended split, but
   trpc and vitest (both elite) ship with NO `apps/` folder — everything is `packages/*`. Strong side
   for apps/: separates deployables from libraries, matches create-turbo default, aids CI filtering.
   Strong side against: if you have no long-running deployable web apps, `apps/` is empty ceremony; a
   single `packages/*` (or domain groups) is simpler. diffgazer DOES have web/docs/landing deployables,
   so keeping `apps/` is justified.

2. Custom top-level groups (cli/, libs/) vs the 2-bucket default. Turborepo docs frame the world as
   apps + "everything else" (packages). create-t3-turbo and turborepo's own repo prove 3+ groups are
   fine. The disagreement is taste/granularity: minimalists want exactly apps/packages; large repos
   split by lifecycle (cli, tooling, crates, tests). For diffgazer, `cli/` and `libs/` are a clean
   lifecycle split (shipped binaries/services vs reusable libraries) and are tool-blessed.

3. CLI placement: package vs app. shadcn/vitest/turbo treat the binary as a `packages/*` member; some
   guides say a "standalone tool might go in apps/". The credible-source weight is clearly toward
   "binary = package, app = deployable web service." diffgazer's dedicated `cli/` group sidesteps the
   debate by naming the lifecycle explicitly.

4. Two binaries vs subcommands (`dgadd` vs `diffgazer add`). Not a settled convention. shadcn ships one
   `shadcn` binary with subcommands; turborepo ships several binaries (`turbo`, `create-turbo`,
   `@turbo/gen`). diffgazer shipping both `diffgazer` and `dgadd` is defensible (they serve different
   audiences: end users vs component consumers) but a reviewer could argue for a single `diffgazer`
   binary with an `add` subcommand for discoverability. This is a product/DX decision, not a structure error.

5. Agnostic vs branded scope. create-t3-turbo's `@acme/*` (agnostic) is a TEMPLATE placeholder; all
   shipping products brand the scope. So "agnostic" is best applied to LEAF names, not the scope. The
   owner's instinct (agnostic) is right for leaves, but the scope should stay branded `@diffgazer/*`.

6. Directory name == package name. Practiced almost everywhere but explicitly NOT enforced by Turborepo.
   No real disagreement on the recommendation; only on how strictly to police it.

---

## What this means for diffgazer (concrete, per-workspace)

- KEEP the 3-group layout `apps/ cli/ libs/`. It is tool-blessed (it's just three workspace globs),
  more SRP-aligned than the 2-bucket default, and matches how vercel/turborepo and create-t3-turbo
  actually organize (custom groups + lifecycle split). No change needed; this is NOT fighting the tooling.
- KEEP `apps/` (web, docs, landing) as the deployable bucket — diffgazer genuinely has deployables, so
  unlike trpc/vitest the `apps/` group is earned, not ceremony.
- KEEP public binary `diffgazer` unscoped+branded with dir==name==bin (mirrors `turbo`/`vitest`/`shadcn`).
  This is the single clearest convention in the survey; do not scope it.
- KEEP `@diffgazer/*` as the single branded scope for all libs + the internal `@diffgazer/add` package.
  Do NOT make the scope agnostic (`@acme`-style is only for templates). Apply "agnostic" to LEAF names
  (`core`, `ui`, `keys`, `registry`, `server`, `add`) — already done correctly.
- `cli/add` -> `@diffgazer/add` -> bin `dgadd`: structurally fine. Optional DX consideration (not a
  structure fix): whether `dgadd` should instead be a `diffgazer add` subcommand. Flag as product decision.
- KEEP compiled+publishable strategy for `@diffgazer/ui|keys|core|registry`. JIT (source-only TS exports)
  is INAPPROPRIATE here because the registry copy/shadcn handoff and committed `public/r` contracts
  require real build outputs/declarations. Do not migrate libs to JIT.
- Build scripts: per-Turborepo docs, build commands belong in `package.json` scripts + turbo tasks
  (already the case). Root `scripts/monorepo` for orchestration matches turborepo/trpc top-level
  `scripts/`. Per-package `scripts/` (codegen/artifacts) is a fine local convention; consider whether
  any could be merged for DRY, but it's not a correctness problem.
- Optional, NOT required: if config packages (eslint/tsconfig) ever get extracted, the 2025 convention
  is a separate `tooling/*` group (create-t3-turbo) or `*-config` packages, rather than stuffing them
  into `libs/`. Right now configs are root-level (biome.root.json, tsconfig chains), which is acceptable.

---

## Sources consulted (URLs)

- https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository (fetched full)
- https://turborepo.dev/docs/core-concepts/internal-packages (fetched full)
- https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package (fetched full)
- https://pnpm.io/workspaces , https://pnpm.io/settings
- vercel/turborepo: raw pnpm-workspace.yaml + packages/turbo, cli, create-turbo, turbo-gen package.json (GitHub API/raw)
- shadcn-ui/ui: raw pnpm-workspace.yaml + packages/shadcn package.json (GitHub API/raw)
- t3-oss/create-t3-turbo: raw pnpm-workspace.yaml + packages/db, tooling/eslint package.json (GitHub API/raw)
- trpc/trpc: raw pnpm-workspace.yaml + packages/upgrade package.json (GitHub API/raw)
- vitest-dev/vitest: raw pnpm-workspace.yaml + packages/vitest package.json (GitHub API/raw)
- https://handbook.cal.com/engineering/codebase/monorepo-turborepo
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md (fetched full)
- https://github.com/nrwl/nx/discussions/16184 (libs/apps vs packages naming)
- https://jsdev.space/complete-monorepo-guide/ (pnpm + workspaces + changesets 2025)
- https://blog.glen-thomas.com/.../mastering-pnpm-workspaces-complete-guide-to-monorepo-management.html
- https://dailydevpost.com/blog/turborepo-folder-structure-scalability-guide (2026 three-layer apps/packages/tooling)
- https://github.com/vercel/turborepo/discussions/9550 (compile & publish internal JIT package)
