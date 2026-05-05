# Copilot Instructions

## Project Overview

This repository is the `b4r7/diffgazer` pnpm monorepo.

Primary workspace roots:

- `apps/web` - private web app bundled into the product CLI.
- `apps/docs` - private docs and registry host.
- `cli/diffgazer` - public product CLI, binary `diffgazer`.
- `cli/add` - public registry installer CLI, binary `dgadd`.
- `libs/ui` - public React UI package, `@diffgazer/ui`.
- `libs/keys` - public React keyboard hooks package, `@diffgazer/keys`.
- `libs/registry` - private registry/artifact tooling package.
- `libs/core` - private shared product APIs, schemas, and utilities.
- `libs/server` - private Hono server used by the product.

## Commands

Run commands from the repository root unless a focused package command is clearer.

```bash
pnpm install
pnpm run verify:monorepo
pnpm run build
pnpm run type-check
pnpm run test
pnpm run smoke:cli
pnpm run smoke:packages
pnpm run docs:prepare
pnpm run docs:build
```

Focused examples:

```bash
pnpm --filter diffgazer dev
pnpm --filter @diffgazer/docs dev
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/ui build
pnpm --filter @diffgazer/keys build
```

## Conventions

- Use `workspace:*` for local workspace dependencies.
- Do not add `link:` or `file:` dependencies between migrated packages.
- Keep `diffgazer` product CLI separate from `@diffgazer/add` installer CLI.
- Keep `@diffgazer/ui` and `@diffgazer/keys` independently installable.
- Generated docs, registries, `.output`, `dist`, and `.turbo` outputs are not source of truth.

## Verification

Before proposing monorepo layout changes, run:

```bash
pnpm run verify:monorepo
```

That script checks workspace roots, package metadata, dependency protocols, and public package boundaries.
