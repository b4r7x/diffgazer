# Feature Specification: @diffgazer/ui Library Readiness Audit

**Feature Branch**: `020-library-readiness-audit`  
**Created**: 2026-05-05  
**Status**: Rechecked on 2026-05-05  
**Input**: User description: "Restore the deleted readiness spec. Keep the problems precise and make it possible to re-run the audit with X agents in the future."

## Summary

This spec records the read-only multi-agent audit for `@diffgazer/ui` as a reusable component library. It separates:

- **Readiness issues**: blockers that prevent safe handoff to users through shadcn-style registry installs, `dgadd`, or npm package consumption.
- **Quality issues**: component, hook, accessibility, API, and test issues that reduce quality even after installation is fixed.

No implementation changes are part of this spec. Each issue has its own file under `issues/`.

## 2026-05-05 Recheck

The audit was re-run read-only with separate component-quality and user-handoff batches. The recheck did not find the library ready for handoff.

- **Component quality score**: about `2.5/5`
- **User-facing library readiness score**: about `2/5`
- **Current blocker class**: install/package artifacts, CLI integration, CSS/RSC output, docs/positioning, and artifact gates.
- **Correction from the previous pass**: shadcn registry dependencies may be bare local names. `RDY-001` is now a validation issue, not a blanket ban on bare local dependencies.
- **New issues added**: `RDY-017`, `RDY-018`, `QLT-022`, `QLT-023`, `QLT-024`, and `QLT-025`.

Local context observed during the recheck:

- `@diffgazer/ui` exports wildcard component, hook, lib, and CSS subpaths from `libs/ui/package.json`.
- The UI registry has 62 public items: 45 `ui`, 8 `hooks`, 8 `lib`, and 1 `theme` item.
- The keys registry has 3 hook items: `navigation`, `focus-trap`, and `scroll-lock`.
- The installer package is `@diffgazer/add` and the CLI binary is `dgadd`.
- The npm CSS story is split across `theme-base.css`, `theme.css`, and `styles.css`; `dist/styles.css` currently does not aggregate dialog shared CSS.
- Docs and generated install commands still mix `@diffgazer/ui`, `@diffgazer/add`, `dgadd`, and artifact package names.
- The relevant local commands are `pnpm --filter @diffgazer/ui type-check`, `pnpm --filter @diffgazer/ui test`, registry `tsc --noEmit -p libs/ui/registry/tsconfig.json`, package builds, CLI smoke, and clean consumer smoke fixtures.

## Overall Verdict

`@diffgazer/ui` is not ready for a broad user handoff yet.

- **Component quality score**: about `2.5/5`
- **User-facing library readiness score**: about `2/5`
- **Recommended order**: installability/package contract first, docs/product contract second, component hardening third, release gates last.

## Issue Index

See [issues/README.md](issues/README.md).

## Priority Plan

### P0 - Public install or package import must not break

- `RDY-002` `@diffgazer/keys` registry dependency contract
- `RDY-005` CLI keys integration modes
- `RDY-007` CSS side-effect metadata
- `RDY-008` Tailwind v4 package scanning
- `RDY-009` missing dialog CSS in npm package
- `RDY-010` missing `"use client"` directives in npm output
- `RDY-011` optional `@diffgazer/keys` peer with static imports
- `RDY-018` copied source assumes aliases that `dgadd init` does not configure

### P1 - Public API and docs must be consistent

- `RDY-001` registry local dependency validation
- `RDY-003` missing registry npm dependencies
- `RDY-004` CLI command and package identity
- `RDY-006` CLI remove and manifest ownership safety
- `RDY-012` hidden internals exposed as npm API
- `RDY-013` docs and README drift
- `RDY-015` package metadata and governance
- `RDY-016` artifact validation gaps
- `RDY-017` canonical consumption and migration contract
- `QLT-024` event handler composition
- `QLT-021` public API consistency

### P2 - Component hardening

- `QLT-001` React 19 `useEffectEvent` misuse
- `QLT-002` controllable state contract problems
- `QLT-004` and `QLT-005` select behavior and semantics
- `QLT-007` tooltip trigger semantics
- `QLT-009` tabs active-state behavior
- `QLT-010` overlay lifecycle and stacking
- `QLT-022` unnamed keyboard-scrollable regions
- `QLT-023` breadcrumbs current-page semantics
- `QLT-025` navigation helper role coupling
- `QLT-020` test confidence gaps
- `RDY-014` release and CI gates once hard validators exist

## Success Criteria

- A clean consumer can install one public registry item and all local dependencies resolve from the intended registry namespace.
- A clean consumer can run the documented CLI command and install/add/remove/diff without broken imports or unsafe file deletion.
- A clean npm consumer can import documented subpaths, load CSS, compile Tailwind v4 utilities, and run in Next App Router without RSC directive failures.
- The package build fails on missing client directives, missing CSS aggregation, missing dist entries, stale registry artifacts, and public hidden-internal exports.
- The highest-risk component quality issues have behavior-focused tests.

## Verification Plan

- Run the UI typecheck, registry typecheck, UI test suite, package build, and artifact validator locally.
- Run `dgadd init/add/list/diff/remove` clean fixtures for copy mode and `@diffgazer/keys` package mode.
- Pack `@diffgazer/ui`, `@diffgazer/add`, and `@diffgazer/keys` into clean Vite and Next App Router fixtures.
- In package fixtures, import every documented public component subpath plus `@diffgazer/ui/styles.css`.
- In registry fixtures, install representative standalone and dependency-heavy items: `button`, `accordion`, `select`, `dialog`, `menu`, `command-palette`, `toast`, `spinner`, `label`, and `keys/navigation`.
