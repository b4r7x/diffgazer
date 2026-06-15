# Copilot Instructions

`AGENTS.md` is the single source of repository rules for Copilot and every other coding agent. Read it before proposing changes; this file only lists the command entry points.

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
