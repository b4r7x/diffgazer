# diffgazer

Diffgazer is a single pnpm monorepo for the CLI, docs app, shared registry tooling, keyboard hooks, and UI packages.

## Workspace

- `cli/diffgazer` - public `diffgazer` CLI
- `cli/add` - public `@diffgazer/add` installer
- `libs/ui` - public `@diffgazer/ui` package
- `libs/keys` - public `@diffgazer/keys` package
- `libs/registry` - private `@diffgazer/registry` workspace library
- `apps/docs` - documentation and registry host

## Quick Start

```bash
git clone https://github.com/b4r7/diffgazer.git
cd diffgazer
pnpm install
pnpm run build
```

## Development

```bash
pnpm run type-check
pnpm run test
pnpm run docs:prepare
pnpm run docs:build
```

This repository is one workspace with a single root install and lockfile.

## Published-Mode Smoke Test

Packs local workspace packages into isolated temp projects and verifies public imports/bins.

```bash
pnpm run smoke:packages
```
