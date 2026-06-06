# Node.js CLI & Ink TUI Project Structure — Research Notes (2026-06-04)

Research agent: **T-cli** (structure-audit pipeline)
Topic: Node.js CLI & Ink TUI project structure best practices (2026)
Scope: applies to `cli/diffgazer`, `cli/add`, `cli/server` in this monorepo.

Method: WebSearch (many angles, freshness-tagged) + WebFetch of authoritative docs + **direct GitHub trees API reads of the actual source of shadcn-ui, vercel, changesets, astro, create-ink-app** (curl to api.github.com, since `gh`/auth was unavailable). Cross-checked >8 independent sources. Controversies recorded explicitly.

---

## Q1 — How high-quality Node CLIs are structured (2025/2026)

### The framework landscape (what's actually used)

- **commander** — ~500M weekly downloads, lightweight, imperative API. Used by **shadcn CLI** and **changesets** internally. No prescribed file layout — you choose. Source: npm-compare, grizzlypeaksoftware.
- **oclif** (Salesforce) — opinionated, **one command per file**, class-based, auto-discovers `src/commands/`, lazy-loads commands (fast startup at 200+ commands), generates `bin/run.*` + `bin/dev.*`, `@oclif/test` per-command isolation, manifest generation. Topics = subdirectories of `src/commands/` (`config/index.ts`, `config/set.ts`, `config/get.ts`), colon separator (`heroku config:set`). Recommended depth: 1–2 levels max. Source: oclif.io/docs/topics, Salesforce blog.
- **citty** (UnJS) — zero-dependency, wraps Node's native `util.parseArgs`. Source layout: `types.ts` (types), `command.ts` (`defineCommand`/`runCommand`), `args.ts` (parsing). `subCommands` is an object; **lazy-load via `() => import("./sub.mjs")`**. Source: github.com/unjs/citty, unjs.io.
- **@clack/prompts** — interactive prompt primitives, not a command router. Composed *inside* commands. diffgazer's `cli/add` uses `@clack` (seen in node_modules).
- **Node native `util.parseArgs`** (stable since Node 18.3+) — fine for simple cases, not as powerful as commander/yargs. Sources: 2ality, simonplend, pawelgrzybek.

### The cross-framework consensus pattern

From lirantal/nodejs-cli-apps-best-practices (the canonical list) + LogRocket + the framework docs:

1. **`bin` object in package.json**, decoupled from package name: `"bin": { "name": "./bin/cli.js" }`. Lets the executable name differ from the package name. (diffgazer does this: `"bin": { "diffgazer": "bin/diffgazer.js" }`.)
2. **`files` field** to ship only runtime files (exclude tests). (diffgazer does this.)
3. **`process.cwd()` for user-input paths; `import.meta.dirname`/`__dirname` for project-internal assets.** Critical for a CLI run from arbitrary directories.
4. **Keep the command layer thin; push logic into a service layer** — "keep API routes/commands thin and move logic into services" (LogRocket, Vivasoft). This is the arg-parsing-vs-logic separation, confirmed by every real CLI below.
5. **"7±2" rule**: if a directory exceeds ~7 entries, split it (Vivasoft/LogRocket).

### The binary-vs-library split (strong, universal)

Every authoritative CLI separates **three responsibilities**:
- **Entry / arg-parse spec** (the "what flags exist" declaration) — `index.ts` + a `command.ts`/`args.ts`/`cli-options.ts`.
- **Command handler** (orchestration glue) — thin; reads parsed args, calls services, formats output.
- **Business logic / services / utils** — framework-agnostic, unit-testable without spawning the CLI.

This is exactly what lirantal + LogRocket prescribe and what shadcn/vercel/astro implement. diffgazer already does this: `cli/add` has `commands/` (handlers) + `utils/` (logic) + `context.ts`; `cli/diffgazer` has `cli-options.ts` (arg spec, with its own `.test.ts`) separated from `index.tsx` (entry) and `tui-entry.tsx`/`web-launcher.ts`.

---

## Q2 — Real-world CLI source layouts (read directly from GitHub)

### shadcn CLI — `packages/shadcn/src/` (commander, ts-morph, zod)

Top-level: `commands/ icons/ mcp/ migrations/ preflights/ preset/ registry/ schema/ styles/ templates/ utils/ colors.ts index.ts`

- **`commands/` = one file per command, flat**: `add.ts apply.ts build.ts diff.ts docs.ts eject.ts info.ts init.ts mcp.ts migrate.ts preset.ts search.ts view.ts` — and tests **co-located** (`apply.test.ts`, `build.test.ts`, `init.test.ts`).
- **Domain folders, not a generic `features/`**: `registry/` (24 files: `api.ts fetcher.ts loader.ts resolver.ts parser.ts validator.ts github.ts namespaces.ts schema.ts …` + co-located tests), `preflights/` (per-command pre-checks: `preflight-add.ts preflight-init.ts …`), `migrations/`, `preset/`, `styles/`, `templates/` (one file per framework: `next.ts vite.ts astro.ts laravel.ts react-router.ts …`).
- **`utils/` = leaf helpers**, with nested sub-domains `utils/transformers/` (AST codemods: `transform-icons.ts transform-jsx.ts …`) and `utils/updaters/` (`update-css-vars.ts update-dependencies.ts update-files.ts …`).
- **File naming: kebab-case, frequently 2–3 hyphens** (`add-components.ts`, `get-package-info.ts`, `get-monorepo-info.ts`, `is-safe-target.ts`, `update-css-vars.ts`, `dry-run-formatter.ts`). **Tests co-located as `*.test.ts`.** Barrel `index.ts` only at sub-package boundaries (`registry/index.ts`, `utils/index.ts`, `transformers/index.ts`).

### vercel CLI — `packages/cli/src/` (the cleanest binary-vs-logic split)

Top-level: `commands/ util/ args.ts commands-bulk.ts help.ts index.ts output-manager.ts vc.js`

- **`commands/<name>/` = one folder per command**, ~60 commands (`deploy/ dev/ env/ build/ link/ login/ …`).
- Inside each command folder the split is explicit:
  - `command.ts` = **the arg/flag/option SPEC only** (declarative).
  - `index.ts` = the **handler** (orchestration).
  - heavier logic in a named file (`dev/dev.ts`).
  - e.g. `commands/deploy/{command.ts,index.ts}`, `commands/dev/{command.ts,dev.ts,index.ts}`.
- **`util/<domain>/` mirrors the command domains** for shared logic (`util/dev/ util/deploy/ util/env/ util/link/ util/git/ util/output/ util/input/ …`) plus flat leaf utils (`error.ts did-you-mean.ts format-date.ts emoji.ts client.ts`).
- **Top-level `args.ts` + `help.ts`** centralize cross-command parsing/help.
- File naming: **kebab-case, multi-hyphen common** (`services-orchestrator.ts`, `agent-output-constants.ts`, `command-validation.ts`, `parse-query-string.ts`).

### changesets CLI — `packages/cli/src/` (the folder-per-command + `__tests__` style)

- **`commands/<name>/index.ts`** is the entry, with siblings for sub-logic: `commands/add/{index.ts, createChangeset.ts, messages.ts}`, `commands/publish/{index.ts, npm-utils.ts, publishPackages.ts}`, `commands/version/{index.ts}`.
- **Tests in dedicated `__tests__/` folders** per command (`commands/add/__tests__/`, `commands/publish/__tests__/`), NOT co-located.
- **camelCase file names** (`createChangeset.ts`, `publishPackages.ts`, `getCommitFunctions.ts`, `getLastJsonObjectFromString.ts`) — the *opposite* of shadcn's kebab-case.
- Shared logic at `src/` root or `utils/`: `changelog.ts run.ts help.ts types.ts utils/cli-utilities.ts utils/createPromiseQueue.ts`.

### astro CLI — `packages/astro/src/cli/` (newest, hexagonal/DDD)

- **`<command>/index.ts`** thin adapters: `dev/index.ts preview/index.ts build/index.ts add/index.ts check/index.ts sync/index.ts`.
- **Richer commands use ports-and-adapters layering**: `info/{definitions.ts, core/, domain/, infra/}`, `docs/{definitions.ts, core/, domain/, infra/}`, `create-key/{definitions.ts, core/, infra/}`.
  - `definitions.ts` = **interfaces (ports)** — verified by reading `info/definitions.ts`: `DebugInfoProvider`, `PackageManager`, `Clipboard`, `Prompt`, etc.
  - `core/` = use-case logic; `domain/` = domain models; `infra/` = concrete adapters (`npm-package-manager.ts pnpm-package-manager.ts yarn-package-manager.ts clack-prompt.ts tinyclip-clipboard.ts`).
- Top-level CLI shared: `domain/command.ts domain/help-payload.ts infra/ flags.ts exec.ts throw-and-exit.ts install-package.ts utils/`.
- File naming: **kebab-case, multi-hyphen common** (`build-time-astro-version-provider.ts`, `process-package-manager-user-agent-provider.ts`).

### Synthesis across the four

| Dimension | shadcn | vercel | changesets | astro |
|---|---|---|---|---|
| Command unit | one **file** | one **folder** (`command.ts`+`index.ts`) | one **folder** (`index.ts`+siblings) | one **folder** (`index.ts` [+layers]) |
| Arg spec vs handler | combined in file | **separated** (`command.ts` vs `index.ts`) | combined in `index.ts` | combined in `index.ts` |
| Tests | **co-located** `*.test.ts` | co-located `*.test.ts` | **`__tests__/` dirs** | co-located |
| File case | **kebab** (multi-hyphen) | **kebab** (multi-hyphen) | **camelCase** | **kebab** (multi-hyphen) |
| Shared logic | domain folders (`registry/`, `utils/`) | `util/<domain>/` | `utils/` + root | `core/`/`domain/`/`infra/` |
| Barrels | only at sub-package edges | minimal | `index.ts` per command (it's the entry) | `index.ts` per command (it's the entry) |

**Verdict for Q1/Q2:** there is NO single canonical layout. The invariants are: `src/` root; a `commands/` (or per-command-folder) layer that is thin; a separate logic/utils/service layer; co-located or `__tests__` tests; kebab-case dominates (3 of 4), and **none of these mainstream CLIs enforce a "single-word / one-hyphen" rule** — multi-hyphen descriptive names are the norm.

---

## Q3 — Ink (React for TUIs) app structure

### Official scaffold (`create-ink-app`, read directly)

Minimal, on purpose: `source/cli.tsx` (entry + arg parsing via `meow` → renders `<App>`), `source/app.tsx` (root component, owns global input), `test.tsx`, `tsconfig.json`. **No `components/`, no `screens/`, no `features/`.** Ink's official starter prescribes nothing beyond entry + root.

### What real/larger Ink apps do (combray.prose.sh TUI dev guide, openreplay, ink README)

- Recommended growth path: `src/cli.tsx` (render entry) → `app.tsx` (root, global input) → **`components/`** (reusable UI) → **`screens/`** (top-level screen components).
- Mental model: "the terminal is your viewport — re-render the entire visible state; Ink diffs." Every component is a Flexbox `Box`; all text in `<Text>`.
- Layout pattern: fullscreen alternate-screen wrapper + flex column with `flexGrow={1}` scroll area + fixed footer. Keyboard via `useInput`/`useFocus`/`useFocusManager`; resize via `useStdout`/`useStdoutDimensions`. Standard inputs via **`@inkjs/ui`** (official).
- For **multi-command tools**, the guidance is: "use oclif for command structure, then render TUI components within specific commands" — i.e. the **router/command layer is separate from the React/Ink render tree**.

### Does bulletproof-react `features/` make sense in a TUI?

- bulletproof-react explicitly claims applicability to "Next.js, Remix or **React Native**" — i.e. any React render target. Ink **is** a React render target, so the *feature-slice idea* (group `components/hooks/types/lib` by feature; features don't import each other; compose at app level) transfers.
- BUT the bulletproof `api/` and `stores/` sub-folders are web-data-fetching concepts; a TUI's "api" is the embedded server client, and global state is usually React context + the keyboard scope system. So adapt, don't copy.
- **diffgazer's `cli/diffgazer/src` already implements an Ink-flavored bulletproof-react**: `app/` (entry, router, routes, providers, screens), `components/{layout,ui}` (generic primitives — its own mini design system: `button.tsx menu.tsx panel.tsx tabs.tsx`), `features/{history,home,onboarding,providers,review,settings}/{components,hooks,lib}`, `hooks/` (cross-cutting), `lib/` (`servers/`, navigation, query-client), `theme/`, `types/`. This is a coherent, recognized 2026 structure — arguably best-in-class for an Ink app.

**Verdict:** Yes, bulletproof-react `features/` makes sense in a TUI and diffgazer already applies it well. The one TUI-specific nuance: `screens/` (route targets) live under `app/screens/` while feature-internal view pieces live under `features/<x>/components/` — diffgazer does exactly this, which is correct (screens = routed entry points = app composition layer; feature components = reusable slices).

---

## Q4 — Embedded server inside a CLI (CLI that serves a built SPA)

How vite preview / astro dev/preview / vercel dev / storybook structure the server-in-CLI:

- **astro** `cli/dev/index.ts`, `cli/preview/index.ts`, `cli/build/index.ts` are **thin adapters** (`index.ts` only). The actual dev/preview server lives **outside** `src/cli/` elsewhere in `packages/astro/src/` (core runtime). The CLI command just wires config → starts the server. **Server impl is NOT under the command folder.**
- **vercel** keeps the embedded dev server in **`util/dev/`** as its own module: `server.ts router.ts services-orchestrator.ts builder.ts queue-broker.ts port-utils.ts parse-listen.ts dev-lock.ts headers.ts mime-type.ts templates/`. The `commands/dev/` folder is the thin adapter (`command.ts` + `dev.ts` + `index.ts`) that imports `util/dev`.
- **vite preview / storybook** (consensus from docs + community): the preview server is a library function (`preview()` returns a server handle); the CLI `preview` command is a thin wrapper that calls it. Same shape — command = adapter, server = separate module.

**The universal pattern:** *Command/launcher is a thin adapter. Server implementation is a separately-testable module (own folder or own package). They communicate over a small interface (start/stop/port).*

**Verdict for diffgazer:** diffgazer is **ahead of the curve** here — it extracted the embedded server into its own workspace `cli/server` (`@diffgazer/server`, Hono, bundled via tsup `noExternal`), and `cli/diffgazer` only holds **launcher adapters** in `src/lib/servers/` (`embedded-server.ts web-server.ts api-server.ts create-process-server.ts server-factories.ts` + `shutdown-token.ts`) plus `web-launcher.ts`. That is a *stronger* separation than vercel (which keeps `util/dev` in-package) and matches astro's "server lives outside the command" principle. The `cli/server` workspace itself uses a clean `features/<domain>/{router,service,schemas,types}.ts` + `shared/{lib,middlewares}/` layout (a Hono/NestJS-style feature-module layout), which is the right backend convention — not bulletproof-react, and correctly so (it's a server, not a UI app).

---

## Q5 — Does a top-level `cli/` group belong in a monorepo, or do CLIs go in `apps/` / `packages/`?

- **Turborepo official** (turborepo.dev/docs/.../structuring-a-repository): "we recommend starting with splitting your packages into **`apps/` for applications and services** and **`packages/` for everything else, like libraries and tooling**." It does **not** explicitly bless other top-level names, but it **does** support arbitrary workspace globs: "If you'd like to group packages by directory, you can do this using globs like `packages/*` and `packages/group/*`." pnpm workspaces are equally glob-driven.
- **Common practice**: published CLI tools usually live in `packages/` (they're publishable libraries/tooling); apps that are deployed live in `apps/`. There is no rule forbidding a `cli/` top-level group — it's a glob in `pnpm-workspace.yaml` either way.
- **The decisive criterion** is mental clarity + ownership boundaries, not a magic folder name. A dedicated `cli/` group is a **recognized, defensible choice** when (a) you have multiple CLI-ish workspaces, and (b) some are CLI-internal (not standalone apps or reusable libs). diffgazer's `cli/` holds three things with one shared theme — *"runs in a terminal / is part of the CLI product"* — but they are heterogeneous: `cli/diffgazer` is a **deployable binary** (app-like), `cli/add` is a **published tool** (`@diffgazer/add`, library-ish), `cli/server` is **CLI-internal infra** (not standalone, not reusable). Under strict Turborepo convention, `cli/diffgazer` and `cli/add` would be `apps/` + `packages/` and `cli/server` would be `packages/` — but a single `cli/` group keeps the product's terminal surface together and the AGENTS.md already documents the boundaries crisply.

**Verdict:** A top-level `cli/` group is legitimate and not an anti-pattern; it deviates from the literal Turborepo `apps/`+`packages/` default but is well within "use globs to group packages." The trade-off is a slightly non-obvious mental model for newcomers (which of these is publishable? deployable? internal?) — already mitigated by the AGENTS.md boundary docs.

---

## The folder-per-module / barrel-file controversy (owner question a)

This is genuinely contested in 2026. Both camps are credible:

**Against barrel `index.ts` (and thus against the "every component gets a folder + index" pattern):**
- bulletproof-react (Alan Alickovic): *"In the past, it was recommended to use barrel files… However, it can cause issues for Vite to do tree shaking and can lead to performance issues. Therefore, it is recommended to import the files directly."*
- Robin Wieruch (2026 guide): *"barrel files are getting out of fashion in JavaScript"*; conditional endorsement only if you re-export *only the public API*, not `export *`.
- Hard data: Atlassian "75% faster builds after removing barrel files from Jira frontend"; Material-UI Button via barrel ~doubled bundle; Jest loads ALL barrel-exported modules (no tree-shaking) → 240 tests took 46s mostly on module load (Speakeasy, catchmetrics, vercel/next.js#12557, dev.to/thepassle). **This is the strongest argument and it bites hardest in test/CI startup — directly relevant to a Jest/Vitest-heavy monorepo like diffgazer.**

**For folder-per-component + index (the editor-ergonomics camp):**
- Josh Comeau: keep code in `FileViewer.tsx` (named after component, NOT `index.tsx`) and let `index.ts` be a one-line re-export forwarder, *because* a top bar full of `index.js` tabs is unreadable. On performance: *"I don't really think it's a significant issue… unless that application has tens of thousands of files and millions of lines of code."*
- Codevertiser: both the "barrel pattern" and "direct file naming" are real, widely used; choice is team/scale dependent.

**The synthesis the field has converged on (2026):**
1. **Don't name source files `index.ts`** — name them after their content (Comeau's tab argument is universally accepted). The shadcn/vercel/astro CLIs all do this.
2. **Barrel/`index.ts` re-exports are acceptable only at *package/sub-package public boundaries*** (e.g. `registry/index.ts`, a workspace's `src/index.ts`), never as a per-component convenience, and never `export *`.
3. **Folder-per-module is justified when a unit has ≥2–3 real siblings** (component + test + sub-logic + types), NOT for a lone component (that's just `button.tsx` + `button.test.tsx` flat — shadcn's choice).

**Applied to diffgazer:** the codebase already follows this correctly — flat files with co-located `*.test.ts(x)`, kebab-case, and folders only where a feature has real internal structure (`features/<x>/{components,hooks,lib}`). It does NOT wrap single components in folders. Keep it that way. No global per-component-folder migration is warranted.

---

## File-naming controversy (owner question c): single-word / one-hyphen vs `.test.ts` / `use-x.ts`

- **kebab-case for files is the 2026 default** for TS/React/Node (Wieruch, sufle.io, dev.to/damiansiredev). PascalCase reserved for the *exported symbol*, not the filename.
- **Suffix conventions are near-universal and SHOULD be kept**: `*.test.ts` / `*.spec.ts` (test mirrors source name), `use-*.ts` for hooks (React-team `use[Behavior]` mapped to kebab), `*-action.ts` / `get-*.ts` (Wieruch). These suffixes are *information*, not noise — they're how tooling (Vitest globs, lint rules) and humans classify files at a glance.
- **The owner's "at most one hyphen, ideally single word" rule conflicts with reality.** Measured in this repo, dozens of files already legitimately carry 2–3 hyphens: `create-process-server.ts`, `use-terminal-dimensions.ts`, `models-dev-catalog.ts`, `severity-filter-group.tsx`, `api-key-missing-view.tsx`, `trust-permissions-content.tsx`, `summary-view-helpers.ts`. Every reference CLI does the same: shadcn `add-components.ts`/`get-package-info.ts`/`update-css-vars.ts`; vercel `services-orchestrator.ts`/`parse-query-string.ts`; astro `process-package-manager-user-agent-provider.ts`.
- **The principle the owner actually wants (readable, single-responsibility names) is RIGHT; the hard "≤1 hyphen" rule is the wrong implementation.** Forcing single-word names produces *worse* readability (`server.ts` that's actually a process-spawning launcher is less clear than `create-process-server.ts`) or pushes complexity into folder nesting just to keep the leaf name short. The correct rule: **the file name should fully describe one responsibility; word count follows from that, not a hyphen budget.** A hyphen cap is justified ONLY where the long name is a symptom of the file doing too much (a real SRP smell) — then split the file, don't truncate the name.
- Note: hooks (`use-x.ts`) and tests (`x.test.ts`) inherently break a single-word rule and are non-negotiable conventions. The hyphen count should EXCLUDE the suffix segment (`use-`, `.test`) when reasoning about it.

---

## What this means for diffgazer (actionable)

1. **Keep the current Ink structure in `cli/diffgazer`.** `app/` (entry/router/routes/providers/screens) + `components/{layout,ui}` + `features/<x>/{components,hooks,lib}` + cross-cutting `hooks/`, `lib/`, `theme/`, `types/` is a correct, modern, bulletproof-react-adapted-for-TUI layout. Do not introduce per-component folders or `index.ts` barrels inside it.
2. **Keep the embedded-server separation.** `cli/server` as its own workspace + `cli/diffgazer/src/lib/servers/*` launcher adapters is *stronger* than vercel/astro and is the SOTA pattern. No change.
3. **`cli/add` is already canonical** (`commands/` thin + `utils/` logic + `context.ts`), matching shadcn's own CLI almost exactly. Optionally adopt vercel's `command.ts`(spec) vs handler split only if a command's flag definition grows large enough to obscure the handler — not yet warranted.
4. **`cli/server` uses the right *backend* convention** (`features/<domain>/{router,service,schemas,types}` + `shared/{lib,middlewares}`). Do NOT bulletproof-react-ify it; server feature-modules ≠ UI feature-slices. Keep it.
5. **Drop the strict "≤1 hyphen / single word" file-name rule.** Replace with: *kebab-case; the name names exactly one responsibility; keep `*.test.ts`, `use-*.ts`, `*-routes.ts` suffix conventions; if a name needs 4+ hyphens it's usually a sign the file does too much — split the file, not the name.* This aligns with all four reference CLIs.
6. **Tests: co-locate `*.test.ts(x)`** (current diffgazer + shadcn + vercel + astro). Reject changesets-style `__tests__/` dirs — co-location wins on colocation/locality and is the majority pattern.
7. **Barrels: allow `index.ts` ONLY at workspace public boundaries** (`src/index.ts` of a published lib), never `export *`, never per-component. Audit any existing intra-feature barrels in the CLIs and inline them — this measurably speeds Vitest startup (Atlassian/Speakeasy data).
8. **`cli/` top-level group is fine to keep** given the documented boundaries, but be aware it deviates from literal Turborepo `apps/`+`packages/`. If you ever want strict convention: `cli/diffgazer`→`apps/`, `cli/add`→`packages/`, `cli/server`→`packages/` (internal). Not required; the AGENTS.md boundaries already carry the semantics a folder name would.
9. **Agnostic naming is already satisfied** for the public surface: the binary package is `diffgazer` (unscoped), internals are `@diffgazer/*`. Consistent with "agnostic / non-branded" preference.

---

## Sources consulted (URLs)

Real source trees (read directly via GitHub API):
- https://github.com/shadcn-ui/ui (packages/shadcn/src — commands/registry/utils/transformers/updaters/preflights)
- https://github.com/vercel/vercel (packages/cli/src — commands/<name>/command.ts+index.ts, util/<domain>/)
- https://github.com/changesets/changesets (packages/cli/src — commands/<name>/index.ts + __tests__)
- https://github.com/withastro/astro (packages/astro/src/cli — <command>/index.ts, info/{definitions,core,domain,infra})
- https://github.com/vadimdemedes/create-ink-app (templates/ts/source: cli.tsx + app.tsx + test.tsx)
- https://github.com/vadimdemedes/ink (examples, hooks)

Docs & authoritative guides:
- https://github.com/lirantal/nodejs-cli-apps-best-practices (bin object, files field, cwd vs dirname)
- https://oclif.io/docs/topics/ (command-per-file, topics, colon separators)
- https://github.com/unjs/citty + https://unjs.io/packages/citty/ (defineCommand, args.ts/command.ts/types.ts, lazy subCommands)
- https://www.robinwieruch.de/react-folder-structure/ (2026: kebab-case, features, barrels out of fashion, folder-per-component at scale)
- https://www.joshwcomeau.com/react/file-structure/ (name files after component not index; barrel perf is overstated for most apps)
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md (features/, no barrels, unidirectional shared->features->app, applies to Next/Remix/RN)
- https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository (apps/ vs packages/, glob grouping)
- https://blog.logrocket.com/node-js-project-architecture-best-practices/ (thin command layer, service layer)
- https://www.speakeasy.com/docs/sdks/customize/typescript/disabling-barrel-files + https://github.com/vercel/next.js/issues/12557 + https://dev.to/thepassle/a-practical-guide-against-barrel-files-for-library-authors-118c (barrel-file tree-shaking/test-startup data; Atlassian 75% build win)
- https://combray.prose.sh/2025-12-01-tui-development (Ink: cli.tsx/app.tsx/components/screens; oclif for commands + Ink for render)
- https://blog.openreplay.com/building-terminal-interfaces-nodejs/ (Ink hooks/layout)
- https://www.codevertiser.com/react-components-folder-structure-naming-patterns/ (barrel vs direct: both valid, team/scale dependent)
