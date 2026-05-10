# Agent 05: Registry, Docs, And Artifacts

Ownership:

- `libs/ui/registry/registry.json`
- `libs/ui/registry/component-docs/**`
- `libs/ui/registry/hook-docs/**`
- `libs/ui/registry/examples/**`
- `libs/ui/docs/content/**`
- `libs/ui/package.json` exports if public UI exports change
- `libs/ui/public/r/**`
- `libs/keys/registry/registry.json`
- `libs/keys/registry/hook-docs/**`
- `libs/keys/registry/examples/**`
- `libs/keys/docs/content/**`
- `libs/keys/public/r/**`
- `cli/add/scripts/**` only when bundle generation surfaces need updates
- generated artifact validation notes

Coordinate after Agents 01 and 02 land public API changes. Do not invent source APIs.

## Goal

Make the primitive changes handoff-ready for package imports and copy-mode registry consumers.

## UI Surfaces To Update

For every public UI primitive/API change:

- source registry files under `libs/ui/registry/ui/<item>/`, `hooks/`, or `lib/`
- `libs/ui/registry/registry.json`
- docs metadata under `libs/ui/registry/component-docs/<item>.ts` or hook docs
- examples under `libs/ui/registry/examples/<item>/*.tsx`
- MDX docs under `libs/ui/docs/content/components/<item>.mdx` or `hooks/<hook>.mdx`
- section `meta.json` files
- explicit package exports in `libs/ui/package.json`
- public registry files under `libs/ui/public/r/<item>.json` and `libs/ui/public/r/registry.json`

Known blocker to fix:

- `field` is public but `libs/ui/docs/content/components/field.mdx` is missing.
- Derived synced/artifact docs for `field` are also missing until artifacts are prepared.

## Keys Surfaces To Update

For every public keys primitive/API change:

- source and exports under `libs/keys/src/**` and `libs/keys/src/index.ts`
- package docs under `libs/keys/docs/**`
- hook docs/examples under `libs/keys/registry/**` if copy-mode should expose the primitive
- `libs/keys/registry/registry.json` only for copy-mode installable hooks/files
- public registry files under `libs/keys/public/r/**`

Clarify package-only vs copy-mode:

- If `useKey`, `useScope`, `useFocusZone`, navigation utilities, or focus restore utilities are package-only, docs must say that clearly.
- If they are copy-mode installable, registry/public files must include them.

## Handoff Blockers To Track

- Package-mode docs artifact loader expects `${packageName}/package.json`, but UI/keys package exports may not expose `./package.json`.
- `libs/ui/package.json` may exclude `dist/artifacts`; confirm whether external package handoff needs it.
- Artifact validation currently enforces some artifact/package exclusions. Resolve product intent before changing package files.
- Hosted shadcn registry remains future work unless product decision changes.
- Examples should avoid Diffgazer-specific copy when they are teaching generic primitives.

## Commands

After source/doc updates:

- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm --filter @diffgazer/keys verify:rsc`
- `pnpm run prepare:artifacts`
- `pnpm run validate:artifacts:check`
- `pnpm run verify:monorepo`
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 turbo run type-check`
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 turbo run test`
- `pnpm run smoke`

Do not commit deterministic generated data under `libs/ui/docs/generated`, `libs/keys/docs/generated`, or `cli/add/src/generated`. Do commit public registry contract files under `libs/ui/public/r` and `libs/keys/public/r`.

For docs artifact mode, test both local/dev and package/CI paths after the artifact packaging decision is resolved.
