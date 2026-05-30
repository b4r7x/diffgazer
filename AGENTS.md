# Repository Agent Rules

## Instruction Priority

- Treat this file as the repository contract for Codex, opencode, Claude Code via `CLAUDE.md`, and any other coding agent.
- Follow explicit user instructions first, then this file, then local code conventions discovered from nearby files.
- Before editing, read the relevant existing implementation and tests. Do not invent a new pattern when the repo already has one.
- Do not make broad refactors, renames, dependency changes, generated artifact churn, or public API changes unless the task requires them.
- Never revert or overwrite unrelated worktree changes. If a file is already dirty, understand the existing changes and work with them.

## Required Skills / Review Modes

If your environment supports skills, load these before acting:

- For any implementation or review: `code-audit`, `clean-code`, `code-quality`, `anti-slop`.
- For React code: `react-senior-guide`, then its relevant subskills, especially `react-useeffect`, `react-useref`, `react-anti-patterns`, and `react-design-patterns`.
- For library architecture, handoff readiness, extraction decisions, or "best/SOTA" requests: `sota`.
- After implementing a spec, multi-file change, public API change, or handoff change: `sota-verify`.
- If skills are not available, still apply the same checklists manually and say which skill was unavailable.

## Mandatory Workflow

- Start with `git status --short` and inspect the touched files before editing when the task changes code.
- Use `rg` / `rg --files` for search.
- Use `apply_patch` for manual edits.
- Keep changes scoped to the requested behavior and ownership boundaries.
- Prefer deleting dead code over preserving aliases, fallback branches, or compatibility wrappers before the first public release.
- Add or update behavior-focused tests when changing logic, public API, accessibility, focus, keyboard navigation, registry transforms, or CLI workflows.
- Before final handoff, run the narrowest relevant tests first, then broader validation when the blast radius crosses packages.

## Architecture Boundaries

- `libs/keys` owns reusable keyboard-first behavior: scopes, key registration, list navigation, focus zones, focus trap/restore, focusable/tabbable utilities, scroll lock, and small keyboard/focus helpers.
- `libs/ui` owns reusable shadcn-like UI primitives and headless-ish hooks that can build app components without importing app code.
- `apps/web` owns product-specific composition, copy, domain flows, data fetching, and app-only layout decisions. Extract from web only when behavior is generic and reusable outside Diffgazer.
- `libs/registry` owns registry contracts, shadcn/public registry validation/building, copy bundle behavior, and shared CLI workflow helpers.
- `cli/add` owns the user-facing add/remove/list/diff commands and must preserve copy, package, and direct registry consumption paths.
- `cli/server` owns the embedded Hono backend (review pipeline, git, config, shutdown token) consumed only by the `diffgazer` CLI. It is CLI-internal, not a reusable primitive, and ships bundled into the `diffgazer` binary via tsup `noExternal`.
- `libs/core` owns private business logic shared between the CLI and apps: Zod schemas/types (config, review, events, presentation, git, context), result/error types, format/string utilities, review state machines, provider filtering, API client factories, shared env/port parsing, and form/API/derived-state React hooks. It must not import from `apps/*` or `cli/*`.
- `cli/diffgazer` owns the public `diffgazer` CLI binary with two modes: web (embeds the built `@diffgazer/web` SPA behind a local `cli/server` Hono server) and TUI (Ink terminal UI). It is a binary, not a library; it stays thin and consumes `libs/core`, `libs/keys`, and `cli/server` rather than holding app-specific features.
- `apps/docs` owns the component and hook documentation site. It consumes `libs/core`, `libs/keys`, `libs/registry`, and `libs/ui` to build the registry browser, theme visualizer, and consumption examples. It must consume `@diffgazer/ui`, never mirror it; extract only generic utilities from docs, never docs-specific layout.
- `apps/landing` owns the marketing landing page. It uses only `libs/ui` (currently for theme CSS) and carries no product/domain logic and no docs utilities.
- `apps/hub` is a stub (planned portfolio/app-index). Keep it scaffolded to sibling-app conventions and free of app-specific logic until a documented boundary exists.

## Extraction Rules

- Extract primitives, not product widgets. Do not move app-specific components such as history progress lists, breakdown bars, onboarding copy, or domain cards into `libs/ui`.
- Extract keyboard/focus logic to `libs/keys` when the same behavior is useful across components or apps.
- Extract UI building blocks to `libs/ui` when they are generic primitives or reusable compound components with a clear public contract.
- Do not extract a helper only because two files look similar. Extract when it names a real concept, removes meaningful duplication, and keeps call sites clearer.
- Keep app adapters thin: web components should compose `libs/ui` and `libs/keys` rather than reimplement list navigation, roving focus, dialog focus trap, form field wiring, or ARIA relationships.

## Public UI API

- Public value controls use `value`, `defaultValue`, and `onChange(value)`.
- Native wrappers that render native form elements keep native React event handlers, for example `Input onChange(event)` and `Textarea onChange(event)`.
- Non-value state keeps semantic callback names: `open`/`onOpenChange`, `highlighted`/`onHighlightChange`, `selectedId`/`onSelect`, and `onNavigate`.
- Do not add deprecated aliases before the first public customer-facing release. Rename the API and update all docs, examples, registry files, generated bundles, and app consumers.

### Boolean form controls (Checkbox, Radio)

Standalone `Checkbox` and `Radio` render custom div-based controls plus a hidden native `<input>` for form-submission semantics. They keep native-style boolean state props:

- `checked` / `defaultChecked` — boolean state (Checkbox accepts `"indeterminate"`).
- `onChange(checked: boolean)` — called when the boolean state changes.
- `value: string` — the form-submission value, mirroring the native HTML `<input value>` attribute.

This is a documented exception to the generic `value/defaultValue/onChange(value)` rule because:

1. The hidden native input owns `value: string` for form encoding. Renaming the boolean state to `value: boolean` would either shadow that prop or change form-submission semantics.
2. The boolean state IS the value-control state — just spelled `checked` to match native HTML semantics and existing React/library conventions.
3. Group primitives (`CheckboxGroup`, `RadioGroup`) follow the standard `value/defaultValue/onChange(value)` contract for their composite value.

## Form Primitives

- `Input` is the bare native input wrapper.
- `InputGroup` is only a decorated input shell for prefix/suffix content.
- `Field` owns form wiring: label, control id, required, disabled, invalid, description, error, and ARIA relationships.
- Do not turn decorated inputs into form fields. Compose `Field` with `Input`, `InputGroup`, `Textarea`, `Select`, or another control.

## React Rules

- Derive values during render when possible. Do not sync derived state with `useEffect`.
- Use event handlers for user actions; use effects only for synchronization with external systems or visibility/lifecycle work.
- Use `useRef` for mutable values that do not affect rendering, stale-closure escape hatches, DOM handles, and previous imperative state.
- Do not use `useRef` plus `useEffect` as a hidden state synchronization pattern unless it is explicitly needed to avoid stale async/event callbacks.
- Do not add `useMemo`, `useCallback`, or `memo` defensively. Use them only for measured performance, stable context values, or real referential contracts.
- Hooks must be called unconditionally and before early returns.
- Store stable IDs instead of object copies when source data already exists.
- Prefer union state over multiple booleans for status.
- Avoid nested ternaries and long nullish chains in JSX/control flow; name the decision with a helper when it improves readability.

## Keys Library Rules

- Public keyboard callbacks must describe the semantic event, not implementation details. Prefer names like `onNavigate`, `onHighlightChange`, `onNavigationBoundaryReached`, and `onZoneChange`.
- Focusable and tabbable are different concepts. Programmatic focus may include `tabIndex={-1}`; Tab cycling must use tabbable elements only.
- Focus utilities must respect the element `ownerDocument`; do not assume global `document` when the element is known.
- Scopes must be registered before hooks that rely on the active scope.
- Keyboard handlers must ignore editable targets unless the component explicitly owns the input interaction.
- Navigation utilities should accept disabled/skipped items and preserve DOM/user-visible order.

## UI Library Rules

- Follow the variant conventions in `libs/ui/docs/content/patterns/variants.mdx`: CVA for named variant dimensions, CSS files only for things Tailwind cannot express, Records only for non-class values, plain Tailwind for single boolean conditionals.
- Build primitives that compose. Keep repeated app layouts in `apps/web` unless the abstraction is generic.
- Components must preserve accessible roles, labels, descriptions, invalid/disabled state, keyboard behavior, and form submission semantics.
- `Field` owns label/control/description/error ARIA wiring. Controls must merge external ARIA props rather than replacing them.
- For compound components, keep public state names semantic and consistent with the Public UI API section.
- Direct shadcn/copy consumers must receive source that builds without unpublished package-only assumptions.
- Package consumers must receive complete exports, declarations, CSS/source contracts, and peer dependency behavior.

## Registry, CLI, and Handoff

- Every public registry item must be installable through all intended paths: direct copy, `dgadd`, and npm package where applicable.
- If a component depends on keys utilities in copy mode, public UI registry source must rewrite package imports to local copied hook/utility paths.
- Public `libs/keys/public/r` TypeScript content must not emit relative `.js` import specifiers that break copy/shadcn consumers.
- Keep public registries under `libs/ui/public/r` and `libs/keys/public/r` committed; they are the reviewable handoff contract.
- Update source registry files, public registry JSON, docs, examples, generated bundles, and app consumers together when public APIs change.
- `dgadd remove` must respect ownership metadata and must not remove copied shared dependencies still needed by retained installed items.

## Testing

- Test user-visible behavior and accessibility contracts.
- Prefer role/label/text queries over implementation details.
- Do not assert Tailwind class names unless the class is explicitly the public API.
- For keyboard/focus work, test actual focus movement, active descendant, boundary callbacks, editable-target behavior, and disabled/skipped item behavior.
- For registry/CLI work, test copy/package/direct public registry paths and removal ownership behavior.
- For React hooks, test behavior under rerender and cleanup, not internal refs or implementation-only state.

## Generated Artifacts

- Do not commit deterministic generated data under `libs/ui/docs/generated`, `libs/keys/docs/generated`, or `cli/add/src/generated`.
- Keep public registries under `libs/ui/public/r` and `libs/keys/public/r` committed; they are the reviewable registry contract.
- Run `pnpm run prepare:artifacts` before artifact validation, docs sync, root type-check, root tests, or release checks when generated files are missing or stale.

## Verification Gates

- After keys changes: run focused keys tests and `pnpm --filter @diffgazer/keys type-check`.
- After UI primitive changes: run focused UI tests and `pnpm --filter @diffgazer/ui type-check`.
- After web adoption changes: run focused web tests and `pnpm --filter @diffgazer/web type-check`.
- After registry, CLI, docs, or public handoff changes: run `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`.
- Before declaring SOTA/ready: run `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`, `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`, `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`, and `pnpm run verify:monorepo`.
- Always run `git diff --check` before final response.

## Dependency Policy

- Do not add production dependencies unless the task clearly requires them and existing repo tools cannot solve the problem.
- Compatibility-only dependencies for smoke fixtures belong in root `devDependencies`, not app/library runtime dependencies.
- When adding or changing dependencies, update lockfiles through the package manager and explain why the dependency belongs at that level.

## Final Response Contract

- Report what changed, what was verified, and any remaining skips or risks.
- Mention untracked files that are required for the change set.
- Do not claim SOTA/ready if any required verification failed, was skipped unexpectedly, or was not run.
