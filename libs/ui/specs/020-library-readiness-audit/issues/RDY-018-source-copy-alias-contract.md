# RDY-018 - Copied source assumes aliases that init does not configure

**Area**: CLI init, copied source compatibility  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

Copied source imports use configured aliases such as `@/components/ui`, `@/hooks`, and `@/lib`, but `dgadd init` only writes those aliases to `diffgazer.json`. It detects whether the consumer already has a TypeScript `@/*` path alias, but it does not configure TypeScript, Vite, or Next to resolve the aliases it writes.

## Evidence

- `cli/add/src/commands/init.ts:67` displays whether `@/*` exists.
- `cli/add/src/commands/init.ts:94` writes alias values into `diffgazer.json`.
- `cli/add/src/commands/init.ts:101` writes only Diffgazer config, not `tsconfig.json`, Vite config, or Next config.
- `cli/add/src/commands/init.ts:112` lists only CSS import and add-command next steps.
- `cli/add/src/utils/transform.ts:47` and `cli/add/src/utils/transform.ts:48` rewrite source imports to configured aliases.
- `cli/add/README.md:110` documents the generated `diffgazer.json` aliases but does not state that the consumer must already configure matching build-tool aliases.

## User Impact

A clean project without `@/*` support can successfully run `dgadd init` and `dgadd add`, then fail TypeScript or bundler resolution on the first copied component.

## Fix

Choose one alias contract:

- configure matching aliases during `dgadd init` for supported frameworks;
- block with an actionable error when aliases are missing; or
- generate relative imports instead of alias imports for copied source.

The CLI should not write a config that it knows the project cannot resolve.

## Acceptance Criteria

- `dgadd init` either configures supported aliases or refuses to proceed with clear instructions.
- Copied files compile in clean Vite and Next App Router fixtures with no manual alias edits.
- CLI tests cover projects with and without existing `@/*` aliases.
- Docs state the exact alias requirement for manual mode.

## Verification

- Run `dgadd init -y` and `dgadd add ui/button ui/accordion` in a clean Vite fixture with no alias configured, then run `tsc --noEmit` and production build.
- Repeat in a clean Next App Router fixture.
- Add negative tests proving the CLI does not silently generate unresolved aliases.
