# RDY-008 - Getting-started docs are not copy-paste valid

**Area**: Docs install flow  
**Priority**: P1  
**Severity**: High  
**Effort**: Small

## Problem

The getting-started page starts with `npx @diffgazer/add init`, then switches to `dgadd add`. It also lists alias setup after init, while `dgadd init` rejects projects without an `@/*` alias.

## Evidence

- `libs/ui/docs/content/getting-started/installation.mdx:11` uses `npx @diffgazer/add init`.
- `libs/ui/docs/content/getting-started/installation.mdx:19` switches to `dgadd add ui/button`.
- `libs/ui/docs/content/getting-started/installation.mdx:57` explains alias setup after init.
- `cli/add/src/commands/init.ts:63` throws when alias detection fails unless `--allow-missing-alias` is passed.

## User Impact

A user following the page top-to-bottom can fail at init, then fail again because `dgadd` is not on PATH after one-off `npx`.

## Fix

Move alias/Tailwind prerequisites before `init`, and use one command style consistently. Prefer `npx @diffgazer/add add ...` unless the docs first install `dgadd` globally or locally.

## Acceptance Criteria

- A fresh Vite React app can follow the page top-to-bottom without undocumented flags.
- CLI docs and README use the same command style.

## Verification

Follow the docs in a clean Vite React 19 + Tailwind 4 project and run the app build.

