# diffgazer

Diffgazer is a single pnpm monorepo for the CLI, docs app, shared registry tooling, keyboard hooks, and UI packages.

## Workspace

- `cli/diffgazer` - public `diffgazer` CLI
- `cli/add` - public `@diffgazer/add` installer, binary `dgadd`
- `libs/ui` - public `@diffgazer/ui` package
- `libs/keys` - public `@diffgazer/keys` package
- `libs/registry` - private `@diffgazer/registry` workspace library
- `apps/docs` - documentation and registry host

## Quick Start

```bash
git clone https://github.com/b4r7x/diffgazer.git
cd diffgazer
pnpm install
pnpm run build
```

## Development

```bash
pnpm run docs:dev
pnpm run web:dev
pnpm run diffgazer:dev
pnpm run type-check
pnpm run test
pnpm run verify
```

This repository is one workspace with a single root install and lockfile.

## UI Consumption Contract

The package names `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys` are package targets, but they are external publish-gated as of May 6, 2026. Public handoff must not use npm install commands until `npm view` returns versions for all three packages.

The canonical path for application-owned UI is copy-first registry install through the `dgadd` binary. From this workspace, validate it with local package smoke tests:

```bash
pnpm run smoke:packages
```

After `@diffgazer/add` is published, the public command style is:

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
```

`dgadd` copies component source and shared utilities into the consuming app. `dgadd init` writes `diffgazer.json`, copies theme/style files, creates install directories, and installs shared dependencies. The consuming app must configure TypeScript/bundler aliases before `init` and must import the copied CSS entrypoint itself.

`@diffgazer/ui` is also intended to support runtime package imports after publication:

```bash
npm install @diffgazer/ui @diffgazer/keys
```

Runtime package consumers must use Tailwind CSS v4 `@source` against `@diffgazer/ui/dist` and import `@diffgazer/ui/styles.css`. `@diffgazer/keys` is a required peer of `@diffgazer/ui` in package mode. Icon primitives ship from `@diffgazer/ui`; there is no `lucide-react` peer or runtime dependency.

Versioning, release gates, migration expectations, and artifact ownership are documented in [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md).

## Published-Mode Smoke Test

Packs local workspace packages into isolated temp projects and verifies public imports/bins. This does not install from the public npm registry.

```bash
pnpm run smoke:packages
```

## Package Governance

See [PACKAGE_GOVERNANCE.md](./PACKAGE_GOVERNANCE.md) for:

- Versioning policy and semantic versioning guidelines
- Release process and gates
- Dependency management and lockfile strategy
- Supported consumption contracts for each package
- Breaking change policy
