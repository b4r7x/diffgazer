# Diffgazer UI/Keys Handoff Readiness

> **Status:** specified, not yet implemented.
> **Scope:** make `libs/ui` and `libs/keys` public-handoff ready across manual copy/direct shadcn, `dgadd`, and npm package consumption, while keeping `apps/web` as a real dogfood consumer.
> **Write scope:** `libs/keys`, `libs/ui`, `libs/registry`, `cli/add`, `apps/docs`, `apps/web`, root verification scripts, docs/README files, colocated tests.
> **Out of scope:** publishing to npm, product feature work unrelated to UI/keys adoption, broad visual redesign, compatibility aliases before first public release.

## Problem

Diffgazer already uses `@diffgazer/ui` and `@diffgazer/keys`, but the libraries are not yet ready to hand to users as independent public artifacts. The required public contract is stronger than the current state:

1. Users can manually copy/direct-shadcn install public UI components and keys hooks.
2. Users can install source through `dgadd`.
3. Users can install versioned npm packages.

Today, parts of that contract fail or are under-documented:

- Direct shadcn for `libs/keys` breaks imports for items with `src/utils/*`.
- Direct shadcn for `libs/ui` still emits relative `.js` imports and has incomplete CSS wiring for CSS-heavy components.
- `dgadd` is the strongest path but still has pre-release aliases and under-smoked dependency install behavior.
- Package artifacts are structurally present, but public npm currently returns E404 for `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.
- Docs and READMEs do not consistently present all three paths for both libraries.
- `apps/web` still reimplements some generic keyboard/focus behavior that should live in `libs/keys` or `libs/ui`.

## Goals

1. Make every public `libs/keys` standalone registry item installable through manual/direct shadcn, `dgadd`, and npm package mode where applicable.
2. Make every public `libs/ui` component, hook, and true utility installable through manual/direct shadcn, `dgadd`, and npm package mode where applicable.
3. Remove or explicitly hide public surfaces that cannot be supported across the three paths.
4. Normalize public APIs before first public release, without deprecated aliases.
5. Move generic keyboard/focus/action-row behavior out of `apps/web` into `libs/keys` or `libs/ui`.
6. Update docs, READMEs, registry artifacts, generated docs data, and app consumers together.
7. Add verification gates that prove manual/direct shadcn, `dgadd`, and npm package paths actually build.
8. Leave product-specific Diffgazer composition in `apps/web`.

## Non-Goals

- Do not publish npm packages as part of this spec.
- Do not keep pre-release compatibility aliases unless they are deliberately blessed as public API.
- Do not move product widgets into `libs/ui`: review progress lists, severity breakdowns, trust/storage/provider flows, and app route behavior stay in `apps/web`.
- Do not add production dependencies unless an implementation brief proves the repo cannot solve the problem with existing tools.
- Do not commit deterministic generated outputs under ignored generated directories.

## Reading Order

| Step | File | Purpose |
|---|---|---|
| 1 | `README.md` | Problem, scope, goals, non-goals. |
| 2 | `decisions.md` | Audit decisions and tradeoffs. |
| 3 | `verification.md` | Required gates and missing smoke coverage. |
| 4 | `execute-prompt.md` | Copy/paste implementation prompt. |
| 5 | `agent-briefs/01-keys-three-paths.md` | `libs/keys` copy/dgadd/npm readiness. |
| 6 | `agent-briefs/02-ui-three-paths.md` | `libs/ui` copy/dgadd/npm readiness. |
| 7 | `agent-briefs/03-registry-cli-handoff.md` | Registry and `dgadd` hardening. |
| 8 | `agent-briefs/04-public-api-a11y.md` | Public API and accessibility fixes. |
| 9 | `agent-briefs/05-web-adoption.md` | Make `apps/web` a cleaner proof consumer. |
| 10 | `agent-briefs/06-docs-handoff.md` | Three-path docs and README handoff. |
| 11 | `agent-briefs/07-build-release-gates.md` | Build, smoke, release-readiness gates. |

## Definition Of Done

- Public registry/direct shadcn smoke passes for representative UI and keys items.
- `dgadd` smoke covers copy mode and `--integration keys` mode without relying only on `--skip-install`.
- Package smoke covers representative `@diffgazer/ui` and `@diffgazer/keys` React usage in Vite and Next-style fixtures where the repo supports it.
- Docs and READMEs show manual copy, `dgadd`, and npm package paths for both libraries, including current publish-gated status.
- `apps/web` no longer owns generic action-row/list-key behavior that belongs in `libs/keys` or `libs/ui`.
- All changed public APIs are reflected in source, tests, docs, registry JSON, public `/r`, generated docs data, and app consumers.
- Required verification in `verification.md` passes.
- `$sota-verify` on this spec directory reports CLEAN.

