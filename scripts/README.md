# Monorepo Scripts

Active scripts in this directory verify the single-repository Diffgazer workspace.

```bash
pnpm run verify:monorepo
pnpm run validate:artifacts:check
pnpm run smoke:cli
pnpm run smoke:packages
pnpm run smoke:shadcn
pnpm run test-ci
pnpm run release-check
```

## Source of Truth

The live monorepo scripts are wired through the root `package.json` scripts
(`verify:monorepo`, `validate:artifacts:check`, `smoke:*`, `bench`, `smoke:modelsdev`,
`release-check`); see `package.json` for the authoritative invocation list and
`scripts/monorepo/` for the modules they run.
