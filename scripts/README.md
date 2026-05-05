# Monorepo Scripts

Active scripts in this directory verify the single-repository Diffgazer workspace.

```bash
pnpm run verify:monorepo
pnpm run smoke:cli
pnpm run smoke:packages
```

## Active Files

- `monorepo/check-invariants.mjs` checks workspace shape, package metadata, and local dependency protocols.
- `monorepo/smoke-cli.mjs` checks the product CLI and registry installer CLI command surfaces.
- `monorepo/smoke-package-install.mjs` packs public packages into isolated temp projects and verifies public imports/bins.
