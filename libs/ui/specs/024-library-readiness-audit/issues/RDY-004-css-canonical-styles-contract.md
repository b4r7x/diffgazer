# RDY-004: Canonical CSS story is inconsistent across docs, artifacts, and runtime package

Area: Tailwind v4 / CSS / docs app / artifacts
Severity: P1
Effort: Medium

## Problem

Docs describe `styles.css` as the canonical package/component CSS import, but source, docs app, CLI output, runtime package output, and artifacts do not all mean the same thing by `styles.css`.

## Evidence

- Docs app imports token-only theme CSS, not canonical component CSS: `apps/docs/src/index.css:2`.
- Source `libs/ui/styles/styles.css` only imports `theme.css`: `libs/ui/styles/styles.css:1`.
- Runtime package build appends component CSS into `dist/styles.css`: `libs/ui/tsup.config.ts:112`.
- CLI init separately aggregates component CSS into copied styles: `cli/add/src/commands/init.ts:53`.

## User Impact

Docs previews can miss component-level CSS such as dialog backdrop/body locking. Source artifact consumers can see a `styles.css` that differs from the package `styles.css` users are told to import.

## Fix

Define one canonical relationship:

- If `styles.css` is canonical, make docs-synced artifact/source `styles.css`, CLI output, and package `dist/styles.css` intentionally align or clearly compose from the same generator.
- If source `styles.css` is base-only, rename or document it so it is not confused with package/copy-first canonical CSS.

## Acceptance Criteria

- Docs app imports the canonical style entry for demos.
- Dialog/command-palette demos have `dialog::backdrop`, close animation, and body-lock CSS active.
- `dist/artifacts/source/styles/styles.css`, docs synced styles, CLI init output, and package `dist/styles.css` have an intentional documented relationship.

## Verification

- `pnpm --filter @diffgazer/ui build`
- `pnpm run validate:artifacts`
- Build docs and inspect dialog/command-palette examples.
- Fresh package-mode and copy-first builds contain expected theme tokens and component CSS.

