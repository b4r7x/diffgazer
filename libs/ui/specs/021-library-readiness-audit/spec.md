# @diffgazer/ui Library Readiness Audit

**Created**: 2026-05-05  
**Mode**: Read-only SOTA audit  
**Scope**: `libs/ui`, `libs/keys`, `cli/add`, docs/registry consumers  
**Agents**: 10 component-quality agents, 10 user-handoff agents

## Verdict

`@diffgazer/ui` is not ready for broad user handoff today.

- **Component quality score**: `2.8/5`
- **User handoff readiness score**: `2.1/5`
- **Local verification run**:
  - `pnpm --filter @diffgazer/ui validate:registry` passed.
  - `pnpm --filter @diffgazer/ui type-check` passed.
  - `pnpm --filter @diffgazer/ui test` passed: 42 files, 389 tests.
  - `node --import tsx cli/add/src/index.ts list --json` failed on the public `theme` registry item.
- **Build not run**: package builds rewrite `dist`, `public/r`, docs generated data, and artifacts, so they were avoided in this read-only pass.

## Current Context

- `@diffgazer/ui` registry: 62 items, including 45 `registry:ui`, 8 `registry:hook`, 8 `registry:lib`, and 1 `registry:theme`.
- `@diffgazer/keys` registry: 3 hook items.
- Installer package: `@diffgazer/add`; CLI binary: `dgadd`.
- Runtime CSS story: Tailwind CSS v4 with package-mode `@source "../node_modules/@diffgazer/ui/dist"`.
- Source-copy CSS story: `dgadd init` copies `src/styles/theme.css` and `src/styles/styles.css`.
- Standards baseline checked against current React 19 ref/client-boundary guidance, WAI-ARIA/APG patterns, Tailwind v4 `@source`, and shadcn registry namespace guidance.

## P0 Readiness Blockers

- `RDY-001`: Public install commands point at packages that are not published.
- `RDY-002`: `dgadd list` and `--all` are broken by the public `theme` registry item.
- `RDY-003`: registry dependency closure misses files/dependencies for `dialog`, `popover`, and `accordion`.
- `RDY-004`: package-mode CSS is malformed and docs import the wrong CSS entry.
- `RDY-005`: `@diffgazer/keys` is not Next/RSC safe as a package entry.
- `RDY-006`: CLI remove/adopt/path safety can affect user-owned files.
- `RDY-014`: public `.d.ts` files are not self-contained for strict consumers.

## P1 Readiness Issues

- `RDY-007`: component docs generated data is missing.
- `RDY-008`: getting-started docs are not copy-paste valid.
- `RDY-009`: dependency policy differs across package mode, source-copy mode, and CLI bundles.
- `RDY-010`: artifact validation allows stale or tampered artifacts through.
- `RDY-011`: consumer verification is too narrow for a reusable UI library.
- `RDY-012`: release governance, CI, changesets, and license packaging are not handoff-ready.
- `RDY-013`: public positioning and keyboard/migration docs are inconsistent.
- `RDY-015`: root-source projects and package-manager detection can produce wrong installs.
- `RDY-016`: shadcn namespace setup is under-documented.

## P2 Quality Hardening

The component agents found real quality risks, but they should come after P0 install/package correctness. Main themes:

- Form/listbox correctness: select disabled/typeahead/form behavior, checkbox group required behavior, radio/toggle roving tab stops.
- Navigation/data correctness: shared navigation starts from the wrong item, stale active descendants, empty Tabs active state, collapsed Stepper content focusability, DiffView empty-file bugs.
- Overlay correctness: outside-click and Escape are not stack-aware; presence can get stuck without `animationend`.
- API/test hardening: inconsistent handler composition, uneven native prop/ref forwarding, insufficient observer/focus/SSR/StrictMode tests.

See [issues/README.md](issues/README.md) for the full deduped issue list.

## Recommended Order

1. Fix P0 public install/package blockers.
2. Add hard validators and clean consumer smoke fixtures.
3. Correct docs/product contract and release governance.
4. Tackle high-risk component quality issues.
5. Expand behavior-focused tests and consumer matrix coverage.

